import type {
  ClaimRequestStatus,
  CouponCategory,
  CouponRedeemKind,
  Prisma,
  User,
  UserLevel,
  VisibilityLevel,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { feedCoupon } from "@/lib/serialize";
import { ensureRanks } from "@/lib/ranks";
import { CATEGORY_KEYS, REDEEM_KIND_KEYS } from "@/lib/categories";
import { blockedUserIds } from "@/lib/blocks";

const ownerSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  userLevel: true,
  contributionScore: true,
} satisfies Prisma.UserSelect;

const couponFeedSelect = {
  id: true,
  title: true,
  brand: true,
  category: true,
  redeemKind: true,
  type: true,
  expiryDate: true,
  status: true,
  visibilityLevel: true,
  viewCount: true,
  claimRequestCount: true,
  createdAt: true,
  owner: { select: ownerSelect },
} satisfies Prisma.CouponSelect;

type FeedViewer = Pick<User, "id" | "userLevel"> | null;

export type CouponFeedSort = "latest" | "expiry_soon" | "popular";
export type CouponFeedType = "GIFT" | "EXCHANGE";

export type CouponFeedParams = {
  viewer: FeedViewer;
  brand?: string;
  type?: string | null;
  category?: string | null;
  redeemKind?: string | null;
  sort?: string | null;
  withinHours?: number;
  page?: number;
  limit?: number;
};

function allowedVisibilities(level: UserLevel | null): VisibilityLevel[] {
  const arr: VisibilityLevel[] = ["PUBLIC"];
  if (level === "LEVEL_2" || level === "LEVEL_3") arr.push("LEVEL_2_ONLY");
  if (level === "LEVEL_3") arr.push("LEVEL_3_ONLY");
  return arr;
}

function toFeedCoupon(coupon: Parameters<typeof feedCoupon>[0], status?: ClaimRequestStatus | null) {
  const c = feedCoupon(coupon, status);
  return {
    ...c,
    expiry_date: c.expiry_date ? c.expiry_date.toISOString() : null,
    created_at: c.created_at.toISOString(),
  };
}

export async function getCouponFeed(params: CouponFeedParams) {
  await ensureRanks(); // fill the top-3 cache so owner rank badges are correct
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const within = params.withinHours || 0;
  const sort = params.sort || "latest";
  const brand = params.brand?.trim() || undefined;
  const viewer = params.viewer;
  const hiddenOwnerIds = viewer ? await blockedUserIds(prisma, viewer.id) : [];

  const now = new Date();
  const where: Prisma.CouponWhereInput = {
    status: "AVAILABLE",
    visibilityLevel: { in: allowedVisibilities(viewer?.userLevel ?? null) },
  };
  if (hiddenOwnerIds.length) where.ownerId = { notIn: hiddenOwnerIds };

  if (within > 0) {
    where.expiryDate = { gt: now, lt: new Date(now.getTime() + within * 3_600_000) };
  } else {
    where.OR = [{ expiryDate: null }, { expiryDate: { gt: now } }];
  }

  if (brand) where.brand = { contains: brand, mode: "insensitive" };
  if (params.type === "GIFT" || params.type === "EXCHANGE") where.type = params.type;
  if (params.category && (CATEGORY_KEYS as string[]).includes(params.category)) {
    where.category = params.category as CouponCategory;
  }
  if (params.redeemKind && (REDEEM_KIND_KEYS as string[]).includes(params.redeemKind)) {
    where.redeemKind = params.redeemKind as CouponRedeemKind;
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
      select: couponFeedSelect,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coupon.count({ where }),
  ]);

  const myReq = new Map<string, ClaimRequestStatus>();
  if (viewer && rows.length) {
    const crs = await prisma.claimRequest.findMany({
      where: { requesterId: viewer.id, couponId: { in: rows.map((r) => r.id) } },
      select: { couponId: true, status: true },
    });
    for (const cr of crs) myReq.set(cr.couponId, cr.status);
  }

  return {
    data: rows.map((c) => toFeedCoupon(c, myReq.get(c.id) ?? null)),
    pagination: {
      page,
      limit,
      total,
      has_more: page * limit < total,
    },
  };
}
