import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";

// Pending Timeout Job — PRD §12.3. Reverts PENDING coupons idle > 24h.
async function run(req: NextRequest) {
  assertCron(req);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stale = await prisma.coupon.findMany({
    where: { status: "PENDING", updatedAt: { lt: cutoff } },
    select: { id: true, ownerId: true, title: true },
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

  return jsonOk({ reverted: stale.length });
}

export const GET = route(run);
export const POST = route(run);
