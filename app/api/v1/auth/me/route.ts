import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { LEVELS, nextLevelTarget } from "@/lib/levels";
import { monthlyGiftCount } from "@/lib/leveling";
import { applyQuota } from "@/lib/share-gate";
import { isAdmin } from "@/lib/admin";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return jsonOk({ user: null });

  const gifts = await monthlyGiftCount(prisma, user.id);
  const quota = await applyQuota(user);
  const level = LEVELS[user.userLevel];
  const dailyClaim = user.riskFlag ? Math.max(1, Math.floor(level.dailyClaim / 5)) : level.dailyClaim;

  return jsonOk({
    user: {
      id: user.id,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      email: user.email,
      login_provider: user.loginProvider,
      user_level: user.userLevel,
      level_name: level.name,
      contribution_score: user.contributionScore,
      monthly_gifts: gifts,
      risk_flag: user.riskFlag,
      status: user.status,
      is_admin: isAdmin(user),
      daily_claim_limit: dailyClaim,
      daily_publish_limit: level.dailyPublish,
      next_level: nextLevelTarget(user.contributionScore, gifts),
      has_shared: quota.hasShared,
      apply_remaining: quota.remaining,
      apply_limit: quota.limit,
      apply_base: quota.base,
      must_share_first: !quota.hasShared && quota.remaining === 0,
    },
  });
});
