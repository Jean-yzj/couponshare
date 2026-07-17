import type { CouponCategory, CouponRedeemKind } from "@prisma/client";

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

// 券內容維度，和品牌分類 category 正交：這張券給的是「免費換一份東西」還是
// 「消費折抵」。舊券沒有這個欄位（null），顯示與篩選都當成「未標示」。
export const REDEEM_KINDS: { key: CouponRedeemKind; label: string; hint: string }[] = [
  { key: "FREE_ITEM", label: "免費兌換", hint: "憑券免費換一份商品，不用再消費" },
  { key: "DISCOUNT", label: "折價券", hint: "消費時折抵金額或比例" },
  { key: "BOGO", label: "買一送一", hint: "買一送一、第二件優惠，需要消費" },
];

export const REDEEM_KIND_LABEL: Record<string, string> = Object.fromEntries(
  REDEEM_KINDS.map((r) => [r.key, r.label]),
);

export const REDEEM_KIND_KEYS = REDEEM_KINDS.map((r) => r.key) as [
  CouponRedeemKind,
  ...CouponRedeemKind[],
];

// Small pill on cards / detail. 免費兌換=綠、折價券=橘、買一送一=紫，和 category 色系不搶。
export const REDEEM_KIND_STYLE: Record<string, { tint: string; text: string }> = {
  FREE_ITEM: { tint: "#e4f7ed", text: "#0b7a46" },
  DISCOUNT: { tint: "#fdefdf", text: "#c26410" },
  BOGO: { tint: "#ece7fe", text: "#5a3fd0" },
};
