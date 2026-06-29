import type { Prisma, UserLevel, VisibilityLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { feedCoupon } from "@/lib/serialize";

function allowedVisibilities(level: UserLevel | null): VisibilityLevel[] {
  const arr: VisibilityLevel[] = ["PUBLIC"];
  if (level === "LEVEL_2" || level === "LEVEL_3") arr.push("LEVEL_2_ONLY");
  if (level === "LEVEL_3") arr.push("LEVEL_3_ONLY");
  return arr;
}

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand")?.trim() || undefined;
  const type = url.searchParams.get("type");
  const sort = url.searchParams.get("sort") || "latest";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));

  const viewer = await getCurrentUser();
  const visibilities = allowedVisibilities(viewer?.userLevel ?? null);

  const where: Prisma.CouponWhereInput = {
    status: "AVAILABLE",
    expiryDate: { gt: new Date() },
    visibilityLevel: { in: visibilities },
  };
  if (brand) where.brand = { contains: brand, mode: "insensitive" };
  if (type === "GIFT" || type === "EXCHANGE") where.type = type;

  const orderBy: Prisma.CouponOrderByWithRelationInput =
    sort === "expiry_soon"
      ? { expiryDate: "asc" }
      : sort === "popular"
        ? { claimRequestCount: "desc" }
        : { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy,
      include: { owner: true },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coupon.count({ where }),
  ]);

  return jsonOk({ data: rows.map(feedCoupon), pagination: { page, limit, total } });
});
