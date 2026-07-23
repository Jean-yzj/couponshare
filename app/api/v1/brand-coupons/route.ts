import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { brandCouponsVisible } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Public official-coupon list used by both the website and native clients.
// The homepage previously queried Prisma directly, which left iOS without a way
// to render the same live inventory from the shared backend.
export const GET = route(async () => {
  if (!(await brandCouponsVisible())) return jsonOk({ data: [] });
  const user = await getCurrentUser();
  const adminViewer = !!user && isAdmin(user);
  const now = new Date();
  const rows = await prisma.brandCoupon.findMany({
    where: {
      status: "ACTIVE",
      brand: adminViewer ? undefined : { status: "ACTIVE" },
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { brand: { select: { name: true, logoText: true, logoUrl: true } } },
  });
  return jsonOk({
    data: rows.map((coupon) => ({
      id: coupon.id,
      title: coupon.title,
      category: coupon.category,
      image_url: coupon.imageUrl,
      application_mode: coupon.applicationMode,
      remaining: Math.max(0, coupon.maxApplications - coupon.applicationCount),
      max_applications: coupon.maxApplications,
      brand_name: coupon.brand.name,
      brand_logo: coupon.brand.logoText,
      brand_logo_url: coupon.brand.logoUrl,
    })),
  });
});
