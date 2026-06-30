import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// A user's reputation from ratings they have received.
export async function ratingSummary(
  db: Db,
  userId: string,
): Promise<{ avg: number | null; count: number }> {
  const agg = await db.rating.aggregate({
    where: { toUserId: userId },
    _avg: { ratingScore: true },
    _count: true,
  });
  return { avg: agg._avg.ratingScore, count: agg._count };
}
