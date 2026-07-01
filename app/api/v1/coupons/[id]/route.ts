import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth";
import { couponDetail } from "@/lib/serialize";
import { ratingSummary } from "@/lib/ratings";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();

  const coupon = await prisma.coupon.findUnique({ where: { id }, include: { owner: true } });
  if (!coupon) throw new ApiError("COUPON_NOT_FOUND");

  if (viewer && viewer.id !== coupon.ownerId) {
    await prisma.coupon
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  }

  // Surface the viewer's own claim-request status so the page can show
  // "已送出申請 / 已獲得" instead of the apply button. PRD §7.2.
  let myRequestStatus = null;
  let myRequestId: string | null = null;
  if (viewer && viewer.id !== coupon.ownerId) {
    const cr = await prisma.claimRequest.findUnique({
      where: { couponId_requesterId: { couponId: id, requesterId: viewer.id } },
      select: { id: true, status: true },
    });
    myRequestStatus = cr?.status ?? null;
    myRequestId = cr?.id ?? null;
  }

  const ownerRating = await ratingSummary(prisma, coupon.ownerId);
  return jsonOk({
    ...couponDetail(coupon, viewer, myRequestStatus),
    owner_rating: ownerRating,
    my_request_id: myRequestId,
  });
});
