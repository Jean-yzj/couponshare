import { route, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { LEVELS, nextLevelThreshold } from "@/lib/levels";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return jsonOk({ user: null });

  const level = LEVELS[user.userLevel];
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
      risk_flag: user.riskFlag,
      status: user.status,
      daily_claim_limit: user.riskFlag ? Math.max(1, Math.floor(level.dailyClaim / 5)) : level.dailyClaim,
      daily_publish_limit: level.dailyPublish,
      next_level: nextLevelThreshold(user.contributionScore),
    },
  });
});
