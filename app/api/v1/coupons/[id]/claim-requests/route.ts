import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser, requireUser } from "@/lib/auth";
import { applyQuota } from "@/lib/share-gate";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { claimRequestView } from "@/lib/serialize";
import { ownerSelect } from "@/lib/selects";
import { claimRequestSchema } from "@/lib/validation";
import { hasBlockBetween } from "@/lib/blocks";
import { assertTransition } from "@/lib/coupon-state";
import { applyScore, SCORE_RULES } from "@/lib/score";

// Apply to claim / exchange a coupon. PRD §7.2.
export const POST = route(async (req, ctx) => {
  const { id: couponId } = await ctx.params;
  const user = await requireActiveUser();
  const body = await readBody(req, claimRequestSchema);

  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId === user.id) throw new ApiError("CANNOT_CLAIM_OWN_COUPON");
  if (await hasBlockBetween(prisma, coupon.ownerId, user.id)) throw new ApiError("FORBIDDEN");
  if (coupon.status !== "AVAILABLE") throw new ApiError("COUPON_NOT_AVAILABLE");
  if (coupon.expiryDate && coupon.expiryDate <= new Date()) throw new ApiError("COUPON_EXPIRED");
  if (body.request_type !== coupon.type) {
    throw new ApiError("VALIDATION_ERROR", { message: "申請類型與票券類型不符" });
  }
  if (body.request_type === "EXCHANGE" && !body.exchange_offer_text) {
    throw new ApiError("VALIDATION_ERROR", { message: "交換申請必須填寫交換內容" });
  }

  // Level-restricted coupons block low-tier users (PRD §8.3.7).
  if (coupon.visibilityLevel === "LEVEL_2_ONLY" && user.userLevel === "LEVEL_1") {
    throw new ApiError("FORBIDDEN", { message: "此票券僅限達人以上申請" });
  }
  if (coupon.visibilityLevel === "LEVEL_3_ONLY" && user.userLevel !== "LEVEL_3") {
    throw new ApiError("FORBIDDEN", { message: "此票券僅限傳奇會員申請" });
  }

  // Application quota: 3 total before the first share, then a daily limit by level
  // (+3 for each coupon shared today). PRD §8.2 + user request.
  const quota = await applyQuota(user);
  if (quota.remaining <= 0) {
    throw new ApiError(quota.hasShared ? "DAILY_CLAIM_LIMIT_EXCEEDED" : "SHARE_FIRST");
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE`;

      const locked = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!locked) throw new ApiError("COUPON_NOT_FOUND");
      if (locked.status !== "AVAILABLE") throw new ApiError("COUPON_NOT_AVAILABLE");
      if (locked.expiryDate && locked.expiryDate <= new Date()) throw new ApiError("COUPON_EXPIRED");

      const cr = await tx.claimRequest.create({
        data: {
          couponId,
          requesterId: user.id,
          requestType: body.request_type,
          message: body.message,
          exchangeOfferText: body.exchange_offer_text ?? null,
          status: "PENDING",
        },
      });
      await tx.coupon.update({
        where: { id: couponId },
        data: { claimRequestCount: { increment: 1 } },
      });

      const autoApprove =
        locked.type === "GIFT" && locked.unlockPolicy === "AUTO_REVEAL_AFTER_MESSAGE";

      if (!autoApprove) {
        await notify(tx, {
          userId: locked.ownerId,
          type: "CLAIM_REQUEST_RECEIVED",
          title: "有人申請你的票券",
          body: `${user.displayName} 申請了「${locked.title}」`,
          referenceType: "coupon",
          referenceId: couponId,
        });
        return { claimRequest: cr, transactionId: null };
      }

      assertTransition(locked.status, "CLAIMED");
      const now = new Date();

      await tx.claimRequest.update({
        where: { id: cr.id },
        data: { status: "APPROVED", approvedAt: now },
      });

      await tx.coupon.update({
        where: { id: couponId },
        data: { status: "CLAIMED", claimantId: user.id, claimedAt: now },
      });

      const txn = await tx.transaction.create({
        data: {
          couponId,
          ownerId: locked.ownerId,
          claimantId: user.id,
          claimRequestId: cr.id,
          transactionType: locked.type,
          status: "CREATED",
        },
      });

      await applyScore(tx, {
        userId: locked.ownerId,
        eventType: "COUPON_GIFTED",
        delta: SCORE_RULES.COUPON_GIFTED,
        referenceType: "TRANSACTION",
        referenceId: txn.id,
        description: "成功贈出票券",
      });

      await notify(tx, {
        userId: locked.ownerId,
        type: "CLAIM_REQUEST_RECEIVED",
        title: "票券已自動送出",
        body: `${user.displayName} 是第一位申請「${locked.title}」的人，系統已自動贈送`,
        referenceType: "coupon",
        referenceId: couponId,
      });

      await notify(tx, {
        userId: user.id,
        type: "CLAIM_APPROVED",
        title: "你已取得這張票券！",
        body: `「${locked.title}」設定為送給第一個申請的人，立即查看條碼`,
        referenceType: "coupon",
        referenceId: couponId,
      });

      return { claimRequest: { ...cr, status: "APPROVED" as const }, transactionId: txn.id };
    });

    const meta = clientMeta(req);
    await writeAudit(prisma, {
      actorId: user.id,
      action: "claim.request",
      targetType: "claim_request",
      targetId: created.claimRequest.id,
      after: created.transactionId
        ? { status: "APPROVED", transactionId: created.transactionId }
        : { status: "PENDING" },
      ip: meta.ip,
      ua: meta.ua,
    });

    return jsonOk(
      {
        claim_request_id: created.claimRequest.id,
        status: created.claimRequest.status,
        transaction_id: created.transactionId,
      },
      201,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError("DUPLICATE_CLAIM_REQUEST");
    }
    throw e;
  }
});

// Owner views the applicant list for their coupon. PRD §7.2.
export const GET = route(async (req, ctx) => {
  const { id: couponId } = await ctx.params;
  const user = await requireUser();

  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");

  const requests = await prisma.claimRequest.findMany({
    where: { couponId },
    include: { requester: { select: ownerSelect } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return jsonOk({ data: requests.map(claimRequestView) });
});
