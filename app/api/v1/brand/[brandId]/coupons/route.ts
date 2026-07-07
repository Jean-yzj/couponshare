import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { ownsBrand } from "@/lib/brand-access";
import { writeAudit } from "@/lib/audit";
import { brandCouponCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Brand owner uploads an official coupon for a brand they manage.
export const POST = route(async (req, ctx) => {
  const user = await requireActiveUser();
  const { brandId } = await ctx.params;
  if (!(await ownsBrand(user.id, brandId))) throw new ApiError("FORBIDDEN");
  const body = await readBody(req, brandCouponCreateSchema);

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
    actorId: user.id,
    action: "brand.coupon.create",
    targetType: "brand_coupon",
    targetId: coupon.id,
    after: { brandId, title: body.title },
    ip: meta.ip,
    ua: meta.ua,
  });
  return jsonOk({ id: coupon.id }, 201);
});
