import { DEFAULT_FEED_FILTERS, HomeClient, type FeedFilters, type OfficialCoupon } from "@/components/HomeClient";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { CATEGORY_KEYS, REDEEM_KIND_KEYS } from "@/lib/categories";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCouponFeed } from "@/lib/feed";
import { brandCouponsVisible } from "@/lib/brand-access";
import type { Metadata } from "next";

// The homepage owns the site-root canonical (the root layout no longer sets one).
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Brand-coupon visibility is flag-gated per request; never let this page be statically cached.
export const dynamic = "force-dynamic";

const LIMIT = 12;
type SearchParams = { [key: string]: string | string[] | undefined };

async function getActiveBrandCoupons(): Promise<OfficialCoupon[]> {
  if (!(await brandCouponsVisible())) return [];
  const user = await getCurrentUser();
  const adminViewer = !!user && isAdmin(user);
  const now = new Date();
  const rows = await prisma.brandCoupon.findMany({
    where: {
      status: "ACTIVE",
      // Non-admin viewers only see coupons from brands that are ACTIVE (approved).
      brand: adminViewer ? undefined : { status: "ACTIVE" },
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { brand: { select: { name: true, logoText: true, logoUrl: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    image_url: c.imageUrl,
    application_mode: c.applicationMode,
    remaining: Math.max(0, c.maxApplications - c.applicationCount),
    max_applications: c.maxApplications,
    brand_name: c.brand.name,
    brand_logo: c.brand.logoText,
    brand_logo_url: c.brand.logoUrl,
  }));
}

async function getFollowedBrands(userId: string): Promise<string[]> {
  const follows = await prisma.brandFollow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { brand: true },
  });
  return follows.map((f) => f.brand);
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: SearchParams): FeedFilters {
  const brand = single(params.brand)?.trim().slice(0, 60) ?? "";
  const category = single(params.category);
  const redeemKind = single(params.redeem_kind);
  const type = single(params.type);
  const sort = single(params.sort);

  return {
    brand,
    category: category && (CATEGORY_KEYS as readonly string[]).includes(category) ? category : "ALL",
    redeemKind:
      redeemKind && (REDEEM_KIND_KEYS as readonly string[]).includes(redeemKind) ? redeemKind : "ALL",
    type: type === "GIFT" || type === "EXCHANGE" ? type : "ALL",
    sort: sort === "expiry_soon" || sort === "popular" ? sort : "latest",
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getCurrentUser();
  const filters = parseFilters(await searchParams);

  if (!viewer) {
    // 未登入看到的是 Landing，feed 是空的——爬蟲也是未登入，所以首頁對搜尋引擎
    // 一直是一個沒有任何券連結的頁面。站上 63 張券只能靠 sitemap 被發現，
    // 內部連結權重完全不流動，而首頁正是全站被連最多次的那一頁。
    //
    // 這一段只補「路」不動版面：sr-only 而不是 display:none（後者會被當成隱藏
    // 文字而降權），一般使用者看到的仍然是原本的 Landing。
    const [latest, brands] = await Promise.all([
      prisma.coupon.findMany({
        where: { status: "AVAILABLE", visibilityLevel: "PUBLIC" },
        select: { id: true, title: true, brand: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.coupon.groupBy({
        by: ["brand"],
        where: { status: "AVAILABLE", visibilityLevel: "PUBLIC" },
        _count: true,
        orderBy: { _count: { brand: "desc" } },
        take: 20,
      }),
    ]);

    return (
      <>
        <div className="sr-only">
          <h2>目前可以免費索取的優惠券</h2>
          <ul>
            {latest.map((c) => (
              <li key={c.id}>
                <Link href={`/coupons/${c.id}`}>
                  {c.brand} {c.title}
                </Link>
              </li>
            ))}
          </ul>
          <h2>依品牌瀏覽</h2>
          <ul>
            {brands.map((b) => (
              <li key={b.brand}>
                <Link href={`/b/${encodeURIComponent(b.brand)}`}>{b.brand}優惠券</Link>
              </li>
            ))}
          </ul>
        </div>
        <HomeClient
          signedIn={false}
          initialFeed={{ data: [], pagination: { total: 0, has_more: false } }}
          initialExpiring={[]}
          initialBrands={[]}
          initialFilters={DEFAULT_FEED_FILTERS}
        />
      </>
    );
  }

  const [initialFeed, expiringFeed, initialBrands, officialCoupons] = await Promise.all([
    getCouponFeed({
      viewer,
      brand: filters.brand,
      type: filters.type,
      category: filters.category,
      redeemKind: filters.redeemKind,
      sort: filters.sort,
      page: 1,
      limit: LIMIT,
    }),
    getCouponFeed({ viewer, sort: "expiry_soon", withinHours: 48, page: 1, limit: 4 }),
    getFollowedBrands(viewer.id),
    getActiveBrandCoupons(),
  ]);

  return (
    <HomeClient
      signedIn
      initialFeed={initialFeed}
      initialExpiring={expiringFeed.data}
      initialBrands={initialBrands}
      initialFilters={filters}
      officialCoupons={officialCoupons}
    />
  );
}
