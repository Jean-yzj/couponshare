import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { getBearerSession, getCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { LEVELS, nextLevelTarget } from "@/lib/levels";
import { recomputeLevel } from "@/lib/leveling";
import { applyQuota } from "@/lib/share-gate";
import { avatarRef } from "@/lib/serialize";
import { isAdmin } from "@/lib/admin";

export const GET = route(async () => {
  const bearer = await getBearerSession();
  if (bearer.present && !bearer.uid) throw new ApiError("UNAUTHORIZED");

  const user = await getCurrentUser();
  if (!user) return jsonOk({ user: null });

  // This endpoint gates first paint on every page — keep it to one round-trip.
  // Recompute the level here (not just count gifts) so a tier earned via this
  // month's gifts drops back to the score-based tier once the month rolls over,
  // even for users who don't open the score page.
  const [recomputed, quota, ownedBrands] = await Promise.all([
    recomputeLevel(prisma, user.id),
    applyQuota(user),
    prisma.brand.count({ where: { ownerUserId: user.id } }),
  ]);
  const userLevel = recomputed?.level ?? user.userLevel;
  const gifts = recomputed?.monthlyGifts ?? 0;
  const level = LEVELS[userLevel];
  const dailyClaim = user.riskFlag ? Math.max(1, Math.floor(level.dailyClaim / 5)) : level.dailyClaim;

  return jsonOk({
    user: {
      id: user.id,
      display_name: user.displayName,
      avatar_url: avatarRef(user),
      email: user.email,
      login_provider: user.loginProvider,
      user_level: userLevel,
      level_name: level.name,
      contribution_score: user.contributionScore,
      monthly_gifts: gifts,
      risk_flag: user.riskFlag,
      status: user.status,
      is_admin: isAdmin(user),
      is_brand_owner: ownedBrands > 0,
      daily_claim_limit: dailyClaim,
      daily_publish_limit: level.dailyPublish,
      next_level: nextLevelTarget(user.contributionScore, gifts),
      has_shared: quota.hasShared,
      apply_remaining: quota.remaining,
      apply_limit: quota.limit,
      apply_base: quota.base,
      // 本月累積加碼池（社群發文 / 推薦），當月有效、哪天用都行。
      apply_bonus_pool: quota.poolRemaining,
      // Whether publishing one more coupon would actually raise today's limit — so
      // the UI only promises "share for +3" when it's true, not at the hard ceiling.
      apply_can_share_for_more: quota.canShareForMore,
      must_share_first: !quota.hasShared && quota.remaining === 0,
    },
  });
});
