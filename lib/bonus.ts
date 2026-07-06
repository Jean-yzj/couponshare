import type { Prisma, PrismaClient } from "@prisma/client";
import { monthKeyTaipei } from "./time";

type Db = PrismaClient | Prisma.TransactionClient;

// Grant claim-attempts into a user's monthly bonus pool. The pool is scoped to a
// Taipei calendar month: if the stored month is stale (or never set), it's reset
// to zero and re-stamped before the grant, so credits never carry across months.
// (社群發文審核通過 +10 一次/月、推薦成功 +2/人 — 都進這個池，當月有效、月底歸零。)
export async function grantBonusClaims(db: Db, userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const month = monthKeyTaipei();
  // Reset + stamp only when the balance belongs to a previous month (or was unset),
  // then add the grant. Two statements, no read — safe for these infrequent grants.
  await db.user.updateMany({
    where: { id: userId, OR: [{ bonusClaimsMonth: null }, { bonusClaimsMonth: { not: month } }] },
    data: { bonusClaims: 0, bonusClaimsMonth: month },
  });
  await db.user.update({
    where: { id: userId },
    data: { bonusClaims: { increment: amount } },
  });
}
