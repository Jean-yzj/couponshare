import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { brandCouponsVisible, brandCouponPubliclyVisible } from "@/lib/brand-access";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// Brand coupon detail + the viewer's own application state. Bumps view_count —
// this is the per-coupon 瀏覽次數 promised to brands. Gated.
// Second gate: brand must be status=ACTIVE for non-admins.
export const GET = route(async (req, ctx) => {
  if (!(await brandCouponsVisible())) throw new ApiError("NOT_FOUND");
  const { id } = await ctx.params;

  const coupon = await prisma.brandCoupon.findUnique({
    where: { id },
    include: { brand: { select: { id: true, name: true, logoText: true, logoUrl: true, category: true } } },
  });
  if (!coupon) throw new ApiError("NOT_FOUND");
  if (!(await brandCouponPubliclyVisible(id))) throw new ApiError("NOT_FOUND");

  await prisma.brandCoupon.update({ where: { id }, data: { viewCount: { increment: 1 } } });

  const user = await getCurrentUser();
  const mine = user
    ? await prisma.brandCouponApplication.findUnique({
        where: { brandCouponId_userId: { brandCouponId: id, userId: user.id } },
        select: { status: true, message: true },
      })
    : null;

  const claimed = mine?.status === "CLAIMED";
  return jsonOk({
    id: coupon.id,
    title: coupon.title,
    description: coupon.description,
    category: coupon.category,
    image_url: coupon.imageUrl,
    application_mode: coupon.applicationMode,
    task_instruction: coupon.taskInstruction,
    task_url: coupon.taskUrl,
    status: coupon.status,
    remaining: Math.max(0, coupon.maxApplications - coupon.applicationCount),
    max_applications: coupon.maxApplications,
    usage_expiry: coupon.usageExpiry,
    cta_text: coupon.ctaText,
    cta_url: coupon.ctaUrl,
    // Redeem instructions are only revealed once the user actually holds the coupon.
    redeem_info: claimed ? coupon.redeemInfo : null,
    brand: {
      id: coupon.brand.id,
      name: coupon.brand.name,
      logo_text: coupon.brand.logoText,
      logo_url: coupon.brand.logoUrl,
      category: coupon.brand.category,
    },
    my_status: mine?.status ?? null,
  });
});
