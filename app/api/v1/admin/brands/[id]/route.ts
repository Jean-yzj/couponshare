import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { brandPlanSchema, brandStatusSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

// Admin changes a brand's plan tier (PRO / MAX) and/or approval status
// (PENDING / ACTIVE / SUSPENDED). Both fields are optional in the same call.
const brandAdminUpdateSchema = z.object({
  plan: brandPlanSchema.shape.plan.optional(),
  status: brandStatusSchema.shape.status.optional(),
}).refine((v) => v.plan !== undefined || v.status !== undefined, {
  message: "請提供 plan 或 status 其中至少一個欄位",
});

export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await readBody(req, brandAdminUpdateSchema);
  const brand = await prisma.brand.findUnique({ where: { id }, select: { plan: true, status: true } });
  if (!brand) throw new ApiError("NOT_FOUND");
  const data: { plan?: string; status?: string } = {};
  if (body.plan !== undefined) data.plan = body.plan;
  if (body.status !== undefined) data.status = body.status;
  await prisma.brand.update({ where: { id }, data });
  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.brand.update",
    targetType: "brand",
    targetId: id,
    before: { plan: brand.plan, status: brand.status },
    after: data,
    ip: meta.ip,
    ua: meta.ua,
  });
  return jsonOk({ id, ...data });
});

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
      logo_url: brand.logoUrl,
      category: brand.category,
      description: brand.description,
      website_url: brand.websiteUrl,
      contact_name: brand.contactName,
      contact_email: brand.contactEmail,
      plan: brand.plan,
      status: brand.status,
      owner_user_id: brand.ownerUserId,
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
