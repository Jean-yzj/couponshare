import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { brandCouponCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Admin creates an official coupon for a brand. Starts as ACTIVE so it's
// immediately previewable; the master flag still hides it from real users.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id: brandId } = await ctx.params;
  const body = await readBody(req, brandCouponCreateSchema);

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!brand) throw new ApiError("NOT_FOUND");

  const coupon = await prisma.brandCoupon.create({
    data: {
      brandId,
      title: body.title,
      description: body.description || null,
      category: body.category || null,
      redeemInfo: body.redeem_info || null,
      applicationMode: body.application_mode,
      maxApplications: body.max_applications,
      maxPerUser: body.max_per_user,
      ctaText: body.cta_text || null,
      ctaUrl: body.cta_url || null,
      usageExpiry: body.usage_expiry || null,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.brand_coupon.create",
    targetType: "brand_coupon",
    targetId: coupon.id,
    after: { brandId, title: body.title },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id: coupon.id }, 201);
});
