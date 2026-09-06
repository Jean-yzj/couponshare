import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCouponFeed } from "@/lib/feed";
import { CouponCard } from "@/components/CouponCard";
import { Banner, Button, EmptyState, PageHeader } from "@/components/ui";

// 品牌著陸頁。站上的券帶著品牌欄位（全家 2,644 張、7-11 1,301 張、肯德基 616 張…
// 累計 626 個品牌），但在此之前完全沒有對應的頁面——而「全家 優惠券」「肯德基
// 買一送一」正是真的有人在搜的字，全部被放掉了。
//
// /brands/[id] 是企業品牌專區（BrandCoupon），跟這裡的使用者券品牌是兩回事，
// 所以另開 /b/ 而不是擠進去。
export const dynamic = "force-dynamic";

const SITE = "https://couponshare.lazybearlife.com";
const LIMIT = 24;

type Params = { params: Promise<{ brand: string }> };

async function brandStats(brand: string) {
  const [live, total] = await Promise.all([
    prisma.coupon.count({ where: { status: "AVAILABLE", brand: { equals: brand, mode: "insensitive" } } }),
    prisma.coupon.count({ where: { brand: { equals: brand, mode: "insensitive" } } }),
  ]);
  return { live, total };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const brand = decodeURIComponent((await params).brand);
  const { live, total } = await brandStats(brand);
  if (total === 0) return { title: "找不到這個品牌", robots: { index: false } };

  const title = `${brand}優惠券｜免費索取與交換`;
  const description =
    live > 0
      ? `目前有 ${live} 張${brand}的券可以免費索取或交換。CouponShare 是台灣的優惠券共享社群，把用不到的券送給需要的人，全程免費、平台不抽成。`
      : `${brand}的優惠券共享專區。這裡累計分享過 ${total} 張${brand}的券，目前暫時沒有可領的，可以先看看其他品牌。`;

  return {
    title,
    description,
    alternates: { canonical: `/b/${encodeURIComponent(brand)}` },
    // 沒有可領的券時是空頁，不要讓它進索引稀釋整站品質。
    robots: live > 0 ? undefined : { index: false },
    openGraph: { title, description, url: `${SITE}/b/${encodeURIComponent(brand)}`, type: "website" },
  };
}

export default async function BrandPage({ params }: Params) {
  const brand = decodeURIComponent((await params).brand);
  const { live, total } = await brandStats(brand);
  if (total === 0) notFound();

  const viewer = await getCurrentUser();
  const feed = await getCouponFeed({ viewer, brand, sort: "latest", page: 1, limit: LIMIT });

  // 其他有券可領的品牌 — 讓爬蟲和使用者都能從這裡走到別處，不要走進死路。
  const others = await prisma.coupon.groupBy({
    by: ["brand"],
    where: { status: "AVAILABLE", brand: { not: brand } },
    _count: true,
    orderBy: { _count: { brand: "desc" } },
    take: 12,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${brand}優惠券`,
    description: `${brand}的優惠券共享專區，目前有 ${live} 張可以免費索取或交換。`,
    url: `${SITE}/b/${encodeURIComponent(brand)}`,
    isPartOf: { "@type": "WebSite", name: "CouponShare", url: SITE },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: feed.data.length,
      itemListElement: feed.data.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE}/coupons/${c.id}`,
        name: c.title,
      })),
    },
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        eyebrow={`${brand} 專區`}
        title={`${brand}優惠券`}
        subtitle={
          live > 0
            ? `目前有 ${live} 張${brand}的券可以免費索取或交換。累計已經分享過 ${total.toLocaleString()} 張。`
            : `目前沒有可領的${brand}券。這裡累計分享過 ${total.toLocaleString()} 張，過一陣子再來看看。`
        }
      />

      <div className="mt-4">
        <Banner tone="info" icon="info">
          這裡的券由使用者自己分享，平台不查驗有效性，也不與{brand}有任何合作關係。領取前請自行確認。
        </Banner>
      </div>

      <div className="mt-5">
        {feed.data.length === 0 ? (
          <EmptyState
            icon="ticket"
            title={`現在沒有可領的${brand}券`}
            hint={`手上有用不到的${brand}券嗎？分享給需要的人。`}
            action={
              <Button href="/new" icon="plus">
                分享一張券
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {feed.data.map((c) => (
              <CouponCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-ink-soft">其他品牌的券</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((o) => (
              <Link
                key={o.brand}
                href={`/b/${encodeURIComponent(o.brand)}`}
                className="rounded-full border border-line bg-paper px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                {o.brand}
                <span className="ml-1.5 text-xs text-ink-faint">{o._count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
