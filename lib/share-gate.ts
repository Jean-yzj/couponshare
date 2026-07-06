import type { User } from "@prisma/client";
import { prisma } from "./db";
import { LEVELS } from "./levels";
import { startOfTodayTaipei, monthKeyTaipei } from "./time";

// Applications a brand-new user gets before they must share their first coupon.
export const FREE_CLAIMS_BEFORE_SHARE = 3;
// Extra applications granted for each coupon shared today.
export const SHARE_BONUS = 3;
// Hard ceiling on applications per day. No amount of sharing or referring can push
// past this — it closes the "publish junk coupons to farm unlimited claims" bypass
// that let a bot grab coupons faster than everyone else.
export const MAX_DAILY_CLAIMS = 15;
// Bonuses only count up to this many shares / referrals per day, so mass-publishing
// or fake-inviting can't inflate the quota before the hard ceiling even applies.
export const MAX_BONUS_SHARES = 3;
export const MAX_BONUS_REFERRALS = 3;
// Minimum gap between two applications from the same user. A human browsing has
// natural gaps; a bot firing the instant a coupon drops gets throttled. Keyed by
// user, not IP, so shared mobile networks (CGNAT) don't punish real people.
export const CLAIM_MIN_INTERVAL_MS = 5_000;

/**
 * Application quota — keeps the coupons flowing.
 *
 *  • Before a user has ever shared: they may apply {@link FREE_CLAIMS_BEFORE_SHARE}
 *    times in total, then must publish a coupon to unlock the daily system.
 *  • After sharing at least once: a daily limit based on their level
 *    (新手 5 / 達人 8 / 傳奇 12), resetting each day (Taipei time).
 *  • Every coupon they publish TODAY grants +{@link SHARE_BONUS} applications for
 *    that day (up to {@link MAX_BONUS_SHARES} coupons), and each invited friend
 *    grants a referral bonus (up to {@link MAX_BONUS_REFERRALS}) — but the total
 *    can never exceed {@link MAX_DAILY_CLAIMS}, so sharing tops up a normal day
 *    without becoming an unlimited-claim exploit.
 *
 * Each submitted application counts (approved / rejected / pending alike).
 */
export async function applyQuota(user: User) {
  const dayStart = startOfTodayTaipei();
  const [publishedEver, publishedToday, totalApplied, appliedToday] = await Promise.all([
    prisma.auditLog.count({ where: { actorId: user.id, action: "coupon.publish" } }),
    prisma.auditLog.count({
      where: { actorId: user.id, action: "coupon.publish", createdAt: { gte: dayStart } },
    }),
    prisma.claimRequest.count({ where: { requesterId: user.id } }),
    prisma.claimRequest.count({ where: { requesterId: user.id, createdAt: { gte: dayStart } } }),
  ]);

  const hasShared = publishedEver > 0;
  const base = user.riskFlag
    ? Math.max(1, Math.floor(LEVELS[user.userLevel].dailyClaim / 5))
    : LEVELS[user.userLevel].dailyClaim;

  // Monthly bonus pool (社群發文審核通過 +10 一次/月、推薦成功 +2/人). Counts only
  // while it belongs to the current Taipei month; a balance stamped with a past
  // month reads as zero (it resets lazily on the next grant). The pool tops up the
  // daily quota but never lifts the hard daily ceiling — a big pool still can't grab
  // more than MAX_DAILY_CLAIMS in one day, so it can't become a burst exploit.
  const poolRemaining =
    user.bonusClaimsMonth === monthKeyTaipei() ? Math.max(0, user.bonusClaims) : 0;

  if (!hasShared) {
    // Onboarding: a lifetime allowance of 3 until the first share. Pool credits earned
    // now (e.g. from referrals) accrue but only unlock once they've shared — this keeps
    // the share-first gate intact rather than letting the pool bypass it.
    const limit = Math.min(FREE_CLAIMS_BEFORE_SHARE, MAX_DAILY_CLAIMS);
    const remaining = Math.max(0, limit - totalApplied);
    return {
      hasShared,
      base,
      limit,
      used: totalApplied,
      remaining,
      bonusToday: 0,
      dailyAllowance: limit,
      poolRemaining,
      mustShare: remaining === 0,
      canShareForMore: false,
    };
  }

  // Free daily allowance: level base + today's capped share bonus, under the ceiling.
  const shareBonus = SHARE_BONUS * Math.min(publishedToday, MAX_BONUS_SHARES);
  const dailyAllowance = Math.min(base + shareBonus, MAX_DAILY_CLAIMS);
  // The monthly pool extends the day's limit but is still clamped to the ceiling.
  const limit = Math.min(dailyAllowance + poolRemaining, MAX_DAILY_CLAIMS);
  const remaining = Math.max(0, limit - appliedToday);
  // Only true when publishing one more coupon would actually raise the limit — so we
  // never promise "share for +3" once the share bonus or the hard ceiling is maxed.
  const canShareForMore = dailyAllowance < MAX_DAILY_CLAIMS && publishedToday < MAX_BONUS_SHARES;
  return {
    hasShared,
    base,
    limit,
    used: appliedToday,
    remaining,
    bonusToday: shareBonus,
    dailyAllowance,
    poolRemaining,
    mustShare: remaining === 0,
    canShareForMore,
  };
}
