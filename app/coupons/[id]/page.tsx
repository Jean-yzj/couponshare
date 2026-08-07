import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { CATEGORY_LABEL, REDEEM_KIND_LABEL } from "@/lib/categories";
import Client from "./Client";

// 券詳情頁是全站最有搜尋價值的頁面（「星巴克 買一送一 優惠券」這種查詢的落點），
// 但整個頁面是 client component，SSR 只吐 skeleton——爬蟲與 AI 看到的是空殼。
//
// 這一層不動 Client 的任何互動邏輯，只補三件爬蟲需要的東西：
//   1. generateMetadata：真實的 title / description / OG，取代全站共用的預設值
//   2. JSON-LD：讓搜尋引擎與 AI 拿到機器可讀的券資訊
//   3. 一段 SSR 的文字摘要：不執行 JS 的爬蟲（GPTBot、ClaudeBot 等目前都是）
//      至少讀得到券在講什麼
//
// 資料直接讀 DB 而不是打自己的 API：省一次 HTTP 往返，也避開「SSR 時沒有 cookie
// 導致拿不到資料」的坑。這裡只取公開欄位，條碼與兌換碼一律不碰。
export const dynamic = "force-dynamic";

const SITE = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");

type Params = { params: Promise<{ id: string }> };

// 只有這些狀態值得被索引。已領走／過期／被檢舉的券留在站上可以看，
// 但不該出現在搜尋結果——使用者點進來只會看到「已經沒了」。
const INDEXABLE = new Set(["AVAILABLE", "PENDING"]);

async function getCoupon(id: string) {
  return prisma.coupon.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      brand: true,
      description: true,
      category: true,
      redeemKind: true,
      type: true,
      exchangeTarget: true,
      expiryDate: true,
      status: true,
      visibilityLevel: true,
      createdAt: true,
      owner: { select: { displayName: true } },
    },
  });
}

function summarize(c: NonNullable<Awaited<ReturnType<typeof getCoupon>>>): string {
  const kind = c.type === "EXCHANGE" ? "交換" : "免費贈送";
  const cat = c.category ? CATEGORY_LABEL[c.category] : null;
  const redeem = c.redeemKind ? REDEEM_KIND_LABEL[c.redeemKind] : null;
  const expiry = c.expiryDate
    ? `使用期限至 ${c.expiryDate.toISOString().slice(0, 10)}`
    : null;
  const bits = [
    `${c.brand}的「${c.title}」，由 ${c.owner?.displayName ?? "平台使用者"} 在 CouponShare 上${kind}`,
    cat && `分類：${cat}`,
    redeem && `優惠類型：${redeem}`,
    expiry,
    c.type === "EXCHANGE" && c.exchangeTarget && `想換：${c.exchangeTarget}`,
    c.description?.trim(),
  ].filter(Boolean);
  return bits.join("。").slice(0, 300);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const c = await getCoupon(id).catch(() => null);
  if (!c) return { title: "找不到這張券", robots: { index: false } };

  const kind = c.type === "EXCHANGE" ? "交換" : "免費索取";
  // 根 layout 的 template 會自動接上「· CouponShare」，這裡不要再寫一次站名。
  const title = `${c.brand} ${c.title}｜${kind}`;
  const description = summarize(c);
  const url = `${SITE}/coupons/${c.id}`;

  return {
    title,
    description,
    alternates: { canonical: `/coupons/${c.id}` },
    // 非公開或已結束的券不進索引，但頁面本身仍可正常瀏覽。
    robots: INDEXABLE.has(c.status) && c.visibilityLevel === "PUBLIC" ? undefined : { index: false },
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page({ params }: Params) {
  const { id } = await params;
  const c = await getCoupon(id).catch(() => null);

  const jsonLd = c
    ? {
        "@context": "https://schema.org",
        "@type": "Offer",
        name: c.title,
        description: summarize(c),
        url: `${SITE}/coupons/${c.id}`,
        category: c.category ? CATEGORY_LABEL[c.category] : undefined,
        // 這個平台上的券一律免費取得，交換也不涉及金錢。
        price: 0,
        priceCurrency: "TWD",
        availability:
          c.status === "AVAILABLE"
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        validThrough: c.expiryDate?.toISOString(),
        offeredBy: { "@type": "Organization", name: c.brand },
        seller: { "@type": "Organization", name: "CouponShare" },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {/* 不執行 JS 的爬蟲只看得到這一段。對一般使用者隱藏（sr-only 而非
          display:none——後者會被搜尋引擎視為隱藏文字而降權）。 */}
      {c && (
        <div className="sr-only">
          <h1>
            {c.brand} {c.title}
          </h1>
          <p>{summarize(c)}</p>
        </div>
      )}
      <Client />
    </>
  );
}
