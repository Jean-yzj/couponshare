import type { Metadata } from "next";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";

// 企業合作窗口 — reached only via a link the founder hands out (external pitch
// site / DM). Not in the nav, not in the sitemap, and noindexed so regular users
// and search engines never stumble in.
export const metadata: Metadata = {
  title: "企業合作窗口 — CouponShare",
  robots: { index: false, follow: false },
};

export default function BusinessPage() {
  return <BusinessLeadForm />;
}
