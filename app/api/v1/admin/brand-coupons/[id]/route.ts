import { prisma } from "@/lib/db";
import { route, readBody, jsonOk, clientMeta } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { brandCouponStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Admin: the applicant list for one brand coupon (with display names — userId is a
// bare scalar on the application, so names are looked up in a second query).
export const GET = route(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const apps = await prisma.brandCouponApplication.findMany({
    where: { brandCouponId: id },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const users = apps.length
    ? await prisma.user.findMany({
        where: { id: { in: [...new Set(apps.map((a) => a.userId))] } },
        select: { id: true, displayName: true, avatarUrl: true },
      })
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u]));

  return jsonOk({
    data: apps.map((a) => ({
      id: a.id,
      user_id: a.userId,
      display_name: nameMap.get(a.userId)?.displayName ?? "使用者",
      avatar_url: nameMap.get(a.userId)?.avatarUrl ?? null,
      message: a.message,
      status: a.status,
      created_at: a.createdAt,
      decided_at: a.decidedAt,
    })),
  });
});

// Admin flips a coupon's status (ACTIVE / PAUSED / ENDED / DRAFT).
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { status } = await readBody(req, brandCouponStatusSchema);

  const existing = await prisma.brandCoupon.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new ApiError("NOT_FOUND");

  await prisma.brandCoupon.update({ where: { id }, data: { status } });
  const meta = clientMeta(req);
  await writeAudit(prisma, {
    actorId: admin.id,
    action: "admin.brand_coupon.status",
    targetType: "brand_coupon",
    targetId: id,
    before: { status: existing.status },
    after: { status },
    ip: meta.ip,
    ua: meta.ua,
  });

  return jsonOk({ id, status });
});
