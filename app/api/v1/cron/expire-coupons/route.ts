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

  return jsonOk({ expired: expiring.length });
}

export const GET = route(run);
export const POST = route(run);
