import type { CouponCategory } from "@prisma/client";

export const CATEGORIES: { key: CouponCategory; label: string }[] = [
  { key: "CONVENIENCE", label: "超商" },
  { key: "COFFEE", label: "咖啡" },
  { key: "DRINK", label: "手搖飲" },
  { key: "FASTFOOD", label: "速食" },
  { key: "DESSERT", label: "甜點" },
  { key: "RESTAURANT", label: "餐廳" },
  { key: "SHOPPING", label: "購物" },
  { key: "ENTERTAINMENT", label: "娛樂" },
  { key: "OTHER", label: "其他" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
);

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [CouponCategory, ...CouponCategory[]];
