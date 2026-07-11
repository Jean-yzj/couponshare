import type { Metadata } from "next";
import { BusinessLanding } from "@/components/BusinessLanding";

// 企業合作方案介紹＋洽詢窗口。Lives under the main domain (/business) but stays out
// of the nav and sitemap, and is noindexed — it's a B2B sales page handed out via
// direct link, not something regular users or search should surface.
const OG_TITLE = "CouponShare 企業合作 · 官方福利券投放";
const OG_DESC =
  "讓你的優惠被真正想領券的人看到。用官方福利券投放優惠，可設申請名額、追蹤申請與領取成效，歡迎一起聊聊合作方式。";

// noindex (a B2B sales page handed out by link, not for search), but with proper
// OG/Twitter so the link preview reads as an enterprise page, not the consumer app.
export const metadata: Metadata = {
  title: "企業合作方案",
  description: OG_DESC,
  robots: { index: false, follow: false },
  openGraph: { title: OG_TITLE, description: OG_DESC, type: "website" },
  twitter: { card: "summary_large_image", title: OG_TITLE, description: OG_DESC },
};

export default function BusinessPage() {
  return <BusinessLanding />;
}
