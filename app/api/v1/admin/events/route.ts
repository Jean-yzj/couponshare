import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Admin: behavioural funnels from client_events (埋點).
//
// Why this is separate from /admin/stats: stats answers "what happened" from the
// tables that record *successful* actions (claim_requests, transactions). This
// answers "what didn't happen" — viewed but never tapped, started but never
// finished. Those steps leave no row anywhere else.
//
// Rates are computed over distinct actors, not raw events: "100 people looked,
// 3 tapped" is a question about people, and one person reloading a coupon ten
// times must not read as ten viewers. An actor is the logged-in user when we
// have one, otherwise the device's anon id.

type Agg = { name: string; events: bigint; actors: bigint };

function step(rows: Agg[], name: string, label: string) {
  const r = rows.find((x) => x.name === name);
  return { key: name, label, events: Number(r?.events ?? 0), actors: Number(r?.actors ?? 0) };
}

// Percentage of the funnel's first step that reached this step. Null rather than
// 0 when there's no denominator — "0%" would read as a real finding when the
// truth is "no data yet".
function withRates<T extends { actors: number }>(steps: T[]): (T & { pct_of_first: number | null })[] {
  const first = steps[0]?.actors ?? 0;
  return steps.map((s) => ({
    ...s,
    pct_of_first: first > 0 ? Math.round((s.actors / first) * 1000) / 10 : null,
  }));
}

export const GET = route(async (req) => {
  await requireAdmin();

  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("days") ?? "7");
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 90) : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);

  const [rows, platforms, health] = await Promise.all([
    prisma.$queryRaw<Agg[]>`
      select name,
             count(*)::bigint as events,
             count(distinct coalesce(user_id, anon_id))::bigint as actors
      from client_events
      where created_at >= ${since}
      group by name
    `,
    prisma.$queryRaw<{ platform: string; events: bigint; actors: bigint }[]>`
      select platform,
             count(*)::bigint as events,
             count(distinct coalesce(user_id, anon_id))::bigint as actors
      from client_events
      where created_at >= ${since}
      group by platform
      order by count(*) desc
    `,
    prisma.$queryRaw<{ total: bigint; last_at: Date | null }[]>`
      select count(*)::bigint as total, max(created_at) as last_at from client_events
    `,
  ]);

  const coupon = withRates([
    step(rows, "coupon_view", "看了券"),
    step(rows, "coupon_apply_click", "按了申請"),
    step(rows, "coupon_apply_success", "成功送出"),
  ]);

  const publish = withRates([
    step(rows, "coupon_publish_start", "開始上架"),
    step(rows, "coupon_publish_success", "完成上架"),
  ]);

  const opens = [step(rows, "push_open", "推播點開"), step(rows, "notification_open", "站內通知點開")];

  return jsonOk({
    window_days: days,
    since,
    coupon_funnel: coupon,
    publish_funnel: publish,
    opens,
    by_platform: platforms.map((p) => ({
      platform: p.platform,
      events: Number(p.events),
      actors: Number(p.actors),
    })),
    // Pipeline liveness. A dead 埋點 pipeline used to be completely invisible —
    // the app dropped every error on the floor. last_event_at going stale is the
    // alarm that replaces that silence.
    health: {
      total_events_all_time: Number(health[0]?.total ?? 0),
      last_event_at: health[0]?.last_at ?? null,
    },
  });
});
