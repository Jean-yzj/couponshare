import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { LEVELS } from "@/lib/levels";

export const runtime = "nodejs";

const DAY = 86_400_000;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Admin analytics: registrations, coupons, transactions, breakdowns,
// 30-day trends, leaderboards and recent activity. Admin-only.
export const GET = route(async () => {
  await requireAdmin();

  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * DAY);
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
    userNew48h,
    hourHeatRaw,
    dailyClaimersRaw,
    dailySharersRaw,
    dauRaw,
    wauRaw,
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
    prisma.user.findMany({ where: { createdAt: { gte: windowStart } }, select: { createdAt: true } }),
    prisma.coupon.findMany({ where: { createdAt: { gte: windowStart } }, select: { createdAt: true } }),
    prisma.transaction.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: since(0.125) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(2) } } }),
    // Registration-by-hour heatmap in Taipei time (UTC+8). DB-side aggregation.
    prisma.$queryRaw<{ h: number; c: number }[]>`SELECT EXTRACT(HOUR FROM created_at + interval '8 hours')::int AS h, COUNT(*)::int AS c FROM users GROUP BY 1 ORDER BY 1`,
    // Distinct users who applied for a coupon, per day (30-day window).
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(DISTINCT requester_id)::int AS c FROM claim_requests WHERE created_at >= ${windowStart} GROUP BY 1`,
    // Distinct users who published a coupon, per day.
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(DISTINCT actor_id)::int AS c FROM audit_logs WHERE action = 'coupon.publish' AND created_at >= ${windowStart} GROUP BY 1`,
    // DAU proxy: distinct users with any audited activity, per day.
    prisma.$queryRaw<{ d: string; c: number }[]>`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(DISTINCT actor_id)::int AS c FROM audit_logs WHERE created_at >= ${windowStart} GROUP BY 1`,
    // WAU: distinct active users in the trailing 7 days.
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT actor_id)::int AS c FROM audit_logs WHERE created_at >= ${since(7)}`,
  ]);

  const days: string[] = [];
  const keyIndex = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(windowStart.getTime() + i * DAY);
    keyIndex.set(dayKey(d), i);
    days.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  const bucket = (rows: { createdAt: Date }[]) => {
    const arr = new Array<number>(30).fill(0);
    for (const r of rows) {
      const i = keyIndex.get(dayKey(new Date(r.createdAt)));
      if (i !== undefined) arr[i] += 1;
    }
    return arr;
  };
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

  type Group = { _count: number };
  const grp = <T extends Group>(rows: T[], field: keyof T) =>
    rows
      .map((r) => ({ key: String(r[field]), count: r._count }))
      .sort((a, b) => b.count - a.count);

  return jsonOk({
    generated_at: now.toISOString(),
    overview: {
      users: {
        total: userTotal,
        active: userActive,
        suspended: userSuspended,
        new_3h: userNew3h,
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
    series: {
      days,
      signups: bucket(userTs),
      coupons: bucket(couponTs),
      transactions: bucket(txnTs),
      claimers: dailyBucket(dailyClaimersRaw),
      sharers: dailyBucket(dailySharersRaw),
      dau: dauSeries,
    },
    active_users: { dau_today: dauSeries[29] ?? 0, wau: Number(wauRaw[0]?.c ?? 0) },
    heatmap_hours: heatmapHours,
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
