import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { notify } from "@/lib/notify";

// Expiring Soon Notification Job — PRD §12.2. Runs hourly.
async function run(req: NextRequest) {
  assertCron(req);
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const soon = await prisma.coupon.findMany({
    where: { status: "AVAILABLE", expiryDate: { gt: now, lte: in24h } },
    select: { id: true, ownerId: true, title: true },
  });

  let notified = 0;
  for (const c of soon) {
    // De-dupe: skip if we already warned about this coupon in the last 20h.
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

  return jsonOk({ candidates: soon.length, notified });
}

export const GET = route(run);
export const POST = route(run);
