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

  const ownerRating = await ratingSummary(prisma, coupon.ownerId);
  return jsonOk({ ...couponDetail(coupon, viewer), owner_rating: ownerRating });
});
