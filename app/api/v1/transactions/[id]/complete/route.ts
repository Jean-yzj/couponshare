import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { applyScore, SCORE_RULES } from "@/lib/score";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// GIFT: either party confirming completes it. EXCHANGE: codes must have been
// revealed (both committed) first, then BOTH must confirm. A clean exchange
// completion credits BOTH sides +5; a disputed one credits nobody. PRD §7.3.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  const isOwner = t.ownerId === user.id;
  const isClaimant = t.claimantId === user.id;
  if (!isOwner && !isClaimant) throw new ApiError("FORBIDDEN");
  if (t.status === "COMPLETED") {
    return jsonOk({ transaction_id: id, status: "COMPLETED" });
  }
  if (t.status === "DISPUTED") {
    throw new ApiError("VALIDATION_ERROR", { message: "此交易已回報問題，複核中" });
  }
  if (t.transactionType === "EXCHANGE" && !t.revealedAt) {
    throw new ApiError("VALIDATION_ERROR", { message: "請先雙方確認亮碼後再完成" });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: isOwner ? { ownerCompleted: true } : { claimantCompleted: true },
  });

  const done =
    updated.transactionType === "EXCHANGE"
      ? updated.ownerCompleted && updated.claimantCompleted
      : updated.ownerCompleted || updated.claimantCompleted;

  if (done) {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      // Exchange: both sides gave a coupon → both earn the exchange credit (only now).
      if (updated.transactionType === "EXCHANGE") {
        for (const uid of [t.ownerId, t.claimantId]) {
          await applyScore(tx, {
            userId: uid,
            eventType: "COUPON_EXCHANGED",
            delta: SCORE_RULES.COUPON_EXCHANGED,
            referenceType: "TRANSACTION",
            referenceId: id,
            description: "成功完成交換",
          });
        }
      }
    });

    const other = isOwner ? t.claimantId : t.ownerId;
    await notify(prisma, {
      userId: other,
      type: "TRANSACTION_COMPLETED",
      title: "交易已完成",
      body: "對方已確認完成，別忘了留下評價與感謝",
      referenceType: "transaction",
      referenceId: id,
    });
    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: "transaction.complete",
      targetType: "transaction",
      targetId: id,
      after: { status: "COMPLETED" },
      ip: meta.ip,
      ua: meta.ua,
    });
    return jsonOk({ transaction_id: id, status: "COMPLETED" });
  }

  return jsonOk({
    transaction_id: id,
    status: "CREATED",
    owner_completed: updated.ownerCompleted,
    claimant_completed: updated.claimantCompleted,
    waiting_for_other: true,
  });
});
