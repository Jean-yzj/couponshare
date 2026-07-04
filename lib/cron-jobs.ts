import { prisma } from "./db";
import { notify } from "./notify";
import { writeAudit } from "./audit";

// Core cron logic, callable both from the HTTP cron routes (external trigger)
// and the in-process scheduler (lib/scheduler.ts). No req/auth here — the caller
// is responsible for authorization. Each query is capped so a backlog can't load
// unbounded rows.
const DAY = 86_400_000;
const STALE_DAYS = 7;

// Date-expire coupons, then auto-delist ones with zero applications after 7 days.
export async function runExpireCoupons() {
  const now = new Date();

  const expiring = await prisma.coupon.findMany({
    where: { status: { in: ["AVAILABLE", "PENDING"] }, expiryDate: { lt: now } },
    select: { id: true, ownerId: true, title: true, status: true },
    take: 500,
  });
  for (const c of expiring) {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id: c.id }, data: { status: "EXPIRED" } });
      await tx.claimRequest.updateMany({
        where: { couponId: c.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await notify(tx, {
        userId: c.ownerId,
        type: "COUPON_EXPIRED",
        title: "票券已過期",
        body: `「${c.title}」已過期並自動下架`,
        referenceType: "coupon",
        referenceId: c.id,
      });
      await writeAudit(tx, {
        action: "coupon.expire",
        targetType: "coupon",
        targetId: c.id,
        before: { status: c.status },
        after: { status: "EXPIRED" },
      });
    });
  }

  // No-interest auto-delist: AVAILABLE, listed 7+ days, still zero applications.
  const staleBefore = new Date(now.getTime() - STALE_DAYS * DAY);
  const stale = await prisma.coupon.findMany({
    where: { status: "AVAILABLE", claimRequestCount: 0, createdAt: { lt: staleBefore } },
    select: { id: true, ownerId: true, title: true },
    take: 500,
  });
  for (const c of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id: c.id }, data: { status: "EXPIRED" } });
      await notify(tx, {
        userId: c.ownerId,
        type: "COUPON_EXPIRED",
        title: "票券已自動下架",
        body: `「${c.title}」上架 7 天都沒有人申請，已自動下架，避免占用版面。若仍然有效，歡迎重新上傳一張。`,
        referenceType: "coupon",
        referenceId: c.id,
      });
      await writeAudit(tx, {
        action: "coupon.auto_delist_stale",
        targetType: "coupon",
        targetId: c.id,
        before: { status: "AVAILABLE" },
        after: { status: "EXPIRED" },
      });
    });
  }

  return { expired: expiring.length, delisted_stale: stale.length };
}

// Warn owners of coupons expiring within 24h (de-duped to once per 20h).
export async function runExpiringSoon() {
  const now = new Date();
  const in24h = new Date(now.getTime() + DAY);
  const soon = await prisma.coupon.findMany({
    where: { status: "AVAILABLE", expiryDate: { gt: now, lte: in24h } },
    select: { id: true, ownerId: true, title: true },
    take: 500,
  });

  let notified = 0;
  for (const c of soon) {
    const recent = await prisma.notification.findFirst({
      where: {
        userId: c.ownerId,
        type: "COUPON_EXPIRING_SOON",
        referenceId: c.id,
        createdAt: { gt: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
      },
    });
    if (recent) continue;
    await notify(prisma, {
      userId: c.ownerId,
      type: "COUPON_EXPIRING_SOON",
      title: "票券即將過期",
      body: `「${c.title}」將在 24 小時內過期，把握最後機會送出吧`,
      referenceType: "coupon",
      referenceId: c.id,
    });
    notified++;
  }
  return { candidates: soon.length, notified };
}

// Revert PENDING coupons idle > 24h back to AVAILABLE for others to apply.
export async function runPendingTimeout() {
  const cutoff = new Date(Date.now() - DAY);
  const stale = await prisma.coupon.findMany({
    where: { status: "PENDING", updatedAt: { lt: cutoff } },
    select: { id: true, ownerId: true, title: true },
    take: 500,
  });

  for (const c of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id: c.id }, data: { status: "AVAILABLE" } });
      await tx.claimRequest.updateMany({
        where: { couponId: c.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await notify(tx, {
        userId: c.ownerId,
        type: "COUPON_EXPIRING_SOON",
        title: "票券已重新開放申請",
        body: `「${c.title}」的保留時間已到，重新開放給其他人申請`,
        referenceType: "coupon",
        referenceId: c.id,
      });
      await writeAudit(tx, {
        action: "coupon.pending_timeout",
        targetType: "coupon",
        targetId: c.id,
        before: { status: "PENDING" },
        after: { status: "AVAILABLE" },
      });
    });
  }
  return { reverted: stale.length };
}
