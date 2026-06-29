import type { Prisma, PrismaClient, UserLevel } from "@prisma/client";
import { computeLevel } from "./levels";
import { startOfMonthTaipei } from "./time";

type Db = PrismaClient | Prisma.TransactionClient;

// Coupons this user has successfully given away (claimed by someone) this month.
export async function monthlyGiftCount(db: Db, userId: string): Promise<number> {
  return db.coupon.count({
    where: { ownerId: userId, status: "CLAIMED", claimedAt: { gte: startOfMonthTaipei() } },
  });
}

// Recompute and persist the user's level from score + monthly activity.
export async function recomputeLevel(
  db: Db,
  userId: string,
): Promise<{ level: UserLevel; monthlyGifts: number } | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { contributionScore: true, userLevel: true, riskFlag: true },
  });
  if (!user) return null;
  const gifts = await monthlyGiftCount(db, userId);
  const level = computeLevel(user.contributionScore, gifts);
  const riskFlag = user.contributionScore < 0;
  if (level !== user.userLevel || riskFlag !== user.riskFlag) {
    await db.user.update({ where: { id: userId }, data: { userLevel: level, riskFlag } });
  }
  return { level, monthlyGifts: gifts };
}
