import type { Prisma, PrismaClient, ScoreEventType, ScoreReferenceType } from "@prisma/client";
import { recomputeLevel } from "./leveling";

type Db = PrismaClient | Prisma.TransactionClient;

// PRD §10.1
export const SCORE_RULES = {
  COUPON_GIFTED: 10,
  COUPON_EXCHANGED: 5,
  THANK_YOU_MESSAGE: 2,
  POSITIVE_RATING: 3,
  COUPON_WITHDRAWN: -5,
  INVALID_COUPON_REPORT_CONFIRMED: -20,
  NO_SHOW_REPORT_CONFIRMED: -20,
  ABUSE_CONFIRMED: -30,
} as const;

// Phase 1: first-share bonus (+2). Uses ADMIN_ADJUSTMENT event type (the
// schema's catch-all for special one-off bonuses) with referenceType=ADMIN and
// referenceId=userId so the unique constraint guarantees it fires once per user.
export const FIRST_SHARE_DELTA = 2;
export const FIRST_SHARE_DESCRIPTION = "初次分享";

// Idempotent score mutation. Always writes a ledger row first, then syncs the
// cached contribution_score + user_level. Safe to call inside a transaction.
export async function applyScore(
  db: Db,
  args: {
    userId: string;
    eventType: ScoreEventType;
    delta: number;
    referenceType: ScoreReferenceType;
    referenceId: string;
    description?: string;
  },
): Promise<void> {
  const existing = await db.scoreLedger.findUnique({
    where: {
      userId_eventType_referenceType_referenceId: {
        userId: args.userId,
        eventType: args.eventType,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
      },
    },
  });
  if (existing) return; // already applied — idempotent

  await db.scoreLedger.create({
    data: {
      userId: args.userId,
      eventType: args.eventType,
      scoreDelta: args.delta,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      description: args.description,
    },
  });

  await db.user.update({
    where: { id: args.userId },
    data: { contributionScore: { increment: args.delta } },
  });

  await recomputeLevel(db, args.userId);
}
