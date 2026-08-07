import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import Client from "./Client";

// 與 coupons/[id] 同樣的處理：整頁是 client component，SSR 只吐 Skeleton，
// 爬蟲看不到品牌名稱與券。品牌頁的搜尋價值很直接——「星巴克 優惠券」這種
// 查詢的落點就是這裡。
//
// 只補 metadata、JSON-LD 與一段爬蟲可讀摘要，Client 的行為完全不動。
export const dynamic = "force-dynamic";

const SITE = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");

type Params = { params: Promise<{ id: string }> };

async function getBrand(id: string) {
  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, category: true, status: true, websiteUrl: true },
  });
  if (!brand) return null;
  // 只算「現在真的拿得到」的券，跟頁面上顯示的一致。
  const now = new Date();
  const count = await prisma.brandCoupon.count({
    where: {
      brandId: id,
      status: "ACTIVE",
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    },
  });
  return { ...brand, count };
}

function describe(b: NonNullable<Awaited<ReturnType<typeof getBrand>>>): string {
  const head = b.count > 0
    ? `${b.name}目前在 CouponShare 上有 ${b.count} 張可領取的優惠券。`
    : `${b.name}在 CouponShare 的品牌專頁。`;
  return [head, b.description?.trim(), "免費索取，平台不抽成。"].filter(Boolean).join("").slice(0, 300);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const b = await getBrand(id).catch(() => null);
  if (!b) return { title: "找不到這個品牌", robots: { index: false } };

  const title = `${b.name} 優惠券`;
  const description = describe(b);
  return {
    title,
    description,
    alternates: { canonical: `/brands/${b.id}` },
    // 尚未通過審核的品牌頁不進索引。
    robots: b.status === "ACTIVE" ? undefined : { index: false },
    openGraph: { title, description, url: `${SITE}/brands/${b.id}`, type: "website" },
  };
}

export default async function Page({ params }: Params) {
  const { id } = await params;
  const b = await getBrand(id).catch(() => null);

  const jsonLd = b
    ? {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: b.name,
        description: b.description || undefined,
        url: b.websiteUrl || `${SITE}/brands/${b.id}`,
        mainEntityOfPage: `${SITE}/brands/${b.id}`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {b && (
        <div className="sr-only">
          <h1>{b.name} 優惠券</h1>
          <p>{describe(b)}</p>
        </div>
      )}
      <Client />
    </>
  );
}
