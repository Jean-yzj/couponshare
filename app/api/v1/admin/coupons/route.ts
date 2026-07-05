import type { Prisma, CouponStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

// Admin roster of coupons by status — defaults to SUSPENDED so the admin can find
// listings that were pulled down (e.g. by a report that turned out malicious) and
// put them back. Scoped to owners who are still ACTIVE: a suspended owner's coupons
// come back when the ACCOUNT is restored, so they'd only be noise here.
export const GET = route(async (req) => {
  await requireAdmin();
  const raw = new URL(req.url).searchParams.get("status") || "SUSPENDED";
  const allowed = ["AVAILABLE", "REPORTED", "SUSPENDED", "CANCELLED"];
  const status: CouponStatus = allowed.includes(raw) ? (raw as CouponStatus) : "SUSPENDED";

  const coupons = await prisma.coupon.findMany({
    where: { status, owner: { status: "ACTIVE" } } as Prisma.CouponWhereInput,
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      brand: true,
      type: true,
      category: true,
      status: true,
      reportCount: true,
      viewCount: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, displayName: true, status: true } },
    },
  });

  return jsonOk({
    data: coupons.map((c) => ({
      id: c.id,
      title: c.title,
      brand: c.brand,
      type: c.type,
      category: c.category,
      status: c.status,
      report_count: c.reportCount,
      view_count: c.viewCount,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      owner: c.owner ? { id: c.owner.id, display_name: c.owner.displayName } : null,
    })),
  });
});
