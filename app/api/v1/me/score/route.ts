import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { LEVELS, nextLevelThreshold } from "@/lib/levels";

export const GET = route(async () => {
  const user = await requireUser();
  const ledger = await prisma.scoreLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const level = LEVELS[user.userLevel];

  return jsonOk({
    contribution_score: user.contributionScore,
    user_level: user.userLevel,
    level_name: level.name,
    risk_flag: user.riskFlag,
    next_level: nextLevelThreshold(user.contributionScore),
    levels: Object.values(LEVELS).map((l) => ({
      key: l.key,
      name: l.name,
      min: l.minScore,
      max: l.maxScore,
      daily_claim: l.dailyClaim,
      daily_publish: l.dailyPublish,
      perks: l.perks,
    })),
    ledger: ledger.map((e) => ({
      id: e.id,
      event_type: e.eventType,
      score_delta: e.scoreDelta,
      reference_type: e.referenceType,
      reference_id: e.referenceId,
      description: e.description,
      created_at: e.createdAt,
    })),
  });
});
