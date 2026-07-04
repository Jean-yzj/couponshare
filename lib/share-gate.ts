import type { User } from "@prisma/client";
import { prisma } from "./db";
import { LEVELS } from "./levels";
import { startOfTodayTaipei } from "./time";
import { REFERRAL_BONUS } from "./referral";

// Applications a brand-new user gets before they must share their first coupon.
export const FREE_CLAIMS_BEFORE_SHARE = 3;
// Extra applications granted for each coupon shared today.
export const SHARE_BONUS = 3;

/**
 * Application quota — keeps the coupons flowing.
 *
 *  • Before a user has ever shared: they may apply {@link FREE_CLAIMS_BEFORE_SHARE}
 *    times in total, then must publish a coupon to unlock the daily system.
 *  • After sharing at least once: a daily limit based on their level
 *    (新手 5 / 達人 8 / 傳奇 12), resetting each day (Taipei time).
 *  • Every coupon they publish TODAY grants +{@link SHARE_BONUS} applications for
 *    that day — so when the daily limit is full, sharing tops it up.
 *
 * Each submitted application counts (approved / rejected / pending alike).
 */
export async function applyQuota(user: User) {
  const dayStart = startOfTodayTaipei();
  const [publishedEver, publishedToday, totalApplied, appliedToday, referralsToday] =
    await Promise.all([
      prisma.auditLog.count({ where: { actorId: user.id, action: "coupon.publish" } }),
      prisma.auditLog.count({
        where: { actorId: user.id, action: "coupon.publish", createdAt: { gte: dayStart } },
      }),
      prisma.claimRequest.count({ where: { requesterId: user.id } }),
      prisma.claimRequest.count({ where: { requesterId: user.id, createdAt: { gte: dayStart } } }),
      // Friends who signed up through this user's invite link today → bonus claims.
      prisma.user.count({ where: { referredById: user.id, createdAt: { gte: dayStart } } }),
    ]);

  const hasShared = publishedEver > 0;
  const referralBonus = REFERRAL_BONUS * referralsToday;
  const base = user.riskFlag
    ? Math.max(1, Math.floor(LEVELS[user.userLevel].dailyClaim / 5))
    : LEVELS[user.userLevel].dailyClaim;

  if (!hasShared) {
    // Onboarding phase: a lifetime allowance of 3 until the first share, plus any
    // invite bonus earned today (a temporary top-up on top of the lifetime three).
    const limit = FREE_CLAIMS_BEFORE_SHARE + referralBonus;
    const remaining = Math.max(0, limit - totalApplied);
    return {
      hasShared,
      base,
      limit,
      used: totalApplied,
      remaining,
      bonusToday: referralBonus,
      mustShare: remaining === 0,
    };
  }

  const bonusToday = SHARE_BONUS * publishedToday + referralBonus;
  const limit = base + bonusToday;
  const remaining = Math.max(0, limit - appliedToday);
  return { hasShared, base, limit, used: appliedToday, remaining, bonusToday, mustShare: remaining === 0 };
}
