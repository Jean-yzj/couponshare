import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Admin: one brand's dashboard payload — brand info + every coupon with its live
// stats (views / applications / claims). This is what a brand would see in their
// own back office; for now the admin previews it on the brand's behalf.
export const GET = route(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw new ApiError("NOT_FOUND");

  const coupons = await prisma.brandCoupon.findMany({
    where: { brandId: id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { applications: true } },
    },
  });

  // Claimed = approved or claimed applications (the ones that consumed quota).
  const claimedCounts = await prisma.brandCouponApplication.groupBy({
    by: ["brandCouponId"],
    where: { brandCouponId: { in: coupons.map((c) => c.id) }, status: { in: ["APPROVED", "CLAIMED"] } },
    _count: { _all: true },
  });
  const claimedMap = new Map(claimedCounts.map((r) => [r.brandCouponId, r._count._all]));

  return jsonOk({
    brand: {
      id: brand.id,
      name: brand.name,
      logo_text: brand.logoText,
      category: brand.category,
      description: brand.description,
      website_url: brand.websiteUrl,
      contact_name: brand.contactName,
      contact_email: brand.contactEmail,
      created_at: brand.createdAt,
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
