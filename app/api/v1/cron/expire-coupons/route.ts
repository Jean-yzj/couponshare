import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// Expire Coupons Job — PRD §12.1. Runs every ~10 min.
async function run(req: NextRequest) {
  assertCron(req);
  const now = new Date();

  const expiring = await prisma.coupon.findMany({
    where: { status: { in: ["AVAILABLE", "PENDING"] }, expiryDate: { lt: now } },
    select: { id: true, ownerId: true, title: true, status: true },
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

  // Phase 2: auto-delist coupons that got zero applications after 7 days on the
  // shelf. Stops the feed filling with dead coupons — especially no-expiry ones
  // that would otherwise live forever. Owner is notified so they can re-share.
  const STALE_DAYS = 7;
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 86_400_000);
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

  return jsonOk({ expired: expiring.length, delisted_stale: stale.length });
}

export const GET = route(run);
export const POST = route(run);
