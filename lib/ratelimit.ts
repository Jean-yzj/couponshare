import type { User } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./errors";
import { LEVELS } from "./levels";
import { startOfTodayTaipei } from "./time";

// PRD §8.2 daily limits. Risk-flagged users get a sharply reduced claim quota (§10.3).
export async function assertDailyClaimLimit(user: User): Promise<void> {
  const base = LEVELS[user.userLevel].dailyClaim;
  const limit = user.riskFlag ? Math.max(1, Math.floor(base / 5)) : base;
  const count = await prisma.claimRequest.count({
    where: { requesterId: user.id, createdAt: { gte: startOfTodayTaipei() } },
  });
  if (count >= limit) throw new ApiError("DAILY_CLAIM_LIMIT_EXCEEDED", { limit });
}

export async function assertDailyPublishLimit(user: User): Promise<void> {
  const limit = LEVELS[user.userLevel].dailyPublish;
  // Count actual publish events today (audit log), not coupon creation — otherwise
  // a user could pre-create a pile of drafts and bulk-publish them tomorrow to slip
  // past the daily cap (their createdAt is "yesterday", so it wouldn't be counted).
  const count = await prisma.auditLog.count({
    where: {
      actorId: user.id,
      action: "coupon.publish",
      createdAt: { gte: startOfTodayTaipei() },
    },
  });
  if (count >= limit) throw new ApiError("DAILY_PUBLISH_LIMIT_EXCEEDED", { limit });
}
