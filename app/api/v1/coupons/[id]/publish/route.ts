import { prisma } from "@/lib/db";
import { route, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { assertTransition } from "@/lib/coupon-state";
import { writeAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";
import { applyScore, FIRST_SHARE_DELTA, FIRST_SHARE_DESCRIPTION } from "@/lib/score";
import { canExchange } from "@/lib/trust";
import { throttle } from "@/lib/throttle";

// A follower gets at most one restock alert per this many hours. Deliberately
// coarse: the point is that the notification list stays readable, not that every
// listing gets announced.
const RESTOCK_QUIET_HOURS = 12;

export const POST = route(async (req, ctx) => {
  throttle(req, "coupon-publish", 40, 10 * 60_000);
  const { id } = await ctx.params;
  const user = await requireActiveUser();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");
  if (coupon.ownerId !== user.id) throw new ApiError("FORBIDDEN");
  if (coupon.status !== "DRAFT") {
    throw new ApiError("INVALID_STATUS_TRANSITION", { from: coupon.status, to: "AVAILABLE" });
  }

  // PRD §7 publish validations
  if (!coupon.title.trim() || !coupon.brand.trim()) {
    throw new ApiError("VALIDATION_ERROR", { message: "標題與品牌不可為空" });
  }
  if (coupon.expiryDate && coupon.expiryDate <= new Date()) throw new ApiError("COUPON_EXPIRED");
  if (!coupon.barcodeEncryptedData && !coupon.barcodeStorageKey && !coupon.redeemCodeEncrypted) {
    throw new ApiError("VALIDATION_ERROR", { message: "請先上傳條碼圖片或填寫兌換碼" });
  }
  if (coupon.type === "EXCHANGE" && !coupon.exchangeTarget) {
    throw new ApiError("VALIDATION_ERROR", { message: "交換類型必須填寫交換目標" });
  }
  // Exchange fraud guard: only trusted accounts may list an exchange (both sides
  // hand over a barcode). Gifting stays open to everyone.
  if (coupon.type === "EXCHANGE" && !canExchange(user)) {
    throw new ApiError("EXCHANGE_TRUST_REQUIRED");
  }

  // Uploading/sharing coupons is unlimited — giving is good. Only claims are capped.
  assertTransition(coupon.status, "AVAILABLE");

  const updated = await prisma.coupon.update({ where: { id }, data: { status: "AVAILABLE" } });

  // Notify followers of this brand (restock alert) — one batched write + push,
  // capped, instead of a serial round-trip per follower.
  const followers = await prisma.brandFollow.findMany({
    where: { brand: { equals: coupon.brand, mode: "insensitive" }, NOT: { userId: user.id } },
    select: { userId: true },
    take: 500,
  });

  // Throttle: at most one restock alert per follower per RESTOCK_QUIET_HOURS.
  //
  // Unthrottled this fired on every publish, so a popular brand buried everything
  // else: 5,093 restock notices in one week against 180 "someone wants your coupon"
  // — 28:1. Measured read rates say the same thing: restock 1%, claim request 38%,
  // transaction message 80%. Owners were not ignoring the bell, they were ignoring
  // a bell that was 88% noise, and half the applications went unanswered as a result.
  const quietSince = new Date(Date.now() - RESTOCK_QUIET_HOURS * 60 * 60 * 1000);
  const recentlyAlerted = await prisma.notification.findMany({
    where: {
      userId: { in: followers.map((f) => f.userId) },
      type: "BRAND_RESTOCK",
      createdAt: { gte: quietSince },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const muted = new Set(recentlyAlerted.map((n) => n.userId));
  const recipients = followers.map((f) => f.userId).filter((uid) => !muted.has(uid));

  await notifyMany(prisma, {
    userIds: recipients,
    type: "BRAND_RESTOCK",
    title: `${coupon.brand} 有新券！`,
    body: `你追蹤的「${coupon.brand}」有人分享了「${coupon.title}」`,
    referenceType: "coupon",
    referenceId: id,
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: user.id,
    action: "coupon.publish",
    targetType: "coupon",
    targetId: id,
    before: { status: "DRAFT" },
    after: { status: "AVAILABLE" },
    ip: meta.ip,
    ua: meta.ua,
  });

  // Phase 1: award first-share bonus (+2) idempotently.
  // Uses ADMIN_ADJUSTMENT + referenceType=ADMIN + referenceId=userId as the
  // unique key — guaranteed to fire at most once per user (schema unique constraint).
  // Failure must not block the publish response.
  try {
    await applyScore(prisma, {
      userId: user.id,
      eventType: "ADMIN_ADJUSTMENT",
      delta: FIRST_SHARE_DELTA,
      referenceType: "ADMIN",
      referenceId: user.id,
      description: FIRST_SHARE_DESCRIPTION,
    });
  } catch (err) {
    console.error("[publish] first-share score failed", err);
  }

  return jsonOk({ coupon_id: id, status: updated.status });
});
