import type { MetadataRoute } from "next";

const SITE = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep private / admin / API surfaces out of the index.
        disallow: ["/api/", "/admin", "/wallet", "/score", "/notifications", "/settings", "/transactions", "/new"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
