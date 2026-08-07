import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const SITE = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");

// 靜態頁的更新時間手動維護——內容真的改了才動，不要每次請求都塞 new Date()，
// 那會讓搜尋引擎學會忽略這個欄位。
const LAST_UPDATED = new Date("2026-08-05T00:00:00Z");

// 券頁原本被刻意排除，理由是「churn 快、多數需登入」。前者成立但不是排除的
// 理由（sitemap 本來就允許 URL 消失），後者是誤解——券詳情的 GET 走的是
// getCurrentUser() 不是 requireUser()，未登入拿得到公開券。
//
// 排除它們的實際代價：全站只有 3 個 URL 進得了索引，等於整個平台最有搜尋價值的
// 內容（每張券都是一組具體的品牌＋優惠關鍵字）對搜尋引擎完全不存在。
const COUPON_LIMIT = 2000;

export const revalidate = 3600;

async function couponEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await prisma.coupon.findMany({
      // 與 coupons/[id]/page.tsx 的 INDEXABLE 判斷一致：只收還拿得到的公開券。
      where: { status: { in: ["AVAILABLE", "PENDING"] }, visibilityLevel: "PUBLIC" },
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: COUPON_LIMIT,
    });
    return rows.map((c) => ({
      url: `${SITE}/coupons/${c.id}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  } catch {
    // DB 掛掉時回傳靜態頁就好——sitemap 整個 500 比少幾個 URL 糟糕得多。
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: LAST_UPDATED, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/today`, lastModified: LAST_UPDATED, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/guide`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/terms`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [...statics, ...(await couponEntries())];
}
