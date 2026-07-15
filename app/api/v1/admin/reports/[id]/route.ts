import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { ratingSummary } from "@/lib/ratings";

// Full context for judging one report: the reported coupon's content, the
// accused account's history (是不是累犯 vs 好公民), the reporter's account age
// (擋 Sybil 誣告), and any evidence image. Barcode / redeem code stay secret —
// only booleans are exposed, preserving the core privacy invariant.
export const GET = route(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, displayName: true, contributionScore: true, createdAt: true } },
      reportedUser: {
        select: {
          id: true,
          displayName: true,
          status: true,
          userLevel: true,
          contributionScore: true,
          createdAt: true,
        },
      },
      coupon: { include: { owner: { select: { id: true, displayName: true } } } },
    },
  });
  if (!report) throw new ApiError("NOT_FOUND");

  // Accused-account history — only when the report names a user.
  let accusedStats: {
    coupons_shared: number;
    reports_against: number;
    completed_transactions: number;
    rating_avg: number | null;
    rating_count: number;
  } | null = null;
  if (report.reportedUserId) {
    const uid = report.reportedUserId;
    const [shared, distinctReporters, completed, rating] = await Promise.all([
      prisma.coupon.count({ where: { ownerId: uid, status: { not: "DRAFT" } } }),
      prisma.report.findMany({
        where: { reportedUserId: uid },
        distinct: ["reporterId"],
        select: { reporterId: true },
      }),
      prisma.transaction.count({
        where: { OR: [{ ownerId: uid }, { claimantId: uid }], status: "COMPLETED" },
      }),
      ratingSummary(prisma, uid),
    ]);
    accusedStats = {
      coupons_shared: shared,
      reports_against: distinctReporters.length,
      completed_transactions: completed,
      rating_avg: rating.avg,
      rating_count: rating.count,
    };
  }

  // How many admin-confirmed strikes the accountable party already has (offender =
  // named user, else coupon owner) — shows the admin how close 累積檢舉 is to the
  // auto-suspend threshold before they add another.
  const offenderId = report.reportedUserId ?? report.coupon?.ownerId ?? null;
  const offenderStrikes = offenderId
    ? await prisma.auditLog.count({
        where: { actorId: offenderId, action: "report.confirmed_strike" },
      })
    : 0;

  const c = report.coupon;
  return jsonOk({
    id: report.id,
    reason: report.reason,
    description: report.description,
    status: report.status,
    admin_note: report.adminNote,
    offender_strikes: offenderStrikes,
    evidence_image_url: report.evidenceImageUrl,
    transaction_id: report.transactionId,
    created_at: report.createdAt,
    resolved_at: report.resolvedAt,
    reporter: report.reporter
      ? {
          id: report.reporter.id,
          display_name: report.reporter.displayName,
          contribution_score: report.reporter.contributionScore,
          created_at: report.reporter.createdAt,
        }
      : null,
    reported_user: report.reportedUser
      ? {
          id: report.reportedUser.id,
          display_name: report.reportedUser.displayName,
          status: report.reportedUser.status,
          user_level: report.reportedUser.userLevel,
          contribution_score: report.reportedUser.contributionScore,
          created_at: report.reportedUser.createdAt,
          stats: accusedStats,
        }
      : null,
    coupon: c
      ? {
          id: c.id,
          title: c.title,
          brand: c.brand,
          description: c.description,
          category: c.category,
          redeem_kind: c.redeemKind,
          type: c.type,
          exchange_target: c.exchangeTarget,
          status: c.status,
          expiry_date: c.expiryDate,
          report_count: c.reportCount,
          view_count: c.viewCount,
          claim_request_count: c.claimRequestCount,
          has_barcode: !!(c.barcodeEncryptedData || c.barcodeStorageKey),
          has_redeem_code: !!c.redeemCodeEncrypted,
          created_at: c.createdAt,
          owner: c.owner ? { id: c.owner.id, display_name: c.owner.displayName } : null,
        }
      : null,
  });
});
