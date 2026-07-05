import type { User } from "@prisma/client";
import { prisma } from "./db";

// Exchange is the one flow where BOTH sides hand over a barcode, so a throwaway
// account can actually scam someone. Require a little history before exchanging:
// either the account is a few days old, or it has earned real contribution score.
// Contribution is earned by GIVING (COUPON_GIFTED +10, positive ratings, thank-yous)
// — merely *receiving* free gifts grants none, so a scammer can't farm the bar by
// claiming freebies. Gifting and claiming stay open to everyone; only exchange gates.
export const EXCHANGE_MIN_AGE_DAYS = 3;
export const EXCHANGE_MIN_SCORE = 10; // one gifted coupon's worth

export function canExchange(user: Pick<User, "createdAt" | "contributionScore">): boolean {
  const ageMs = Date.now() - user.createdAt.getTime();
  if (ageMs >= EXCHANGE_MIN_AGE_DAYS * 24 * 60 * 60 * 1000) return true;
  return user.contributionScore >= EXCHANGE_MIN_SCORE;
}

export type UserTrust = {
  joined_days_ago: number;
  completed_count: number;
  rating_avg: number | null;
  rating_count: number;
  is_new: boolean; // young account with no track record → show a caution
};

// Public trust signals for a counterpart, so a user can judge who they're dealing
// with before committing to an exchange. Only positive / neutral facts (join age,
// completed deals, star rating) — never raw report counts, which a false report
// could weaponise into public defamation.
export async function getUserTrust(userId: string): Promise<UserTrust | null> {
  const [user, completedCount, ratingAgg] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.transaction.count({
      where: { status: "COMPLETED", OR: [{ ownerId: userId }, { claimantId: userId }] },
    }),
    prisma.rating.aggregate({
      where: { toUserId: userId },
      _avg: { ratingScore: true },
      _count: true,
    }),
  ]);
  if (!user) return null;
  const joinedDaysAgo = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);
  return {
    joined_days_ago: joinedDaysAgo,
    completed_count: completedCount,
    rating_avg: ratingAgg._avg.ratingScore,
    rating_count: ratingAgg._count,
    is_new: joinedDaysAgo < EXCHANGE_MIN_AGE_DAYS && completedCount === 0,
  };
}
