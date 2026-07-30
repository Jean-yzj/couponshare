import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";
import { LEVELS } from "@/lib/levels";

// Everything an admin needs to answer "why was this account suspended?" without
// leaving the appeal screen. Suspension itself is recorded in audit_logs (four
// different code paths write it), while the evidence lives in reports — neither
// was exposed to the UI before, so reviewers were judging appeals blind.

// Kept local on purpose: /admin/reports has its own copy for the report queue.
// Sharing it would mean editing that file too, and this route only needs labels.
const REASON_LABEL: Record<string, string> = {
  INVALID_COUPON: "無效票券",
  EXPIRED_COUPON: "已過期",
  ALREADY_USED: "已被使用",
  UNREASONABLE_EXCHANGE: "交換條件不合理",
  NO_RESPONSE: "已讀不回 / 失聯",
  ABUSIVE_MESSAGE: "言語不當",
  SCAM: "詐騙",
  OTHER: "其他",
};

// action → how the suspension happened. The wording is what the reviewer reads
// first, so it states the rule that fired, not the internal action name.
const SUSPENSION_KIND: Record<string, { kind: string; label: string }> = {
  "user.auto_suspend": {
    kind: "AUTO_REPORTED",
    label: "系統自動停權：被 3 位以上不同使用者檢舉",
  },
  "user.suspend": {
    kind: "ADMIN",
    label: "管理員手動停權",
  },
  "user.suspend_confirmed_strikes": {
    kind: "CONFIRMED_STRIKES",
    label: "系統自動停權：累積 3 次檢舉經管理員確認成立",
  },
  "user.suspend_malicious_reporter": {
    kind: "MALICIOUS_REPORTER",
    label: "系統自動停權：累積 3 次惡意檢舉他人",
  },
};

const SUSPEND_ACTIONS = Object.keys(SUSPENSION_KIND);

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export const GET = route(async (_req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      status: true,
      userLevel: true,
      contributionScore: true,
      createdAt: true,
      lastLoginAt: true,
      riskFlag: true,
    },
  });
  if (!user) throw new ApiError("NOT_FOUND");

  const [suspendEvent, reportsAgainst, reportsFiledCount, coupons, txns, ratings, appeals] =
    await Promise.all([
      prisma.auditLog.findFirst({
        where: { targetType: "user", targetId: id, action: { in: SUSPEND_ACTIONS } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.report.findMany({
        where: { reportedUserId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          reporter: {
            select: { id: true, displayName: true, createdAt: true, contributionScore: true, status: true },
          },
          coupon: { select: { id: true, title: true, brand: true, status: true } },
        },
      }),
      prisma.report.count({ where: { reporterId: id } }),
      prisma.coupon.groupBy({ by: ["status"], where: { ownerId: id }, _count: true }),
      prisma.transaction.findMany({
        where: { OR: [{ ownerId: id }, { claimantId: id }] },
        select: { status: true, disputedAt: true },
      }),
      prisma.rating.aggregate({
        where: { toUserId: id },
        _avg: { ratingScore: true },
        _count: true,
      }),
      prisma.appeal.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true, resolvedAt: true },
      }),
    ]);

  // The auto-suspend rule counts *distinct* reporters, so the raw report count
  // can be misleading (one person filing five times never trips it).
  const distinctReporters = new Set(reportsAgainst.map((r) => r.reporterId).filter(Boolean)).size;

  let actor: { id: string; display_name: string } | null = null;
  if (suspendEvent?.actorId) {
    const a = await prisma.user.findUnique({
      where: { id: suspendEvent.actorId },
      select: { id: true, displayName: true },
    });
    if (a) actor = { id: a.id, display_name: a.displayName };
  }

  const meta = SUSPENSION_KIND[suspendEvent?.action ?? ""] ?? null;
  const detail = (suspendEvent?.afterValue ?? null) as Record<string, unknown> | null;

  // Chronological story: registration → each report → suspension → appeals.
  const timeline: { at: Date; kind: string; label: string }[] = [
    { at: user.createdAt, kind: "signup", label: "帳號註冊" },
    ...reportsAgainst.map((r) => ({
      at: r.createdAt,
      kind: "report",
      label: `被檢舉：${REASON_LABEL[r.reason] ?? r.reason}${
        r.reporter ? `（檢舉人 ${r.reporter.displayName}）` : ""
      }`,
    })),
    ...(suspendEvent
      ? [{ at: suspendEvent.createdAt, kind: "suspend", label: meta?.label ?? suspendEvent.action }]
      : []),
    ...appeals.map((a) => ({
      at: a.createdAt,
      kind: "appeal",
      label: `提出申訴（${a.status === "PENDING" ? "待處理" : a.status === "ACCEPTED" ? "已通過" : "已駁回"}）`,
    })),
  ].sort((x, y) => x.at.getTime() - y.at.getTime());

  return jsonOk({
    user: {
      id: user.id,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      status: user.status,
      user_level: user.userLevel,
      level_name: LEVELS[user.userLevel].name,
      contribution_score: user.contributionScore,
      created_at: user.createdAt,
      account_age_days: daysBetween(user.createdAt, now),
      last_login_at: user.lastLoginAt,
      risk_flag: user.riskFlag,
    },
    suspension: suspendEvent
      ? {
          kind: meta?.kind ?? "UNKNOWN",
          label: meta?.label ?? suspendEvent.action,
          action: suspendEvent.action,
          at: suspendEvent.createdAt,
          actor,
          // Admin suspensions carry a free-text reason here; the automatic ones
          // carry the counters that tripped the rule.
          reason: typeof detail?.reason === "string" ? detail.reason : null,
          detail,
        }
      : null,
    reports_against: reportsAgainst.map((r) => ({
      id: r.id,
      reason: r.reason,
      reason_label: REASON_LABEL[r.reason] ?? r.reason,
      description: r.description,
      evidence_image_url: r.evidenceImageUrl,
      status: r.status,
      admin_note: r.adminNote,
      created_at: r.createdAt,
      transaction_id: r.transactionId,
      coupon: r.coupon
        ? { id: r.coupon.id, title: r.coupon.title, brand: r.coupon.brand, status: r.coupon.status }
        : null,
      reporter: r.reporter
        ? {
            id: r.reporter.id,
            display_name: r.reporter.displayName,
            // Surfaced so a burst of brand-new accounts reads as a brigade:
            // the auto-suspend rule already ignores reporters under 24h old.
            account_age_days: daysBetween(r.reporter.createdAt, now),
            contribution_score: r.reporter.contributionScore,
            status: r.reporter.status,
          }
        : null,
    })),
    stats: {
      distinct_reporters: distinctReporters,
      reports_against_count: reportsAgainst.length,
      reports_filed_count: reportsFiledCount,
      coupons_by_status: Object.fromEntries(coupons.map((c) => [c.status, c._count])),
      transactions_total: txns.length,
      transactions_completed: txns.filter((t) => t.status === "COMPLETED").length,
      transactions_disputed: txns.filter((t) => t.disputedAt !== null).length,
      rating_avg: ratings._avg?.ratingScore ?? null,
      rating_count: ratings._count,
      appeals_count: appeals.length,
    },
    timeline,
  });
});
