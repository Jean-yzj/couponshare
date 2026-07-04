import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { feedCoupon, transactionView } from "@/lib/serialize";
import { ensureRanks } from "@/lib/ranks";

// Backs the "My Wallet" page — listed / applied / received / transactions.
export const GET = route(async () => {
  const user = await requireUser();
  await ensureRanks(); // top-3 cache for rank badges

  const [listed, applied, received, transactions] = await Promise.all([
    prisma.coupon.findMany({
      where: { ownerId: user.id },
      include: { owner: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.claimRequest.findMany({
      where: { requesterId: user.id },
      include: { coupon: { include: { owner: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.coupon.findMany({
      where: { claimantId: user.id, status: "CLAIMED" },
      include: { owner: true },
      orderBy: { claimedAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { OR: [{ ownerId: user.id }, { claimantId: user.id }] },
      include: { coupon: true, owner: true, claimant: true, ratings: true },
      orderBy: { createdAt: "desc" },
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
