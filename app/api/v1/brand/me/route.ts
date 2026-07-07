import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireActiveUser } from "@/lib/auth";

export const runtime = "nodejs";

// Brand self-serve back office: the brands this user manages, plus the coupons +
// live stats of the active one (?brandId, defaults to the first owned brand).
export const GET = route(async (req) => {
  const user = await requireActiveUser();
  const brands = await prisma.brand.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (brands.length === 0) {
    return jsonOk({ brands: [], brand: null, coupons: [] });
  }

  const wanted = new URL(req.url).searchParams.get("brandId");
  const active = brands.find((b) => b.id === wanted) ?? brands[0];

  const coupons = await prisma.brandCoupon.findMany({
    where: { brandId: active.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });
  const claimed = await prisma.brandCouponApplication.groupBy({
    by: ["brandCouponId"],
    where: { brandCouponId: { in: coupons.map((c) => c.id) }, status: { in: ["APPROVED", "CLAIMED"] } },
    _count: { _all: true },
  });
  const claimedMap = new Map(claimed.map((r) => [r.brandCouponId, r._count._all]));

  return jsonOk({
    brands: brands.map((b) => ({ id: b.id, name: b.name, logo_text: b.logoText, category: b.category })),
    brand: {
      id: active.id,
      name: active.name,
      logo_text: active.logoText,
      category: active.category,
      description: active.description,
    },
    coupons: coupons.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      application_mode: c.applicationMode,
      status: c.status,
      max_applications: c.maxApplications,
      max_per_user: c.maxPerUser,
      application_count: c.applicationCount,
      view_count: c.viewCount,
      click_count: c.clickCount,
      total_applications: c._count.applications,
      claimed_count: claimedMap.get(c.id) ?? 0,
      usage_expiry: c.usageExpiry,
      created_at: c.createdAt,
    })),
  });
});
