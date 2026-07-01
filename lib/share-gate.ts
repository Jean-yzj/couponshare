import { prisma } from "@/lib/db";

// Number of applications a brand-new user may make before they must share.
export const FREE_CLAIMS_BEFORE_SHARE = 3;

/**
 * Goodwill gate — keeps the coupons flowing.
 *
 * A brand-new user who has never shared a coupon may apply a few times, then
 * must publish one coupon of their own before applying again. The moment they
 * have published even a single coupon, this gate lifts permanently (so it only
 * ever nudges people at the very beginning).
 */
export async function shareGate(userId: string) {
  const [publishedCount, appliedCount] = await Promise.all([
    // "Published" = any coupon that left DRAFT (they shared it with others).
    prisma.coupon.count({ where: { ownerId: userId, status: { not: "DRAFT" } } }),
    prisma.claimRequest.count({ where: { requesterId: userId } }),
  ]);
  const hasPublished = publishedCount > 0;
  const mustShareFirst = !hasPublished && appliedCount >= FREE_CLAIMS_BEFORE_SHARE;
  return { hasPublished, appliedCount, mustShareFirst };
}
