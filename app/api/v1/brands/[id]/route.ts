import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { brandCouponsVisible, brandPubliclyVisible } from "@/lib/brand-access";

export const runtime = "nodejs";

// Public brand page: the brand + its currently-claimable official coupons.
// Gated — hidden (404) unless the feature flag is on or the viewer is an admin.
// Second gate: brand must be status=ACTIVE for non-admins.
export const GET = route(async (req, ctx) => {
  if (!(await brandCouponsVisible())) throw new ApiError("NOT_FOUND");
  const { id } = await ctx.params;

  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw new ApiError("NOT_FOUND");
  if (!(await brandPubliclyVisible(id))) throw new ApiError("NOT_FOUND");

  const coupons = await prisma.brandCoupon.findMany({
    where: { brandId: id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({
    brand: {
      id: brand.id,
      name: brand.name,
      logo_text: brand.logoText,
      logo_url: brand.logoUrl,
      category: brand.category,
      description: brand.description,
      website_url: brand.websiteUrl,
    },
    coupons: coupons.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      image_url: c.imageUrl,
      application_mode: c.applicationMode,
      remaining: Math.max(0, c.maxApplications - c.applicationCount),
      max_applications: c.maxApplications,
      usage_expiry: c.usageExpiry,
    })),
  });
});
