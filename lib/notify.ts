import type { Prisma, PrismaClient, NotificationType } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function notify(
  db: Db,
  args: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    referenceType?: string;
    referenceId?: string;
  },
): Promise<void> {
  await db.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
    },
  });
}
