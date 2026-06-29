import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { LEVELS, nextLevelTarget } from "@/lib/levels";
import { recomputeLevel } from "@/lib/leveling";
import { SCORE_RULES } from "@/lib/score";

// How to earn / lose contribution points — surfaced so users know exactly what to do.
const EARN_RULES = [
  { label: "成功送出一張票券", delta: SCORE_RULES.COUPON_GIFTED, icon: "gift" },
  { label: "成功交換一張票券", delta: SCORE_RULES.COUPON_EXCHANGED, icon: "swap" },
  { label: "收到 4 星以上好評", delta: SCORE_RULES.POSITIVE_RATING, icon: "star" },
  { label: "領取後留下感謝訊息", delta: SCORE_RULES.THANK_YOU_MESSAGE, icon: "heart" },
];
const PENALTY_RULES = [
  { label: "被確認提供無效券", delta: SCORE_RULES.INVALID_COUPON_REPORT_CONFIRMED, icon: "flag" },
  { label: "被確認惡意放鳥", delta: SCORE_RULES.NO_SHOW_REPORT_CONFIRMED, icon: "flag" },
  { label: "被確認惡意訊息或騷擾", delta: SCORE_RULES.ABUSE_CONFIRMED, icon: "ban" },
];

export const GET = route(async () => {
  const user = await requireUser();
  const recomputed = await recomputeLevel(prisma, user.id);
  const userLevel = recomputed?.level ?? user.userLevel;
  const monthlyGifts = recomputed?.monthlyGifts ?? 0;

  const ledger = await prisma.scoreLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const level = LEVELS[userLevel];

  return jsonOk({
    contribution_score: user.contributionScore,
    user_level: userLevel,
    level_name: level.name,
    risk_flag: user.contributionScore < 0,
    monthly_gifts: monthlyGifts,
    next_level: nextLevelTarget(user.contributionScore, monthlyGifts),
    earn_rules: EARN_RULES,
    penalty_rules: PENALTY_RULES,
    levels: Object.values(LEVELS).map((l) => ({
      key: l.key,
      name: l.name,
      label: l.label,
      min_score: l.minScore,
      max_score: l.maxScore,
      monthly_gifts: l.monthlyGifts,
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
