import type { Metadata } from "next";
import { BusinessLanding } from "@/components/BusinessLanding";

// 企業合作方案介紹＋洽詢窗口。Lives under the main domain (/business) but stays out
// of the nav and sitemap, and is noindexed — it's a B2B sales page handed out via
// direct link, not something regular users or search should surface.
export const metadata: Metadata = {
  title: "企業合作方案 — CouponShare",
  description: "把品牌優惠以官方福利券的形式，放進使用者本來就在找券的地方。可設申請名額、追蹤申請與領取成效。",
  robots: { index: false, follow: false },
};

export default function BusinessPage() {
  return <BusinessLanding />;
}
