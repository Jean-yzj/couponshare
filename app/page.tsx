import { DEFAULT_FEED_FILTERS, HomeClient, type FeedFilters } from "@/components/HomeClient";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_KEYS, REDEEM_KIND_KEYS } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { getCouponFeed } from "@/lib/feed";
import type { Metadata } from "next";

// The homepage owns the site-root canonical (the root layout no longer sets one).
export const metadata: Metadata = { alternates: { canonical: "/" } };

const LIMIT = 12;
type SearchParams = { [key: string]: string | string[] | undefined };

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
    return (
      <HomeClient
        signedIn={false}
        initialFeed={{ data: [], pagination: { total: 0, has_more: false } }}
        initialExpiring={[]}
        initialBrands={[]}
        initialFilters={DEFAULT_FEED_FILTERS}
      />
    );
  }

  const [initialFeed, expiringFeed, initialBrands] = await Promise.all([
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
  ]);

  return (
    <HomeClient
      signedIn
      initialFeed={initialFeed}
      initialExpiring={expiringFeed.data}
      initialBrands={initialBrands}
      initialFilters={filters}
    />
  );
}
