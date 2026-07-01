import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { disputeSchema } from "@/lib/validation";

// A party reports that the code they received is fake / used / invalid. The swap
// already happened (codes revealed), so this can't be used to "dispute and steal".
// It flags the txn DISPUTED and files an evidenced report on the other party for
// ADMIN review — NOT an auto-penalty (so false accusations aren't a free weapon),
// but it does feed the Sybil-resistant 3-reporter auto-suspend.
export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireActiveUser();
  const body = await readBody(req, disputeSchema);

  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t) throw new ApiError("NOT_FOUND");
  const isOwner = t.ownerId === user.id;
  const isClaimant = t.claimantId === user.id;
  if (!isOwner && !isClaimant) throw new ApiError("FORBIDDEN");
  if (!t.revealedAt) {
    throw new ApiError("VALIDATION_ERROR", { message: "尚未亮碼交換，無法回報問題" });
  }
  if (t.status === "COMPLETED") throw new ApiError("VALIDATION_ERROR", { message: "交易已完成" });
  if (t.status === "DISPUTED") return jsonOk({ transaction_id: id, status: "DISPUTED" });

  const accusedId = isOwner ? t.claimantId : t.ownerId;
  const meta = clientMeta(req);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: { status: "DISPUTED", disputedAt: new Date() },
    });
    await tx.report.create({
      data: {
        reporterId: user.id,
        transactionId: id,
        reportedUserId: accusedId,
        reason: body.reason,
        description: body.description ?? null,
        evidenceImageUrl: body.evidence_image_url ?? null,
        status: "PENDING",
      },
    });
    await notify(tx, {
      userId: accusedId,
      type: "REPORT_UPDATED",
      title: "對方回報了交換問題",
      body: "對方回報這次交換有問題，平台會進行複核。如有疑問可提出申訴。",
      referenceType: "transaction",
      referenceId: id,
    });
    await writeAudit(tx, {
      actorId: user.id,
      action: "transaction.dispute",
      targetType: "transaction",
      targetId: id,
      after: { reason: body.reason, accused: accusedId },
      ip: meta.ip,
      ua: meta.ua,
    });
  });

  // Auto-suspend only on 3+ DISTINCT, established (>=24h) reporters — Sybil-resistant.
  const establishedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reporters = await prisma.report.findMany({
    where: {
      reportedUserId: accusedId,
      status: { notIn: ["REJECTED", "RESOLVED"] },
      reporter: { createdAt: { lt: establishedBefore } },
    },
    select: { reporterId: true },
    distinct: ["reporterId"],
  });
  if (reporters.length >= 3) {
    const target = await prisma.user.findUnique({
      where: { id: accusedId },
      select: { status: true },
    });
    if (target?.status === "ACTIVE") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: accusedId }, data: { status: "SUSPENDED" } });
        await tx.coupon.updateMany({
          where: { ownerId: accusedId, status: { in: ["AVAILABLE", "PENDING"] } },
          data: { status: "SUSPENDED" },
        });
        await notify(tx, {
          userId: accusedId,
          type: "REPORT_UPDATED",
          title: "你的帳號已被暫停",
          body: "因多次被檢舉，帳號已暫停，相關票券已下架。可提出申訴。",
        });
      });
    }
  }

  return jsonOk({ transaction_id: id, status: "DISPUTED" });
});
