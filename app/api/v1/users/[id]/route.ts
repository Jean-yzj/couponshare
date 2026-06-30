import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { feedCoupon } from "@/lib/serialize";
import { ratingSummary } from "@/lib/ratings";
import { LEVELS } from "@/lib/levels";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.status === "DELETED") throw new ApiError("NOT_FOUND");

  const [summary, ratings, coupons, giftsGiven] = await Promise.all([
    ratingSummary(prisma, id),
    prisma.rating.findMany({
      where: { toUserId: id },
      include: { fromUser: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.coupon.findMany({
      where: {
        ownerId: id,
        status: "AVAILABLE",
        expiryDate: { gt: new Date() },
        visibilityLevel: "PUBLIC",
      },
      include: { owner: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.coupon.count({ where: { ownerId: id, status: "CLAIMED" } }),
  ]);

  return jsonOk({
    user: {
      id: user.id,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      user_level: user.userLevel,
      level_name: LEVELS[user.userLevel].name,
      contribution_score: user.contributionScore,
      created_at: user.createdAt,
      status: user.status,
    },
    rating: {
      avg: summary.avg,
      count: summary.count,
      items: ratings.map((r) => ({
        from: r.fromUser
          ? { display_name: r.fromUser.displayName, avatar_url: r.fromUser.avatarUrl }
          : null,
        rating_score: r.ratingScore,
        tags: r.tags,
        comment: r.comment,
        created_at: r.createdAt,
      })),
    },
    gifts_given: giftsGiven,
    coupons: coupons.map(feedCoupon),
  });
});
