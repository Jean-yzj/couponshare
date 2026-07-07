import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { LEVELS } from "@/lib/levels";

// Returns "YYYY-MM-DD" in Taipei time (UTC+8) for the given epoch ms.
function taipeiDay(epochMs: number): string {
  return new Date(epochMs + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

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

// ── Module-level response cache ────────────────────────────────────────────────
// Key: signupHours. TTL: 60 seconds. Admin opens auto-refresh; 40+ DB queries
// must not run on every tick.
interface CacheEntry {
  data: unknown;
  ts: number;
}
const responseCache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 60_000;

// Admin analytics: registrations, coupons, transactions, breakdowns,
// 30-day trends, leaderboards and recent activity. Admin-only.
export const GET = route(async (req) => {
  await requireAdmin();

  const now = new Date();
  const signupHours = signupWindowFromReq(req);

  // ── Cache check ──────────────────────────────────────────────────────────────
  const cached = responseCache.get(signupHours);
  if (cached && now.getTime() - cached.ts < CACHE_TTL_MS) {
    return jsonOk({ ...(cached.data as Record<string, unknown>), cached: true });
  }

  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const signupWindowStart = new Date(now.getTime() - signupHours * 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 29 * DAY);
  windowStart.setHours(0, 0, 0, 0);

  // ── Taipei time helpers (for raw SQL) ────────────────────────────────────────
  // Taipei = UTC+8. Pattern: created_at + interval '8 hours'
  // Today Taipei 00:00 in UTC:
  const nowMs = now.getTime();
  const taipeiDayStr = new Date(nowMs + 8 * 3600 * 1000).toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const todayTaipeiStart = new Date(`${taipeiDayStr}T00:00:00+08:00`);    // UTC midnight of Taipei today
  const yesterdayTaipeiStart = new Date(todayTaipeiStart.getTime() - DAY);
  const elapsed = now.getTime() - todayTaipeiStart.getTime(); // ms since Taipei 00:00 today
  const yesterdaySameTime = new Date(yesterdayTaipeiStart.getTime() + elapsed); // yesterday same clock

  // ── 4-hour bucket helpers ────────────────────────────────────────────────────
  // 12 buckets spanning 48 hours back. Each bucket is 4h, aligned to Taipei
  // calendar: bucket index 0 = 48h ago rounded down to 4h boundary.
  // We build the 12 labels and pass start/end to SQL.
  const BUCKET_MS = 4 * 3600 * 1000;
  // Current Taipei hour, floored to 4h boundary:
  const taipeiHourNow = Math.floor((nowMs + 8 * 3600 * 1000) / BUCKET_MS) * BUCKET_MS - 8 * 3600 * 1000;
  // 12 buckets: [taipeiHourNow - 11*4h, taipeiHourNow)
  const fourHourStart = new Date(taipeiHourNow - 11 * BUCKET_MS);
  const fourHourEnd = new Date(taipeiHourNow + BUCKET_MS); // exclusive upper bound = current bucket end

  // ── Retention helpers ─────────────────────────────────────────────────────────
  // 8 cohort weeks (Monday-based, Taipei). Oldest = 8 weeks ago Monday.
  // We pass the 8 week-start timestamps to a single SQL query.
  function taipeiMonday(weeksAgo: number): Date {
    // Monday of the current Taipei week, minus weeksAgo weeks.
    const taipeiNow = new Date(nowMs + 8 * 3600 * 1000);
    const dayOfWeek = taipeiNow.getUTCDay(); // 0=Sun
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMondayTaipei = new Date(taipeiNow.getTime() - daysToMon * DAY);
    thisMondayTaipei.setUTCHours(0, 0, 0, 0);
    // Convert to UTC for the Taipei 00:00 moment: subtract 8h
    const thisMondayUtc = new Date(thisMondayTaipei.getTime() - 8 * 3600 * 1000);
    return new Date(thisMondayUtc.getTime() - weeksAgo * 7 * DAY);
  }
  const cohortStarts = Array.from({ length: 8 }, (_, i) => taipeiMonday(7 - i)); // oldest first

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
    // ── New queries ──────────────────────────────────────────────────────────────
    realtimeRaw,
    todaySignups,
    ydaySignups,
    avg7dSignups,
    todayCoupons,
    ydayCoupons,
    avg7dCoupons,
    todayClaims,
    ydayClaims,
    avg7dClaims,
    todayCompleted,
    ydayCompleted,
    avg7dCompleted,
    todayReports,
    ydayReports,
    avg7dReports,
    fourHourRaw, // { metric, bkey, c }[]
    heatmap14Raw,
    retentionRaw,
    pendingOver48hCount,
    couponExpiringCount,
    utmConversionRaw,
    dailyClaimsSeriesRaw,
    dailyCompletedSeriesRaw,
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

    // ── realtime: online_5m / active_30m / active_1h / active_24h ───────────────
    prisma.$queryRaw<{ online_5m: number; active_30m: number; active_1h: number; active_24h: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '5 minutes')::int  AS online_5m,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 minutes')::int AS active_30m,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '1 hour')::int     AS active_1h,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '24 hours')::int   AS active_24h
      FROM users
      WHERE last_seen_at IS NOT NULL
    `,

    // ── today_vs: signups ─────────────────────────────────────────────────────────
    prisma.user.count({ where: { createdAt: { gte: todayTaipeiStart } } }),
    prisma.user.count({ where: { createdAt: { gte: yesterdayTaipeiStart, lt: yesterdaySameTime } } }),
    prisma.$queryRaw<{ avg: string }[]>`
      SELECT ROUND(AVG(cnt)::numeric, 1)::text AS avg
      FROM (
        SELECT COUNT(*)::int AS cnt
        FROM users
        WHERE created_at >= ${new Date(todayTaipeiStart.getTime() - 7 * DAY)}
          AND created_at <  ${todayTaipeiStart}
        GROUP BY DATE(created_at + INTERVAL '8 hours')
      ) sub
    `,

    // ── today_vs: coupons ─────────────────────────────────────────────────────────
    prisma.coupon.count({ where: { createdAt: { gte: todayTaipeiStart } } }),
    prisma.coupon.count({ where: { createdAt: { gte: yesterdayTaipeiStart, lt: yesterdaySameTime } } }),
    prisma.$queryRaw<{ avg: string }[]>`
      SELECT ROUND(AVG(cnt)::numeric, 1)::text AS avg
      FROM (
        SELECT COUNT(*)::int AS cnt
        FROM coupons
        WHERE created_at >= ${new Date(todayTaipeiStart.getTime() - 7 * DAY)}
          AND created_at <  ${todayTaipeiStart}
        GROUP BY DATE(created_at + INTERVAL '8 hours')
      ) sub
    `,

    // ── today_vs: claims ──────────────────────────────────────────────────────────
    prisma.claimRequest.count({ where: { createdAt: { gte: todayTaipeiStart } } }),
    prisma.claimRequest.count({ where: { createdAt: { gte: yesterdayTaipeiStart, lt: yesterdaySameTime } } }),
    prisma.$queryRaw<{ avg: string }[]>`
      SELECT ROUND(AVG(cnt)::numeric, 1)::text AS avg
      FROM (
        SELECT COUNT(*)::int AS cnt
        FROM claim_requests
        WHERE created_at >= ${new Date(todayTaipeiStart.getTime() - 7 * DAY)}
          AND created_at <  ${todayTaipeiStart}
        GROUP BY DATE(created_at + INTERVAL '8 hours')
      ) sub
    `,

    // ── today_vs: completed ───────────────────────────────────────────────────────
    prisma.transaction.count({ where: { status: "COMPLETED", completedAt: { gte: todayTaipeiStart } } }),
    prisma.transaction.count({ where: { status: "COMPLETED", completedAt: { gte: yesterdayTaipeiStart, lt: yesterdaySameTime } } }),
    prisma.$queryRaw<{ avg: string }[]>`
      SELECT ROUND(AVG(cnt)::numeric, 1)::text AS avg
      FROM (
        SELECT COUNT(*)::int AS cnt
        FROM transactions
        WHERE status = 'COMPLETED'
          AND completed_at >= ${new Date(todayTaipeiStart.getTime() - 7 * DAY)}
          AND completed_at <  ${todayTaipeiStart}
        GROUP BY DATE(completed_at + INTERVAL '8 hours')
      ) sub
    `,

    // ── today_vs: reports ─────────────────────────────────────────────────────────
    prisma.report.count({ where: { createdAt: { gte: todayTaipeiStart } } }),
    prisma.report.count({ where: { createdAt: { gte: yesterdayTaipeiStart, lt: yesterdaySameTime } } }),
    prisma.$queryRaw<{ avg: string }[]>`
      SELECT ROUND(AVG(cnt)::numeric, 1)::text AS avg
      FROM (
        SELECT COUNT(*)::int AS cnt
        FROM reports
        WHERE created_at >= ${new Date(todayTaipeiStart.getTime() - 7 * DAY)}
          AND created_at <  ${todayTaipeiStart}
        GROUP BY DATE(created_at + INTERVAL '8 hours')
      ) sub
    `,

    // ── four_hour: 12 buckets, 4h each, 48h window, Taipei-aligned ───────────────
    // Each metric aggregates its own table independently; UNION ALL avoids any
    // cross-join. bkey = Taipei-aligned 'YYYY-MM-DD HH' bucket start hour.
    prisma.$queryRaw<{ metric: string; bkey: string; c: number }[]>`
      SELECT 'signups' AS metric,
        to_char(
          date_trunc('hour', created_at + INTERVAL '8 hours') -
          EXTRACT(hour FROM created_at + INTERVAL '8 hours')::int % 4 * INTERVAL '1 hour',
          'YYYY-MM-DD HH24'
        ) AS bkey,
        COUNT(*)::int AS c
      FROM users
      WHERE created_at >= ${fourHourStart} AND created_at < ${fourHourEnd}
      GROUP BY 2
      UNION ALL
      SELECT 'coupons',
        to_char(
          date_trunc('hour', created_at + INTERVAL '8 hours') -
          EXTRACT(hour FROM created_at + INTERVAL '8 hours')::int % 4 * INTERVAL '1 hour',
          'YYYY-MM-DD HH24'
        ),
        COUNT(*)::int
      FROM coupons
      WHERE created_at >= ${fourHourStart} AND created_at < ${fourHourEnd}
      GROUP BY 2
      UNION ALL
      SELECT 'claims',
        to_char(
          date_trunc('hour', created_at + INTERVAL '8 hours') -
          EXTRACT(hour FROM created_at + INTERVAL '8 hours')::int % 4 * INTERVAL '1 hour',
          'YYYY-MM-DD HH24'
        ),
        COUNT(*)::int
      FROM claim_requests
      WHERE created_at >= ${fourHourStart} AND created_at < ${fourHourEnd}
      GROUP BY 2
      UNION ALL
      SELECT 'completed',
        to_char(
          date_trunc('hour', completed_at + INTERVAL '8 hours') -
          EXTRACT(hour FROM completed_at + INTERVAL '8 hours')::int % 4 * INTERVAL '1 hour',
          'YYYY-MM-DD HH24'
        ),
        COUNT(*)::int
      FROM transactions
      WHERE completed_at >= ${fourHourStart} AND completed_at < ${fourHourEnd}
      GROUP BY 2
      UNION ALL
      SELECT 'active',
        to_char(
          date_trunc('hour', created_at + INTERVAL '8 hours') -
          EXTRACT(hour FROM created_at + INTERVAL '8 hours')::int % 4 * INTERVAL '1 hour',
          'YYYY-MM-DD HH24'
        ),
        COUNT(DISTINCT actor_id)::int
      FROM audit_logs
      WHERE actor_id IS NOT NULL AND created_at >= ${fourHourStart} AND created_at < ${fourHourEnd}
      GROUP BY 2
    `,

    // ── activity_heatmap: 14 days, 7×24 Taipei matrix ────────────────────────────
    prisma.$queryRaw<{ metric: string; weekday: number; hour: number; c: number }[]>`
      WITH range_start AS (SELECT NOW() - INTERVAL '14 days' AS s)
      SELECT metric, weekday, hour, SUM(c)::int AS c FROM (
        SELECT 'claims' AS metric,
               EXTRACT(DOW FROM created_at + INTERVAL '8 hours')::int AS weekday,
               EXTRACT(HOUR FROM created_at + INTERVAL '8 hours')::int AS hour,
               COUNT(*)::int AS c
        FROM claim_requests
        WHERE created_at >= (SELECT s FROM range_start)
        GROUP BY 2, 3
        UNION ALL
        SELECT 'uploads' AS metric,
               EXTRACT(DOW FROM created_at + INTERVAL '8 hours')::int,
               EXTRACT(HOUR FROM created_at + INTERVAL '8 hours')::int,
               COUNT(*)::int
        FROM coupons
        WHERE created_at >= (SELECT s FROM range_start)
        GROUP BY 2, 3
        UNION ALL
        SELECT 'completions' AS metric,
               EXTRACT(DOW FROM completed_at + INTERVAL '8 hours')::int,
               EXTRACT(HOUR FROM completed_at + INTERVAL '8 hours')::int,
               COUNT(*)::int
        FROM transactions
        WHERE completed_at >= (SELECT s FROM range_start)
        GROUP BY 2, 3
      ) sub
      GROUP BY metric, weekday, hour
    `,

    // ── retention: 8 cohort weeks ─────────────────────────────────────────────────
    // cohort_users / activity CTEs are unchanged (PG uses hash semi-join for EXISTS).
    // Aggregation now happens inside SQL → at most 8 rows returned, not per-user rows.
    prisma.$queryRaw<{
      cohort_start: Date;
      size: number;
      d1_eligible: number;
      d1: number;
      d7_eligible: number;
      d7: number;
      d30_eligible: number;
      d30: number;
    }[]>`
      WITH cohort_users AS (
        SELECT
          u.id AS user_id,
          u.created_at AS registered_at,
          date_trunc('week', u.created_at + INTERVAL '8 hours') - INTERVAL '8 hours' AS cohort_start
        FROM users u
        WHERE u.created_at >= ${cohortStarts[0]}
          AND u.created_at <  ${new Date(cohortStarts[7].getTime() + 7 * DAY)}
      ),
      activity AS (
        SELECT actor_id AS user_id, DATE(created_at + INTERVAL '8 hours') AS active_day
        FROM audit_logs
        WHERE actor_id IS NOT NULL
          AND created_at >= ${cohortStarts[0]}
        UNION
        SELECT user_id, day AS active_day
        FROM daily_actives
        WHERE day >= ${cohortStarts[0]}
      ),
      per_user AS (
        SELECT
          cu.cohort_start,
          cu.registered_at,
          EXISTS (
            SELECT 1 FROM activity a
            WHERE a.user_id = cu.user_id
              AND a.active_day = DATE(cu.registered_at + INTERVAL '8 hours' + INTERVAL '1 day')
          ) AS has_d1,
          EXISTS (
            SELECT 1 FROM activity a
            WHERE a.user_id = cu.user_id
              AND a.active_day > DATE(cu.registered_at + INTERVAL '8 hours')
              AND a.active_day <= DATE(cu.registered_at + INTERVAL '8 hours') + 7
          ) AS has_d7,
          EXISTS (
            SELECT 1 FROM activity a
            WHERE a.user_id = cu.user_id
              AND a.active_day > DATE(cu.registered_at + INTERVAL '8 hours')
              AND a.active_day <= DATE(cu.registered_at + INTERVAL '8 hours') + 30
          ) AS has_d30
        FROM cohort_users cu
      )
      SELECT
        cohort_start::timestamptz AS cohort_start,
        COUNT(*)::int AS size,
        COUNT(*) FILTER (WHERE registered_at + INTERVAL '1 day' <= ${now})::int  AS d1_eligible,
        COUNT(*) FILTER (WHERE registered_at + INTERVAL '1 day' <= ${now} AND has_d1)::int  AS d1,
        COUNT(*) FILTER (WHERE registered_at + INTERVAL '7 days' <= ${now})::int AS d7_eligible,
        COUNT(*) FILTER (WHERE registered_at + INTERVAL '7 days' <= ${now} AND has_d7)::int AS d7,
        COUNT(*) FILTER (WHERE registered_at + INTERVAL '30 days' <= ${now})::int AS d30_eligible,
        COUNT(*) FILTER (WHERE registered_at + INTERVAL '30 days' <= ${now} AND has_d30)::int AS d30
      FROM per_user
      GROUP BY cohort_start
      ORDER BY cohort_start
    `,

    // Simpler health fields — separate queries for clarity (health detail runs after cache miss, below):
    prisma.$queryRaw<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM claim_requests
      WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '48 hours'
    `,

    prisma.coupon.count({
      where: {
        status: "AVAILABLE",
        expiryDate: { gte: now, lte: new Date(now.getTime() + 7 * DAY) },
      },
    }),

    // ── utm_conversion: top 8 sources (null → "organic") ─────────────────────────
    prisma.$queryRaw<{
      source: string | null;
      signups: number;
      sharers: number;
      claimers: number;
      active_7d: number;
    }[]>`
      WITH src AS (
        SELECT id, COALESCE(utm_source, 'organic') AS source, created_at, last_seen_at
        FROM users
      ),
      ranked AS (
        SELECT source, COUNT(*)::int AS signups
        FROM src
        GROUP BY source
        ORDER BY signups DESC
        LIMIT 8
      )
      SELECT
        r.source,
        r.signups,
        COUNT(DISTINCT s.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM audit_logs al
            JOIN users u2 ON u2.id = al.actor_id
            WHERE al.actor_id = s.id AND al.action = 'coupon.publish'
          )
        )::int AS sharers,
        COUNT(DISTINCT s.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM claim_requests cr WHERE cr.requester_id = s.id
          )
        )::int AS claimers,
        COUNT(DISTINCT s.id) FILTER (
          WHERE s.last_seen_at >= NOW() - INTERVAL '7 days'
             OR EXISTS (
               SELECT 1 FROM audit_logs al2
               WHERE al2.actor_id = s.id AND al2.created_at >= NOW() - INTERVAL '7 days'
             )
        )::int AS active_7d
      FROM ranked r
      JOIN src s ON s.source = r.source
      GROUP BY r.source, r.signups
      ORDER BY r.signups DESC
    `,

    // ── series.claims: daily claim_requests count, 30-day window ─────────────────
    prisma.$queryRaw<{ d: string; c: number }[]>`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
      FROM claim_requests
      WHERE created_at >= ${windowStart}
      GROUP BY 1
    `,

    // ── series.completed: daily completed transactions, 30-day window ─────────────
    prisma.$queryRaw<{ d: string; c: number }[]>`
      SELECT to_char(completed_at, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
      FROM transactions
      WHERE status = 'COMPLETED' AND completed_at >= ${windowStart}
      GROUP BY 1
    `,
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

  // ── New: realtime ─────────────────────────────────────────────────────────────
  const rt = realtimeRaw[0] ?? { online_5m: 0, active_30m: 0, active_1h: 0, active_24h: 0 };

  // ── New: today_vs ─────────────────────────────────────────────────────────────
  const parseAvg = (rows: { avg: string }[]): number | null => {
    const v = rows[0]?.avg;
    return v === null || v === undefined ? null : parseFloat(v);
  };
  const todayVs = {
    signups:   { today: todaySignups,   yesterday_same_time: ydaySignups,   avg_7d: parseAvg(avg7dSignups) },
    coupons:   { today: todayCoupons,   yesterday_same_time: ydayCoupons,   avg_7d: parseAvg(avg7dCoupons) },
    claims:    { today: todayClaims,    yesterday_same_time: ydayClaims,    avg_7d: parseAvg(avg7dClaims) },
    completed: { today: todayCompleted, yesterday_same_time: ydayCompleted, avg_7d: parseAvg(avg7dCompleted) },
    reports:   { today: todayReports,   yesterday_same_time: ydayReports,   avg_7d: parseAvg(avg7dReports) },
  };

  // ── New: four_hour ────────────────────────────────────────────────────────────
  // fourHourRaw is now { metric, bkey, c }[] rows from UNION ALL.
  // bkey format: 'YYYY-MM-DD HH' in Taipei time (same formula as SQL bucket_expr).
  // JS builds the 12 expected bkeys using the same UTC+8 alignment as SQL, then
  // looks up each (metric, bkey) pair — guaranteeing JS and SQL bucket keys match.
  const fourHourLabels: string[] = [];
  const fhSignups: number[] = [];
  const fhCoupons: number[] = [];
  const fhClaims: number[] = [];
  const fhCompleted: number[] = [];
  const fhActive: number[] = [];

  // Index SQL rows by "metric|bkey" for O(1) lookup.
  const fhIndex = new Map<string, number>();
  for (const r of fourHourRaw) {
    fhIndex.set(`${r.metric}|${r.bkey}`, Number(r.c));
  }

  // Build expected 12 bucket keys using same UTC+8 + 4h-floor logic.
  for (let i = 0; i < 12; i++) {
    const bucketUtc = new Date(fourHourStart.getTime() + i * BUCKET_MS);
    const bucketTaipei = new Date(bucketUtc.getTime() + 8 * 3600 * 1000);
    const mm = bucketTaipei.getUTCMonth() + 1;
    const dd = bucketTaipei.getUTCDate();
    const hh = bucketTaipei.getUTCHours();
    const hhEnd = hh + 4;
    fourHourLabels.push(`${mm}/${dd} ${String(hh).padStart(2, "0")}-${String(hhEnd).padStart(2, "0")}`);
    // bkey must exactly match SQL to_char output: 'YYYY-MM-DD HH'
    const bkey = `${bucketTaipei.getUTCFullYear()}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")} ${String(hh).padStart(2, "0")}`;
    fhSignups.push(fhIndex.get(`signups|${bkey}`) ?? 0);
    fhCoupons.push(fhIndex.get(`coupons|${bkey}`) ?? 0);
    fhClaims.push(fhIndex.get(`claims|${bkey}`) ?? 0);
    fhCompleted.push(fhIndex.get(`completed|${bkey}`) ?? 0);
    fhActive.push(fhIndex.get(`active|${bkey}`) ?? 0);
  }

  // ── New: activity_heatmap ─────────────────────────────────────────────────────
  // 7×24 per metric. weekday 0=Sun from SQL (EXTRACT DOW). Re-map to 0=Mon.
  const makeMatrix = () => Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const hmClaims = makeMatrix();
  const hmUploads = makeMatrix();
  const hmCompletions = makeMatrix();
  for (const r of heatmap14Raw) {
    // SQL DOW: 0=Sun,1=Mon,...,6=Sat → re-map to 0=Mon: (DOW+6)%7
    const wd = (Number(r.weekday) + 6) % 7;
    const h = Number(r.hour);
    const c = Number(r.c);
    if (r.metric === "claims")      hmClaims[wd][h] = c;
    if (r.metric === "uploads")     hmUploads[wd][h] = c;
    if (r.metric === "completions") hmCompletions[wd][h] = c;
  }

  // ── New: retention ────────────────────────────────────────────────────────────
  // SQL now returns at most 8 pre-aggregated rows (one per cohort week).
  // JS just maps each cohort week to the matching SQL row (or a zero placeholder).
  const retentionSqlIndex = new Map<string, typeof retentionRaw[number]>();
  for (const row of retentionRaw) {
    retentionSqlIndex.set(taipeiDay(new Date(row.cohort_start).getTime()), row);
  }
  const retention = cohortStarts.map((cs) => {
    const key = taipeiDay(cs.getTime());
    const row = retentionSqlIndex.get(key);
    if (!row) return { week_start: key, size: 0, d1: 0, d1_eligible: 0, d7: 0, d7_eligible: 0, d30: 0, d30_eligible: 0 };
    return {
      week_start:   key,
      size:         Number(row.size),
      d1_eligible:  Number(row.d1_eligible),
      d1:           Number(row.d1),
      d7_eligible:  Number(row.d7_eligible),
      d7:           Number(row.d7),
      d30_eligible: Number(row.d30_eligible),
      d30:          Number(row.d30),
    };
  });

  // ── New: health ────────────────────────────────────────────────────────────────
  const pendingOver48h = Number(pendingOver48hCount[0]?.c ?? 0);

  // Health metrics in a focused query (runs after the main Promise.all):
  const [healthDetail] = await Promise.all([
    prisma.$queryRaw<{
      claim_approval_rate: string | null;
      avg_claims_per_coupon: string | null;
      avg_hours_to_claim: string | null;
      supply_demand_7d: string | null;
    }[]>`
      SELECT
        CASE WHEN SUM(CASE WHEN status IN ('APPROVED','REJECTED') THEN 1 ELSE 0 END) = 0
             THEN NULL
             ELSE ROUND(
               SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END)::numeric /
               NULLIF(SUM(CASE WHEN status IN ('APPROVED','REJECTED') THEN 1 ELSE 0 END), 0),
               4
             )::text
        END AS claim_approval_rate,
        (SELECT ROUND(AVG(claim_request_count)::numeric, 1)::text FROM coupons WHERE status != 'DRAFT') AS avg_claims_per_coupon,
        (SELECT ROUND(EXTRACT(EPOCH FROM AVG(claimed_at - created_at)) / 3600, 1)::text
         FROM coupons WHERE status = 'CLAIMED' AND claimed_at IS NOT NULL) AS avg_hours_to_claim,
        CASE WHEN (SELECT COUNT(*) FROM claim_requests WHERE created_at >= NOW() - INTERVAL '7 days') = 0
             THEN NULL
             ELSE ROUND(
               (SELECT COUNT(*)::numeric FROM coupons WHERE created_at >= NOW() - INTERVAL '7 days') /
               NULLIF((SELECT COUNT(*) FROM claim_requests WHERE created_at >= NOW() - INTERVAL '7 days'), 0),
               2
             )::text
        END AS supply_demand_7d
      FROM claim_requests
    `,
  ]);
  const hd = healthDetail[0] ?? { claim_approval_rate: null, avg_claims_per_coupon: null, avg_hours_to_claim: null, supply_demand_7d: null };
  const health = {
    claim_approval_rate:   hd.claim_approval_rate   !== null ? parseFloat(hd.claim_approval_rate!)   : null,
    avg_claims_per_coupon: hd.avg_claims_per_coupon  !== null ? parseFloat(hd.avg_claims_per_coupon!)  : null,
    avg_hours_to_claim:    hd.avg_hours_to_claim     !== null ? parseFloat(hd.avg_hours_to_claim!)     : null,
    supply_demand_7d:      hd.supply_demand_7d        !== null ? parseFloat(hd.supply_demand_7d!)       : null,
    pending_over_48h:      pendingOver48h,
  };

  // ── New: alerts ────────────────────────────────────────────────────────────────
  const alerts: { severity: "red" | "yellow"; key: string; message: string }[] = [];
  const elapsedFraction = elapsed / DAY; // fraction of today elapsed (Taipei)

  // 1. Coupon low supply
  const avg7dCouponsVal = parseAvg(avg7dCoupons);
  if (avg7dCouponsVal !== null && avg7dCouponsVal >= 5) {
    if (todayCoupons < avg7dCouponsVal * elapsedFraction * 0.5) {
      alerts.push({ severity: "yellow", key: "low_coupons", message: `今日新增票券 ${todayCoupons} 件，低於常態（過去 7 日均 ${avg7dCouponsVal} 件）的 50%` });
    }
  }
  // 1b. Claims low
  const avg7dClaimsVal = parseAvg(avg7dClaims);
  if (avg7dClaimsVal !== null && avg7dClaimsVal >= 5) {
    if (todayClaims < avg7dClaimsVal * elapsedFraction * 0.5) {
      alerts.push({ severity: "yellow", key: "low_claims", message: `今日申請件數 ${todayClaims} 件，低於常態（過去 7 日均 ${avg7dClaimsVal} 件）的 50%` });
    }
  }
  // 2. Pending over 48h
  if (pendingOver48h > 100) {
    alerts.push({ severity: "red", key: "pending_48h", message: `${pendingOver48h} 件申請等待超過 48 小時，請立即處理` });
  } else if (pendingOver48h > 20) {
    alerts.push({ severity: "yellow", key: "pending_48h", message: `${pendingOver48h} 件申請等待超過 48 小時` });
  }
  // 3. Reports spike
  const avg7dReportsVal = parseAvg(avg7dReports);
  const reportsThreshold = Math.max(5, (avg7dReportsVal ?? 0) * 2);
  if (todayReports > reportsThreshold) {
    alerts.push({ severity: "red", key: "reports_spike", message: `今日檢舉數 ${todayReports} 件，超過常態 ${avg7dReportsVal ?? 0} 件的 2 倍` });
  }
  // 4. Expiring coupons
  if (couponExpiringCount > 50) {
    alerts.push({ severity: "yellow", key: "expiring_coupons", message: `${couponExpiringCount} 張票券 7 日內到期（AVAILABLE 狀態）` });
  }

  // ── New: utm_conversion ────────────────────────────────────────────────────────
  const utmConversion = utmConversionRaw.map((r) => ({
    source:   r.source ?? "organic",
    signups:  Number(r.signups),
    sharers:  Number(r.sharers),
    claimers: Number(r.claimers),
    active_7d: Number(r.active_7d),
  }));

  // ── Assemble response ─────────────────────────────────────────────────────────
  const data = {
    generated_at: now.toISOString(),
    cached: false,
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
      signups: bucket(userTs),
      coupons: bucket(couponTs),
      transactions: bucket(txnTs),
      claimers: dailyBucket(dailyClaimersRaw),
      sharers: dailyBucket(dailySharersRaw),
      dau: dauSeries,
      claims: dailyBucket(dailyClaimsSeriesRaw),
      completed: dailyBucket(dailyCompletedSeriesRaw),
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
    // ── New top-level blocks ──────────────────────────────────────────────────────
    realtime: {
      online_5m:  Number(rt.online_5m),
      active_30m: Number(rt.active_30m),
      active_1h:  Number(rt.active_1h),
      active_24h: Number(rt.active_24h),
    },
    today_vs: todayVs,
    four_hour: {
      labels:    fourHourLabels,
      signups:   fhSignups,
      coupons:   fhCoupons,
      claims:    fhClaims,
      completed: fhCompleted,
      active:    fhActive,
    },
    activity_heatmap: {
      claims:      hmClaims,
      uploads:     hmUploads,
      completions: hmCompletions,
    },
    retention,
    health,
    alerts,
    utm_conversion: utmConversion,
  };

  // Store in cache.
  responseCache.set(signupHours, { data, ts: now.getTime() });

  return jsonOk(data);
});
