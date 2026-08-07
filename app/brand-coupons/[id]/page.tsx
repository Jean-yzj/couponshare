import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { brandCouponsVisible } from "@/lib/brand-access";
import Client from "./Client";

// 品牌官方福利券。搜尋價值比使用者上傳的券更高——這是品牌自己發的，
// 「星巴克 官方 優惠」這類查詢會落在這裡，而且內容不會像個人券那樣幾天就消失。
//
// 與 coupons/[id] 相同的做法：server 包一層補 metadata / JSON-LD /
// 爬蟲摘要，Client 的互動完全不動。
export const dynamic = "force-dynamic";

const SITE = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");

type Params = { params: Promise<{ id: string }> };

async function getBrandCoupon(id: string) {
  return prisma.brandCoupon.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      startAt: true,
      endAt: true,
      brand: { select: { id: true, name: true, status: true } },
    },
  });
}

type BC = NonNullable<Awaited<ReturnType<typeof getBrandCoupon>>>;

function describe(c: BC): string {
  const end = c.endAt ? `活動至 ${c.endAt.toISOString().slice(0, 10)}` : null;
  return [
    `${c.brand.name}在 CouponShare 推出的「${c.title}」`,
    c.description?.trim(),
    end,
    "免費領取，不需付費。",
  ]
    .filter(Boolean)
    .join("。")
    .slice(0, 300);
}

// 這張券現在是不是真的還領得到——與 app/page.tsx 取用時的條件一致。
function live(c: BC): boolean {
  const now = new Date();
  if (c.status !== "ACTIVE" || c.brand.status !== "ACTIVE") return false;
  if (c.startAt && c.startAt > now) return false;
  if (c.endAt && c.endAt < now) return false;
  return true;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const c = await getBrandCoupon(id).catch(() => null);
  if (!c) return { title: "找不到這張券", robots: { index: false } };

  const title = `${c.brand.name} ${c.title}`;
  const description = describe(c);
  // 品牌券整體是 flag-gated 的功能；功能沒開的時候不該讓搜尋引擎收錄
  // 這些頁面，否則使用者從搜尋點進來會撞到空白。
  const visible = await brandCouponsVisible().catch(() => false);

  return {
    title,
    description,
    alternates: { canonical: `/brand-coupons/${c.id}` },
    robots: visible && live(c) ? undefined : { index: false },
    openGraph: { title, description, url: `${SITE}/brand-coupons/${c.id}`, type: "article" },
  };
}

export default async function Page({ params }: Params) {
  const { id } = await params;
  const c = await getBrandCoupon(id).catch(() => null);

  const jsonLd = c
    ? {
        "@context": "https://schema.org",
        "@type": "Offer",
        name: c.title,
        description: describe(c),
        url: `${SITE}/brand-coupons/${c.id}`,
        category: c.category || undefined,
        price: 0,
        priceCurrency: "TWD",
        availability: live(c) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        validFrom: c.startAt?.toISOString(),
        validThrough: c.endAt?.toISOString(),
        offeredBy: { "@type": "Organization", name: c.brand.name },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {c && (
        <div className="sr-only">
          <h1>
            {c.brand.name} {c.title}
          </h1>
          <p>{describe(c)}</p>
        </div>
      )}
      <Client />
    </>
  );
}
