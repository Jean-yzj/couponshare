import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireActiveUser } from "@/lib/auth";
import { ownsCoupon } from "@/lib/brand-access";

export const runtime = "nodejs";

// Brand owner sees who applied for one of their coupons (display names looked up
// separately — application.userId is a bare scalar).
export const GET = route(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  if (!(await ownsCoupon(user.id, id))) throw new ApiError("FORBIDDEN");

  const apps = await prisma.brandCouponApplication.findMany({
    where: { brandCouponId: id },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const users = apps.length
    ? await prisma.user.findMany({
        where: { id: { in: [...new Set(apps.map((a) => a.userId))] } },
        select: { id: true, displayName: true },
      })
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.displayName]));

  return jsonOk({
    data: apps.map((a) => ({
      id: a.id,
      display_name: nameMap.get(a.userId) ?? "使用者",
      message: a.message,
      status: a.status,
      created_at: a.createdAt,
    })),
  });
});
