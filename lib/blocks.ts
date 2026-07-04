import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function blockedUserIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return Array.from(new Set(rows.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId))));
}

export async function hasBlockBetween(db: Db, a: string, b: string): Promise<boolean> {
  const count = await db.block.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return count > 0;
}
