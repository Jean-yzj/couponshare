import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { feedCoupon, transactionView } from "@/lib/serialize";
import { couponCardSelect, txnSelect } from "@/lib/selects";

// Backs the "My Wallet" page — listed / applied / received / transactions.
// SELECT whitelists (never the barcode blobs) + take caps keep the response small
// even for heavy contributors.
export const GET = route(async () => {
  const user = await requireUser();

  const [listed, applied, received, transactions] = await Promise.all([
    prisma.coupon.findMany({
      where: { ownerId: user.id },
      select: couponCardSelect,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.claimRequest.findMany({
      where: { requesterId: user.id },
      select: {
        id: true,
        status: true,
        requestType: true,
        message: true,
        createdAt: true,
        coupon: { select: couponCardSelect },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.coupon.findMany({
      where: { claimantId: user.id, status: "CLAIMED" },
      select: couponCardSelect,
      orderBy: { claimedAt: "desc" },
      take: 50,
    }),
    prisma.transaction.findMany({
      where: { OR: [{ ownerId: user.id }, { claimantId: user.id }] },
      select: txnSelect,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return jsonOk({
    listed: listed.map((c) => feedCoupon(c)),
    applied: applied.map((cr) => ({
      id: cr.id,
      status: cr.status,
      request_type: cr.requestType,
      message: cr.message,
      created_at: cr.createdAt,
      coupon: feedCoupon(cr.coupon),
    })),
    received: received.map((c) => feedCoupon(c)),
    transactions: transactions.map((t) => transactionView(t, user.id)),
  });
});
