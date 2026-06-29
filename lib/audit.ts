import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function writeAudit(
  db: Db,
  entry: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
    ua?: string | null;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      beforeValue: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterValue: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: entry.ip ?? null,
      userAgent: entry.ua ?? null,
    },
  });
}
