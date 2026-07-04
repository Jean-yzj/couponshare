import type { Prisma, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

// Admin queue of user reports for manual review. "PENDING" bundles PENDING +
// REVIEWING (anything not yet decided). PRD §9 / terms §5.
export const GET = route(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status") || "PENDING";
  const where: Prisma.ReportWhereInput =
    status === "PENDING"
      ? { status: { in: ["PENDING", "REVIEWING"] } }
      : ["RESOLVED", "REJECTED"].includes(status)
        ? { status: status as ReportStatus }
        : {};

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      reporter: { select: { id: true, displayName: true, avatarUrl: true } },
      reportedUser: { select: { id: true, displayName: true, avatarUrl: true, status: true } },
      coupon: { select: { id: true, title: true, brand: true, status: true, reportCount: true } },
    },
  });

  return jsonOk({
    data: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      admin_note: r.adminNote,
      created_at: r.createdAt,
      resolved_at: r.resolvedAt,
      transaction_id: r.transactionId,
      reporter: r.reporter
        ? { display_name: r.reporter.displayName, avatar_url: r.reporter.avatarUrl }
        : null,
      reported_user: r.reportedUser
        ? { id: r.reportedUser.id, display_name: r.reportedUser.displayName, status: r.reportedUser.status }
        : null,
      coupon: r.coupon
        ? {
            id: r.coupon.id,
            title: r.coupon.title,
            brand: r.coupon.brand,
            status: r.coupon.status,
            report_count: r.coupon.reportCount,
          }
        : null,
    })),
  });
});
