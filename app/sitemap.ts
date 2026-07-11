import type { MetadataRoute } from "next";

const SITE = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");

// Public, indexable pages. Coupon/user pages are excluded on purpose: they churn
// fast (7-day auto-delist) and many need auth, so they'd bloat the sitemap.
// Bump when these pages' content actually changes, instead of faking `new Date()`
// on every request. /login is intentionally excluded — it's not an SEO landing page.
const LAST_UPDATED = new Date("2026-07-12T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, lastModified: LAST_UPDATED, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/terms`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
}
