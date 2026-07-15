import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { brandCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Admin: list partner brands with a coupon count each.
export const GET = route(async () => {
  await requireAdmin();
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { coupons: true } } },
  });
  return jsonOk({
    data: brands.map((b) => ({
      id: b.id,
      name: b.name,
      logo_text: b.logoText,
      logo_url: b.logoUrl,
      category: b.category,
      plan: b.plan,
      status: b.status,
      has_owner: !!b.ownerUserId,
      coupon_count: b._count.coupons,
      created_at: b.createdAt,
    })),
  });
});

// Admin creates a partner brand (platform 代管 in phase 1).
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readBody(req, brandCreateSchema);
  // Admin-created brands are pre-approved (signed contract precondition).
  const brand = await prisma.brand.create({
    data: {
      name: body.name,
      logoText: body.logo_text?.trim() || body.name.slice(0, 1),
      category: body.category || null,
      description: body.description || null,
      websiteUrl: body.website_url || null,
      contactName: body.contact_name || null,
      contactEmail: body.contact_email || null,
      status: "ACTIVE",
    },
    select: { id: true, name: true },
  });
  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.brand.create",
    targetType: "brand",
    targetId: brand.id,
    after: { name: brand.name },
    ip: meta.ip,
    ua: meta.ua,
  });
  return jsonOk({ id: brand.id }, 201);
});
