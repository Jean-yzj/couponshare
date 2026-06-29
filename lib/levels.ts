import type { UserLevel } from "@prisma/client";

// PRD §8.2 + §10.3
export const LEVELS: Record<
  UserLevel,
  {
    key: UserLevel;
    name: string;
    label: string;
    minScore: number;
    maxScore: number | null;
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
    maxScore: 20,
    dailyClaim: 5,
    dailyPublish: 3,
    perks: ["瀏覽一般票券", "申請領取", "上傳與上架票券"],
  },
  LEVEL_2: {
    key: "LEVEL_2",
    name: "達人",
    label: "Pro",
    minScore: 21,
    maxScore: 100,
    dailyClaim: 10,
    dailyPublish: 10,
    perks: ["提前瀏覽熱門品牌票券", "收藏品牌篩選條件", "更高的每日上限"],
  },
  LEVEL_3: {
    key: "LEVEL_3",
    name: "傳奇",
    label: "Legend",
    minScore: 101,
    maxScore: null,
    dailyClaim: 20,
    dailyPublish: 20,
    perks: ["設定品牌提醒", "專屬傳奇徽章", "最高的每日上限"],
  },
};

export const LEVEL_ORDER: UserLevel[] = ["LEVEL_1", "LEVEL_2", "LEVEL_3"];

export function levelFromScore(score: number): UserLevel {
  if (score >= 101) return "LEVEL_3";
  if (score >= 21) return "LEVEL_2";
  return "LEVEL_1";
}

// Next level threshold, or null at max.
export function nextLevelThreshold(score: number): { level: UserLevel; at: number } | null {
  if (score < 21) return { level: "LEVEL_2", at: 21 };
  if (score < 101) return { level: "LEVEL_3", at: 101 };
  return null;
}
