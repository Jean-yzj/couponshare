import { HomeClient } from "@/components/HomeClient";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCouponFeed } from "@/lib/feed";

const LIMIT = 12;

async function getFollowedBrands(userId: string): Promise<string[]> {
  const follows = await prisma.brandFollow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { brand: true },
  });
  return follows.map((f) => f.brand);
}

export default async function HomePage() {
  const viewer = await getCurrentUser();

  if (!viewer) {
    return (
      <HomeClient
        signedIn={false}
        initialFeed={{ data: [], pagination: { total: 0, has_more: false } }}
        initialExpiring={[]}
        initialBrands={[]}
      />
    );
  }

  const [initialFeed, expiringFeed, initialBrands] = await Promise.all([
    getCouponFeed({ viewer, sort: "latest", page: 1, limit: LIMIT }),
    getCouponFeed({ viewer, sort: "expiry_soon", withinHours: 48, page: 1, limit: 4 }),
    getFollowedBrands(viewer.id),
  ]);

  return (
    <HomeClient
      signedIn
      initialFeed={initialFeed}
      initialExpiring={expiringFeed.data}
      initialBrands={initialBrands}
    />
  );
}
