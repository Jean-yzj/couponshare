import type {
  ClaimRequestStatus,
  CouponCategory,
  Prisma,
  UserLevel,
  VisibilityLevel,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { feedCoupon } from "@/lib/serialize";
import { CATEGORY_KEYS } from "@/lib/categories";

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
  const category = url.searchParams.get("category");
  const sort = url.searchParams.get("sort") || "latest";
  const within = parseInt(url.searchParams.get("within_hours") || "", 10);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));

  const viewer = await getCurrentUser();
  const visibilities = allowedVisibilities(viewer?.userLevel ?? null);

  const now = new Date();
  const where: Prisma.CouponWhereInput = {
    status: "AVAILABLE",
    visibilityLevel: { in: visibilities },
  };
  if (within > 0) {
    // "Expiring soon" section: only dated coupons inside the window.
    where.expiryDate = { gt: now, lt: new Date(now.getTime() + within * 3_600_000) };
  } else {
    // Normal feed: hide already-expired, but keep coupons with no expiry date.
    where.OR = [{ expiryDate: null }, { expiryDate: { gt: now } }];
  }
  if (brand) where.brand = { contains: brand, mode: "insensitive" };
  if (type === "GIFT" || type === "EXCHANGE") where.type = type;
  if (category && (CATEGORY_KEYS as string[]).includes(category)) {
    where.category = category as CouponCategory;
  }

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

  // Annotate each card with the viewer's own request status (已申請 / 已獲得).
  const myReq = new Map<string, ClaimRequestStatus>();
  if (viewer && rows.length) {
    const crs = await prisma.claimRequest.findMany({
      where: { requesterId: viewer.id, couponId: { in: rows.map((r) => r.id) } },
      select: { couponId: true, status: true },
    });
    for (const cr of crs) myReq.set(cr.couponId, cr.status);
  }

  return jsonOk({
    data: rows.map((c) => feedCoupon(c, myReq.get(c.id) ?? null)),
    pagination: { page, limit, total },
  });
});
