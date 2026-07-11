import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { LEVELS } from "@/lib/levels";

export const runtime = "nodejs";

const DAY = 86_400_000;
const SIGNUP_WINDOWS = [3, 6, 12, 24, 48] as const;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function signupWindowFromReq(req: Request): (typeof SIGNUP_WINDOWS)[number] {
  const raw = Number(new URL(req.url).searchParams.get("signup_hours") || 24);
  return SIGNUP_WINDOWS.includes(raw as (typeof SIGNUP_WINDOWS)[number])
    ? (raw as (typeof SIGNUP_WINDOWS)[number])
    : 24;
}

function ageRangeForBirthYear(birthYear: number | null, now: Date): string {
  if (!birthYear) return "未填";
  const age = now.getFullYear() - birthYear;
  if (age < 18) return "13–17";
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  return "55+";
}

// Admin analytics: registrations, coupons, transactions, breakdowns,
// 30-day trends, leaderboards and recent activity. Admin-only.
export const GET = route(async (req) => {
  await requireAdmin();

  const now = new Date();
  const signupHours = signupWindowFromReq(req);
  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const signupWindowStart = new Date(now.getTime() - signupHours * 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 29 * DAY);
  windowStart.setHours(0, 0, 0, 0);

  const [
    userTotal,
    userActive,
    userSuspended,
    userNew24,
    userNew7,
    userNew30,
    couponTotal,
    couponNew24,
    couponNew7,
    couponNew30,
    claimTotal,
    claimPending,
    txnTotal,
    txnCompleted,
    txnGift,
    txnExchange,
    reportTotal,
    reportPending,
    appealTotal,
    appealPending,
    followTotal,
    ratingAgg,
    byCategory,
    byStatus,
    byType,
    byLevel,
    topBrandsRaw,
    followedBrandsRaw,
    topContributors,
    recentUsers,
    recentCoupons,
    userTs,
    couponTs,
    txnTs,
    userNew3h,
    userNew6h,
    userNew12h,
    userNew48h,
    userNewSelected,
    hourHeatRaw,
    byBirthYear,
    byUtmSource,
    utmPostRaw,
    dailyClaimersRaw,
    dailySharersRaw,
    dauRaw,
    wauRaw,
    sharersRaw,
    claimersRaw,
    completersRaw,
    returningRaw,
    referredCount,
    byProvider,
    weeklyCompletedRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { createdAt: { gte: since(1) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(30) } } }),
    prisma.coupon.count(),
    prisma.coupon.count({ where: { createdAt: { gte: since(1) } } }),
    prisma.coupon.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.coupon.count({ where: { createdAt: { gte: since(30) } } }),
    prisma.claimRequest.count(),
    prisma.claimRequest.count({ where: { status: "PENDING" } }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { status: "COMPLETED" } }),
    prisma.transaction.count({ where: { transactionType: "GIFT" } }),
    prisma.transaction.count({ where: { transactionType: "EXCHANGE" } }),
    prisma.report.count(),
    prisma.report.count({ where: { status: { in: ["PENDING", "REVIEWING"] } } }),
    prisma.appeal.count(),
    prisma.appeal.count({ where: { status: "PENDING" } }),
    prisma.brandFollow.count(),
    prisma.rating.aggregate({ _avg: { ratingScore: true }, _count: true }),
    prisma.coupon.groupBy({ by: ["category"], _count: true }),
    prisma.coupon.groupBy({ by: ["status"], _count: true }),
    prisma.coupon.groupBy({ by: ["type"], _count: true }),
    prisma.user.groupBy({ by: ["userLevel"], _count: true }),
    prisma.coupon.groupBy({
      by: ["brand"],
      _count: { brand: true },
      orderBy: { _count: { brand: "desc" } },
      take: 8,
    }),
    prisma.brandFollow.groupBy({
      by: ["brand"],
      _count: { brand: true },
      orderBy: { _count: { brand: "desc" } },
      take: 8,
    }),
    prisma.user.findMany({
      where: { status: { not: "DELETED" } },
      orderBy: { contributionScore: "desc" },
      take: 8,
      select: { id: true, displayName: true, avatarUrl: true, userLevel: true, contributionScore: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        userLevel: true,
        loginProvider: true,
        createdAt: true,
      },
    }),
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        brand: true,
        type: true,
        category: true,
        status: true,
        createdAt: true,
        owner: { select: { displayName: true } },
      },
    }),
    // Daily counts aggregated in SQL (GROUP BY) instead of pulling every row into
    // memory — these scale with 30-day volume and were previously unbounded.
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c FROM users WHERE created_at >= ${windowStart} GROUP BY 1`,
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c FROM coupons WHERE created_at >= ${windowStart} GROUP BY 1`,
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c FROM transactions WHERE created_at >= ${windowStart} GROUP BY 1`,
    prisma.user.count({ where: { createdAt: { gte: since(0.125) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(0.25) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(0.5) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(2) } } }),
    prisma.user.count({ where: { createdAt: { gte: signupWindowStart } } }),
    // Registration-by-hour heatmap in Taipei time (UTC+8), scoped to the selected window.
    prisma.$queryRaw<{ h: number; c: number }[]>`
      SELECT EXTRACT(HOUR FROM created_at + interval '8 hours')::int AS h,
             COUNT(*)::int AS c
      FROM users
      WHERE created_at >= ${signupWindowStart}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.user.groupBy({ by: ["birthYear"], _count: true }),
    prisma.user.groupBy({
      by: ["utmSource"],
      where: { utmSource: { not: null } },
      _count: true,
      orderBy: { _count: { utmSource: "desc" } },
      take: 8,
    }),
    prisma.$queryRaw<{ source: string | null; medium: string | null; campaign: string | null; content: string | null; c: number }[]>`
      SELECT utm_source AS source,
             utm_medium AS medium,
             utm_campaign AS campaign,
             utm_content AS content,
             COUNT(*)::int AS c
      FROM users
      WHERE utm_source IS NOT NULL
         OR utm_campaign IS NOT NULL
         OR utm_content IS NOT NULL
      GROUP BY 1, 2, 3, 4
      ORDER BY c DESC
      LIMIT 10
    `,
    // Distinct users who applied for a coupon, per day (30-day window).
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(DISTINCT requester_id)::int AS c FROM claim_requests WHERE created_at >= ${windowStart} GROUP BY 1`,
    // Distinct users who published a coupon, per day. JOIN users so audit rows
    // left behind by deleted accounts don't inflate the count.
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(a.created_at, 'YYYY-MM-DD') AS d, COUNT(DISTINCT a.actor_id)::int AS c FROM audit_logs a JOIN users u ON u.id = a.actor_id WHERE a.action = 'coupon.publish' AND a.created_at >= ${windowStart} GROUP BY 1`,
    // DAU: distinct still-existing users with any audited activity, per day.
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(a.created_at, 'YYYY-MM-DD') AS d, COUNT(DISTINCT a.actor_id)::int AS c FROM audit_logs a JOIN users u ON u.id = a.actor_id WHERE a.created_at >= ${windowStart} GROUP BY 1`,
    // WAU: distinct still-existing active users in the trailing 7 days.
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT a.actor_id)::int AS c FROM audit_logs a JOIN users u ON u.id = a.actor_id WHERE a.created_at >= ${since(7)}`,
    // Activation funnel: distinct users who ever shared / claimed / completed.
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT a.actor_id)::int AS c FROM audit_logs a JOIN users u ON u.id = a.actor_id WHERE a.action = 'coupon.publish'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT cr.requester_id)::int AS c FROM claim_requests cr JOIN users u ON u.id = cr.requester_id`,
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT uid)::int AS c FROM (SELECT owner_id AS uid FROM transactions WHERE status = 'COMPLETED' UNION SELECT claimant_id FROM transactions WHERE status = 'COMPLETED') t`,
    // Returning: active in last 7d AND registered more than 7d ago.
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT a.actor_id)::int AS c FROM audit_logs a JOIN users u ON u.id = a.actor_id WHERE a.created_at >= ${since(7)} AND u.created_at < ${since(7)}`,
    // Registration source: how many came in through a friend's invite link.
    prisma.user.count({ where: { referredById: { not: null } } }),
    prisma.user.groupBy({ by: ["loginProvider"], _count: true }),
    // Weekly completed transactions: past 8 weeks (Monday-based), current week included.
    prisma.$queryRaw<{ week: string; c: number }[]>`
      SELECT to_char(date_trunc('week', completed_at), 'YYYY-MM-DD') AS week,
             COUNT(*)::int AS c
      FROM transactions
      WHERE completed_at IS NOT NULL
        AND completed_at >= date_trunc('week', NOW()) - INTERVAL '7 weeks'
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const days: string[] = [];
  const keyIndex = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(windowStart.getTime() + i * DAY);
    keyIndex.set(dayKey(d), i);
    days.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  // Raw daily aggregates keyed by 'YYYY-MM-DD' → the same 30-slot series shape.
  const dailyBucket = (rows: { d: string; c: number }[]) => {
    const arr = new Array<number>(30).fill(0);
    for (const r of rows) {
      const i = keyIndex.get(r.d);
      if (i !== undefined) arr[i] = Number(r.c);
    }
    return arr;
  };
  const heatmapHours = new Array<number>(24).fill(0);
  for (const r of hourHeatRaw) heatmapHours[Number(r.h)] = Number(r.c);
  const dauSeries = dailyBucket(dauRaw);

  const ageOrder = ["13–17", "18–24", "25–34", "35–44", "45–54", "55+", "未填"];
  const ageCounts = new Map(ageOrder.map((label) => [label, 0]));
  for (const r of byBirthYear) {
    const label = ageRangeForBirthYear(r.birthYear, now);
    ageCounts.set(label, (ageCounts.get(label) ?? 0) + r._count);
  }
  const byAge = ageOrder.map((label) => ({ key: label, count: ageCounts.get(label) ?? 0 }));

  type Group = { _count: number };
  const grp = <T extends Group>(rows: T[], field: keyof T) =>
    rows
      .map((r) => ({ key: String(r[field]), count: r._count }))
      .sort((a, b) => b.count - a.count);

  const utmPosts = utmPostRaw.map((r) => ({
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    content: r.content,
    post: r.content || r.campaign || "未命名貼文",
    count: Number(r.c),
  }));

  // Build 8-slot weekly array (ISO week Monday labels as MM/DD).
  const weeklyCompleted: { label: string; count: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const monday = new Date(now);
    // Roll back to this week's Monday, then subtract w weeks.
    const dayOfWeek = monday.getDay(); // 0=Sun
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(monday.getDate() - daysToMonday - w * 7);
    monday.setHours(0, 0, 0, 0);
    const isoWeek = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const label = `${monday.getMonth() + 1}/${monday.getDate()}`;
    const row = weeklyCompletedRaw.find((r) => r.week === isoWeek);
    weeklyCompleted.push({ label, count: row ? Number(row.c) : 0 });
  }

  return jsonOk({
    generated_at: now.toISOString(),
    overview: {
      users: {
        total: userTotal,
        active: userActive,
        suspended: userSuspended,
        new_3h: userNew3h,
        new_6h: userNew6h,
        new_12h: userNew12h,
        new_24h: userNew24,
        new_48h: userNew48h,
        new_7d: userNew7,
        new_30d: userNew30,
      },
      coupons: {
        total: couponTotal,
        new_24h: couponNew24,
        new_7d: couponNew7,
        new_30d: couponNew30,
      },
      transactions: { total: txnTotal, completed: txnCompleted, gift: txnGift, exchange: txnExchange },
      claims: { total: claimTotal, pending: claimPending },
      reports: { total: reportTotal, pending: reportPending },
      appeals: { total: appealTotal, pending: appealPending },
      brand_follows: followTotal,
      ratings: { count: ratingAgg._count, avg: ratingAgg._avg.ratingScore ?? null },
    },
    by_category: grp(byCategory, "category"),
    by_status: grp(byStatus, "status"),
    by_type: grp(byType, "type"),
    by_level: grp(byLevel, "userLevel"),
    by_age: byAge,
    weekly_completed: weeklyCompleted,
    series: {
      days,
      signups: dailyBucket(userTs),
      coupons: dailyBucket(couponTs),
      transactions: dailyBucket(txnTs),
      claimers: dailyBucket(dailyClaimersRaw),
      sharers: dailyBucket(dailySharersRaw),
      dau: dauSeries,
    },
    active_users: { dau_today: dauSeries[29] ?? 0, wau: Number(wauRaw[0]?.c ?? 0) },
    activation: {
      registered: userTotal,
      shared: Number(sharersRaw[0]?.c ?? 0),
      claimed: Number(claimersRaw[0]?.c ?? 0),
      completed: Number(completersRaw[0]?.c ?? 0),
      returning_7d: Number(returningRaw[0]?.c ?? 0),
    },
    sources: {
      referred: referredCount,
      organic: userTotal - referredCount,
      by_provider: grp(byProvider, "loginProvider"),
    },
    signup_window: {
      hours: signupHours,
      started_at: signupWindowStart.toISOString(),
      count: userNewSelected,
    },
    heatmap_hours: heatmapHours,
    utm: {
      tracked: utmPosts.reduce((total, p) => total + p.count, 0),
      by_source: grp(byUtmSource, "utmSource"),
      top_posts: utmPosts,
    },
    top_contributors: topContributors.map((u) => ({
      id: u.id,
      display_name: u.displayName,
      avatar_url: u.avatarUrl,
      level_name: LEVELS[u.userLevel].name,
      contribution_score: u.contributionScore,
    })),
    top_brands: topBrandsRaw.map((b) => ({ brand: b.brand, count: b._count.brand })),
    followed_brands: followedBrandsRaw.map((b) => ({ brand: b.brand, count: b._count.brand })),
    recent_users: recentUsers.map((u) => ({
      id: u.id,
      display_name: u.displayName,
      avatar_url: u.avatarUrl,
      level_name: LEVELS[u.userLevel].name,
      provider: u.loginProvider,
      created_at: u.createdAt,
    })),
    recent_coupons: recentCoupons.map((c) => ({
      id: c.id,
      title: c.title,
      brand: c.brand,
      type: c.type,
      category: c.category,
      status: c.status,
      owner: c.owner.displayName,
      created_at: c.createdAt,
    })),
  });
});
