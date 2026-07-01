import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { assertTransition } from "@/lib/coupon-state";
import { applyScore, SCORE_RULES } from "@/lib/score";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// Owner approves one applicant. Atomic: DB transaction + row-level lock on the
// coupon, re-check status under lock, claim, reject the rest, score, notify,
// audit — all or nothing. PRD §7.2 + §9.2.
export const POST = route(async (req, ctx) => {
  const { id: claimRequestId } = await ctx.params;
  const user = await requireActiveUser();
  const meta = clientMeta(req);

  const result = await prisma.$transaction(async (tx) => {
    const cr = await tx.claimRequest.findUnique({
      where: { id: claimRequestId },
      include: { coupon: true },
    });
    if (!cr) throw new ApiError("CLAIM_REQUEST_NOT_FOUND");

    const coupon = cr.coupon;
    if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");

    // Row-level lock — serialise concurrent approvals on the same coupon.
    await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${coupon.id} FOR UPDATE`;

    // Re-read status under the lock before mutating.
    const locked = await tx.coupon.findUnique({ where: { id: coupon.id } });
    if (!locked) throw new ApiError("COUPON_NOT_FOUND");
    if (locked.status === "CLAIMED") throw new ApiError("COUPON_ALREADY_CLAIMED");
    if (locked.status !== "AVAILABLE" && locked.status !== "PENDING") {
      throw new ApiError("COUPON_NOT_AVAILABLE");
    }
    if (cr.status !== "PENDING") {
      throw new ApiError("INVALID_STATUS_TRANSITION", { from: cr.status, to: "APPROVED" });
    }
    assertTransition(locked.status, "CLAIMED");

    const now = new Date();

    await tx.claimRequest.update({
      where: { id: cr.id },
      data: { status: "APPROVED", approvedAt: now },
    });

    await tx.coupon.update({
      where: { id: coupon.id },
      data: { status: "CLAIMED", claimantId: cr.requesterId, claimedAt: now },
    });

    // Everyone else for this coupon is rejected.
    await tx.claimRequest.updateMany({
      where: { couponId: coupon.id, status: "PENDING", NOT: { id: cr.id } },
      data: { status: "REJECTED", rejectedAt: now, ownerResponseMessage: "已贈送給其他申請者" },
    });

    const txn = await tx.transaction.create({
      data: {
        couponId: coupon.id,
        ownerId: coupon.ownerId,
        claimantId: cr.requesterId,
        claimRequestId: cr.id,
        transactionType: coupon.type,
        status: "CREATED",
      },
    });

    // Gifts credit the giver on approval. Exchanges credit BOTH sides only on a
    // clean completion (see transactions/[id]/complete) — so a scammer whose swap
    // gets disputed earns nothing.
    if (coupon.type === "GIFT") {
      await applyScore(tx, {
        userId: coupon.ownerId,
        eventType: "COUPON_GIFTED",
        delta: SCORE_RULES.COUPON_GIFTED,
        referenceType: "TRANSACTION",
        referenceId: txn.id,
        description: "成功贈出票券",
      });
    }

    await notify(tx, {
      userId: cr.requesterId,
      type: "CLAIM_APPROVED",
      title: "你的申請被接受了！",
      body: `你已成功領取「${coupon.title}」，立即查看條碼`,
      referenceType: "coupon",
      referenceId: coupon.id,
    });

    await writeAudit(tx, {
      actorId: user.id,
      action: "claim.approve",
      targetType: "coupon",
      targetId: coupon.id,
      before: { status: locked.status },
      after: { status: "CLAIMED", claimantId: cr.requesterId },
      ip: meta.ip,
      ua: meta.ua,
    });

    return { couponId: coupon.id, claimantId: cr.requesterId, transactionId: txn.id };
  });

  return jsonOk({
    coupon_id: result.couponId,
    claimant_id: result.claimantId,
    status: "CLAIMED",
    transaction_id: result.transactionId,
  });
});
