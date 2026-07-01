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

// Per-category colour theme for coupon cards (grad = brand disc, tint = header
// background, solid = type pill, text = category label). Hex values because these
// aren't all design tokens. 速食紅 / 咖啡棕 / 飲料黃 / 超商綠 …
export const CATEGORY_STYLE: Record<
  string,
  { grad: string; tint: string; solid: string; text: string }
> = {
  CONVENIENCE: { grad: "linear-gradient(135deg,#4bd88f,#0f9d57)", tint: "#e4f7ed", solid: "#0f9d57", text: "#0b7a46" },
  COFFEE: { grad: "linear-gradient(135deg,#c39a72,#7c5334)", tint: "#f1e8df", solid: "#875f3b", text: "#6b4423" },
  DRINK: { grad: "linear-gradient(135deg,#ffcf4d,#e0a010)", tint: "#fdf3d6", solid: "#c98f10", text: "#a9760a" },
  FASTFOOD: { grad: "linear-gradient(135deg,#ff6f5e,#e5322a)", tint: "#fde7e5", solid: "#e5322a", text: "#c62a22" },
  DESSERT: { grad: "linear-gradient(135deg,#ff9ec4,#ec4b82)", tint: "#fdeaf2", solid: "#ec4b82", text: "#c73e6e" },
  RESTAURANT: { grad: "linear-gradient(135deg,#ffb066,#ef7d1f)", tint: "#fdefdf", solid: "#ef7d1f", text: "#c26410" },
  SHOPPING: { grad: "linear-gradient(135deg,#5aa6ff,#1f7bff)", tint: "#e7f0ff", solid: "#1f7bff", text: "#0e60c0" },
  ENTERTAINMENT: { grad: "linear-gradient(135deg,#a88fff,#7a5cf0)", tint: "#ece7fe", solid: "#7a5cf0", text: "#5a3fd0" },
  OTHER: { grad: "linear-gradient(135deg,#a0adc7,#6b7a99)", tint: "#eef1f7", solid: "#6b7a99", text: "#556085" },
};

export function categoryStyle(cat?: string | null) {
  return (cat && CATEGORY_STYLE[cat]) || CATEGORY_STYLE.OTHER;
}
