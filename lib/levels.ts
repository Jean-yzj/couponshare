import type { UserLevel } from "@prisma/client";

// Promotion is reached by EITHER lifetime contribution score OR this-month's
// successful gifts (whichever qualifies you for the higher tier). Activity path
// lets active newcomers level up without grinding score. PRD §8.2 + user request.
export const LEVELS: Record<
  UserLevel,
  {
    key: UserLevel;
    name: string;
    label: string;
    minScore: number;
    maxScore: number | null;
    monthlyGifts: number; // gifts-this-month that also unlocks this tier
    dailyClaim: number;
    dailyPublish: number;
    perks: string[];
  }
> = {
  LEVEL_1: {
    key: "LEVEL_1",
    name: "新手",
    label: "Newcomer",
    minScore: 0,
    maxScore: 49,
    monthlyGifts: 0,
    dailyClaim: 5,
    dailyPublish: 3,
    perks: ["瀏覽並申請公開票券", "自由上架你的票券，不限張數", "每日可申請 5 張"],
  },
  LEVEL_2: {
    key: "LEVEL_2",
    name: "達人",
    label: "Pro",
    minScore: 50,
    maxScore: 149,
    monthlyGifts: 5,
    dailyClaim: 8,
    dailyPublish: 5,
    perks: [
      "每日可申請 8 張",
      "可申請「達人限定」票券",
      "提前瀏覽熱門品牌票券",
      "收藏品牌篩選條件",
    ],
  },
  LEVEL_3: {
    key: "LEVEL_3",
    name: "傳奇",
    label: "Legend",
    minScore: 150,
    maxScore: null,
    monthlyGifts: 20,
    dailyClaim: 12,
    dailyPublish: 8,
    perks: ["每日可申請 12 張", "可申請「傳奇限定」票券", "品牌到貨提醒", "專屬傳奇徽章"],
  },
};

export const LEVEL_ORDER: UserLevel[] = ["LEVEL_1", "LEVEL_2", "LEVEL_3"];

export function computeLevel(score: number, monthlyGifts: number): UserLevel {
  if (score >= LEVELS.LEVEL_3.minScore || monthlyGifts >= LEVELS.LEVEL_3.monthlyGifts) return "LEVEL_3";
  if (score >= LEVELS.LEVEL_2.minScore || monthlyGifts >= LEVELS.LEVEL_2.monthlyGifts) return "LEVEL_2";
  return "LEVEL_1";
}

// What it takes to reach the next tier (either path). Null at max level.
export function nextLevelTarget(
  score: number,
  monthlyGifts: number,
): { level: UserLevel; name: string; needScore: number; needGifts: number } | null {
  const cur = computeLevel(score, monthlyGifts);
  if (cur === "LEVEL_3") return null;
  const target = cur === "LEVEL_1" ? LEVELS.LEVEL_2 : LEVELS.LEVEL_3;
  return {
    level: target.key,
    name: target.name,
    needScore: Math.max(0, target.minScore - score),
    needGifts: Math.max(0, target.monthlyGifts - monthlyGifts),
  };
}
