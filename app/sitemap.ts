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

// 必須是 force-dynamic，不能只靠 revalidate。
// 用 revalidate 的話 Next.js 會在 **build 時** 先產生一次 sitemap，而建置容器
// 連不到內網的正式資料庫——查詢失敗、被下面的 catch 吞掉、產出一份沒有任何
// 券頁的 sitemap，然後這份空的被快取。2026-08-08 實際踩到：部署後線上 sitemap
// 只有 7 個靜態 URL、券頁 0 個，但正式庫明明有符合條件的券。
export const dynamic = "force-dynamic";

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
  } catch (e) {
    // DB 掛掉時降級成只回靜態頁——sitemap 整個 500 比少幾個 URL 糟糕得多。
    // 但一定要留下聲音：這個 catch 原本是靜默的，害我們部署後才發現券頁一個
    // 都沒進 sitemap，而且從外面完全看不出是壞了還是本來就沒券。
    console.error("[sitemap] 券頁查詢失敗，本次只輸出靜態頁", e);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: LAST_UPDATED, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/today`, lastModified: LAST_UPDATED, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/guide`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/expiring`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/brands/guide`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/terms`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [...statics, ...(await couponEntries())];
}
