import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { applyScore, SCORE_RULES } from "@/lib/score";
import { notify } from "@/lib/notify";
import { ratingSchema } from "@/lib/validation";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const body = await readBody(req, ratingSchema);

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  if (t.ownerId !== user.id && t.claimantId !== user.id) throw new ApiError("FORBIDDEN");
  // A GIFT's giver can rate the moment they've sent it (transaction still CREATED),
  // without waiting for the recipient to confirm completion. Everyone else — the
  // recipient, and both sides of an exchange — rates only after COMPLETED.
  const giverEarly = t.transactionType === "GIFT" && t.ownerId === user.id && t.status === "CREATED";
  if (t.status !== "COMPLETED" && !giverEarly) throw new ApiError("TRANSACTION_NOT_COMPLETE");

  const counterparty = user.id === t.ownerId ? t.claimantId : t.ownerId;
  if (body.to_user_id !== counterparty) {
    throw new ApiError("VALIDATION_ERROR", { message: "只能評價交易對象" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rating.create({
        data: {
          transactionId: id,
          fromUserId: user.id,
          toUserId: body.to_user_id,
          ratingScore: body.rating_score,
          tags: (body.tags ?? []) as Prisma.InputJsonValue,
          comment: body.comment ?? null,
        },
      });

      // 4★+ rewards the rated user (idempotent on the transaction id).
      if (body.rating_score >= 4) {
        await applyScore(tx, {
          userId: body.to_user_id,
          eventType: "POSITIVE_RATING",
          delta: SCORE_RULES.POSITIVE_RATING,
          referenceType: "TRANSACTION",
          referenceId: id,
          description: "收到 4 星以上好評",
        });
      }

      await notify(tx, {
        userId: body.to_user_id,
        type: "RATING_RECEIVED",
        title: "你收到一則新評價",
        body: `獲得 ${body.rating_score} 星評價${body.comment ? `：「${body.comment}」` : ""}`,
        referenceType: "transaction",
        referenceId: id,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError("RATING_ALREADY_EXISTS");
    }
    throw e;
  }

  return jsonOk({ ok: true }, 201);
});
