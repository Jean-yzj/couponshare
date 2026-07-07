"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useApi, useMe, apiFetch, ApiErr } from "@/lib/client";
import { Card, Avatar, Skeleton, EmptyState, Button, NeedLogin, Eyebrow, Field, Input } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";
import { CATEGORIES } from "@/lib/categories";
import { AlertBanner } from "@/components/admin/AlertBanner";
import { RealtimeCards } from "@/components/admin/RealtimeCards";
import { PeriodVsCards } from "@/components/admin/PeriodVsCards";
import { FourHourChart } from "@/components/admin/FourHourChart";
import { SeriesChart } from "@/components/admin/SeriesChart";
import { ActivityHeatmap } from "@/components/admin/ActivityHeatmap";
import { RetentionCohort } from "@/components/admin/RetentionCohort";
import { HealthCards } from "@/components/admin/HealthCards";
import { UtmConversionTable } from "@/components/admin/UtmConversionTable";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

// ── Types aligned with /tmp/stats-contract.ts ─────────────────────────────

type Period = {
  from: string;
  to: string;
  days: number;
  new_users: number;
  new_coupons: number;
  new_claims: number;
  completed: number;
  sent: number;
  new_reports: number;
};

type PeriodVs = {
  label_current: string;
  label_previous: string;
  signups: { current: number; previous: number };
  coupons: { current: number; previous: number };
  claims: { current: number; previous: number };
  completed: { current: number; previous: number };
  sent: { current: number; previous: number };
  reports: { current: number; previous: number };
};

type ActiveNote = {
  online_source: "last_seen";
  today_active_source: "audit_logs";
  today_active_count: number;
  precise_since: string;
  note: string;
};

type RetentionMeta = {
  data_since: string;
};

type CohortRow = {
  week_start: string;
  size: number;
  d1: number;
  d1_eligible: number;
  d7: number;
  d7_eligible: number;
  d30: number;
  d30_eligible: number;
};

type Stats = {
  generated_at: string;
  cached?: boolean;

  // NEW
  period: Period;
  period_vs: PeriodVs;
  active_note: ActiveNote;
  retention_meta: RetentionMeta;

  overview: {
    users: { total: number; active: number; suspended: number; new_3h: number; new_6h: number; new_12h: number; new_24h: number; new_48h: number; new_7d: number; new_30d: number };
    coupons: { total: number; new_24h: number; new_7d: number; new_30d: number };
    transactions: { total: number; completed: number; sent: number; both_confirmed: number; gift: number; exchange: number };
    claims: { total: number; pending: number };
    reports: { total: number; pending: number };
    appeals: { total: number; pending: number };
    brand_follows: number;
    ratings: { count: number; avg: number | null };
  };
  by_category: { key: string; count: number }[];
  by_status: { key: string; count: number }[];
  by_type: { key: string; count: number }[];
  by_level: { key: string; count: number }[];
  by_age: { key: string; count: number }[];
  series: {
    days: string[];
    signups: number[];
    coupons: number[];
    transactions: number[];
    claimers: number[];
    sharers: number[];
    dau: number[];
    claims: number[];
    completed: number[];
  };
  active_users: { dau_today: number; wau: number };
  activation: { registered: number; shared: number; claimed: number; completed: number; returning_7d: number };
  sources: { referred: number; organic: number; by_provider: { key: string; count: number }[] };
  signup_window: { hours: number; started_at: string; count: number };
  utm: {
    tracked: number;
    by_source: { key: string; count: number }[];
    top_posts: { source: string | null; medium: string | null; campaign: string | null; content: string | null; post: string; count: number }[];
  };
  weekly_completed: { label: string; count: number }[];
  heatmap_hours: number[];
  top_contributors: { id: string; display_name: string | null; avatar_url: string | null; level_name: string; contribution_score: number }[];
  top_brands: { brand: string; count: number }[];
  followed_brands: { brand: string; count: number }[];
  recent_users: { id: string; display_name: string | null; avatar_url: string | null; level_name: string; provider: string; created_at: string }[];
  recent_coupons: { id: string; title: string; brand: string; type: string; category: string; status: string; owner: string | null; created_at: string }[];
  realtime: { online_5m: number; active_30m: number; active_1h: number; active_24h: number };
  four_hour: {
    labels: string[];
    signups: number[];
    coupons: number[];
    claims: number[];
    completed: number[];
    active: number[];
  };
  activity_heatmap: {
    claims: number[][];
    uploads: number[][];
    completions: number[][];
  };
  retention: CohortRow[];
  health: {
    claim_approval_rate: number | null;
    avg_claims_per_coupon: number | null;
    avg_hours_to_claim: number | null;
    supply_demand_7d: number | null;
    pending_over_48h: number;
  };
  alerts: { severity: "red" | "yellow"; key: string; message: string }[];
  utm_conversion: { source: string; signups: number; sharers: number; claimers: number; active_7d: number }[];
};

// ── Constants ─────────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  AVAILABLE: "可領取",
  PENDING: "審核中",
  CLAIMED: "已送出",
  EXPIRED: "已過期",
  CANCELLED: "已下架",
  REPORTED: "被檢舉",
  SUSPENDED: "已停權",
};
const TYPE_LABEL: Record<string, string> = { GIFT: "免費贈送", EXCHANGE: "交換" };
const LEVEL_LABEL: Record<string, string> = { LEVEL_1: "新手", LEVEL_2: "達人", LEVEL_3: "傳奇" };
const PROVIDER_LABEL: Record<string, string> = { EMAIL: "Email", GOOGLE: "Google", APPLE: "Apple", LINE: "LINE", ANONYMOUS: "訪客" };
const SIGNUP_WINDOWS = [3, 6, 12, 24, 48] as const;
type SignupHours = (typeof SIGNUP_WINDOWS)[number];

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const REFRESH_INTERVAL_MS = 60_000;

function fmt2(n: number) { return String(n).padStart(2, "0"); }
function nowHMS() {
  const d = new Date();
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
}

function taipeiToday(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// ── Sub-tab types ─────────────────────────────────────────────────────────

type SubTab = "overview" | "users" | "coupons" | "growth" | "enterprise";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "總覽" },
  { key: "users", label: "用戶" },
  { key: "coupons", label: "票券" },
  { key: "growth", label: "成長" },
  { key: "enterprise", label: "企業" },
];

// ── Main page component ───────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const today = taipeiToday();
  const [dateRange, setDateRange] = useState<DateRange>({ from: today, to: today });
  const [signupHours, setSignupHours] = useState<SignupHours>(24);
  const [subTab, setSubTab] = useState<SubTab>("overview");

  const { me, loading: meLoading } = useMe();

  const apiUrl = me?.is_admin
    ? `/api/v1/admin/stats?from=${dateRange.from}&to=${dateRange.to}&signup_hours=${signupHours}`
    : null;
  const { data, loading, refetch } = useApi<Stats>(apiUrl);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doRefresh = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    refetch();
    setLastRefresh(nowHMS());
  }, [refetch]);

  useEffect(() => { setLastRefresh(nowHMS()); }, [data]);

  useEffect(() => {
    timerRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", doRefresh);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", doRefresh);
    };
  }, [doRefresh]);

  if (meLoading) return <DashSkeleton />;
  if (!me) return <NeedLogin message="登入後即可使用管理功能。" />;
  if (!me.is_admin)
    return (
      <div className="py-10">
        <EmptyState icon="lock" title="沒有權限" hint="這是管理員專用頁面。" action={<Button href="/" variant="outline">回到探索</Button>} />
      </div>
    );
  if (loading || !data) return <DashSkeleton />;

  const o = data.overview;
  const s = data.series;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Dashboard</Eyebrow>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">數據後台</h1>
          <p className="mt-1 text-sm text-ink-soft">
            更新於 {relativeTime(data.generated_at)}
            {data.cached && <span className="ml-1 text-ink-faint">(快取)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          {lastRefresh && <span>刷新於 {lastRefresh}</span>}
          <button
            onClick={doRefresh}
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-ink-soft hover:text-ink"
            title="手動刷新"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.5 8A5.5 5.5 0 0 1 3.1 11.4M2.5 8A5.5 5.5 0 0 1 12.9 4.6M2.5 12V9h3M13.5 4v3h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            刷新
          </button>
        </div>
      </div>

      {/* ── TOP FIXED AREA ── (always visible, never changes with sub-tab) */}

      {/* Core KPI cards — 4 big numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CoreCard
          icon="user"
          label="總用戶"
          value={o.users.total}
          sub={`期間 +${data.period?.new_users ?? 0}`}
        />
        <CoreCard
          icon="ticket"
          label="總票券"
          value={o.coupons.total}
          sub={`期間 +${data.period?.new_coupons ?? 0}`}
        />
        <CoreCard
          icon="heart"
          label="成功送出"
          value={o.transactions.sent}
          sub={`期間 +${data.period?.sent ?? 0}`}
        />
        <CoreCard
          icon="lightning"
          label="即時在線"
          value={data.realtime.online_5m}
          sub="近 5 分鐘 · 新打點"
          accent
        />
      </div>

      {/* Ops todo — 每天要處理的營運待辦，置頂顯眼（解決檢舉/申訴看不到） */}
      <OpsTodoBar reports={o.reports.pending} appeals={o.appeals.pending} />

      {/* Date range picker */}
      <div className="rounded-2xl border border-line bg-canvas/60 px-4 py-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Secondary sub-tabs */}
      <div className="no-scrollbar -mx-4 flex items-center gap-0 overflow-x-auto overscroll-x-contain border-b border-line px-4 sm:-mx-6 sm:px-6">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              subTab === t.key
                ? "border-accent text-accent"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SUB-TAB CONTENT ─────────────────────────────────────────────── */}

      {subTab === "overview" && (
        <OverviewTab data={data} o={o} s={s} />
      )}
      {subTab === "users" && (
        <UsersTab data={data} o={o} s={s} signupHours={signupHours} setSignupHours={setSignupHours} />
      )}
      {subTab === "coupons" && (
        <CouponsTab data={data} o={o} s={s} />
      )}
      {subTab === "growth" && (
        <GrowthTab data={data} s={s} />
      )}
      {subTab === "enterprise" && (
        <EnterpriseTab />
      )}
    </div>
  );
}

// ── Ops todo bar ──────────────────────────────────────────────────────────

function OpsTodoBar({ reports, appeals }: { reports: number; appeals: number }) {
  // Only show a chip when there is actually something to review — a 0-count chip
  // reads as "still pending" even when it's clear. All zero → the green all-clear.
  const items = [
    { label: "待檢舉複核", value: reports, href: "/admin/reports" },
    { label: "待申訴複核", value: appeals, href: "/admin/appeals" },
  ].filter((it) => it.value > 0);
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-pine/30 bg-pine-tint/40 px-3 py-2 text-sm text-pine">
        <Icon name="check" size={15} />
        <span>目前沒有待處理的檢舉或申訴</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Link key={it.label} href={it.href} className="hover:opacity-80">
          <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger-tint/60 px-3 py-2 text-sm text-danger transition-colors">
            <span className="text-xs">{it.label}</span>
            <span className="font-bold tabular-nums">{it.value}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────

function OverviewTab({ data, o, s }: { data: Stats; o: Stats["overview"]; s: Stats["series"] }) {
  return (
    <div className="space-y-6">
      {/* Period vs cards — 核心數據置於總覽頁最前 */}
      {data.period_vs && (
        <section>
          <SectionTitle>期間對比</SectionTitle>
          <PeriodVsCards periodVs={data.period_vs} />
        </section>
      )}

      {/* Realtime active + today active */}
      <section>
        <SectionTitle>即時活躍</SectionTitle>
        {data.realtime && <RealtimeCards realtime={data.realtime} />}

        {data.active_note && (
          <div className="mt-3 rounded-xl border border-line bg-canvas/60 p-3">
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-xs font-medium text-ink">{data.realtime.online_5m.toLocaleString()}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">近 5 分鐘有活動（精準打點）</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink">{data.active_note.today_active_count.toLocaleString()}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">近 24 小時有操作記錄（發券/申請/完成等）· 純瀏覽的精準打點累積中，約 2 週後納入</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              「在線」是精準即時打點；「今日活躍」是操作記錄口徑，兩者計算方式不同、不可直接相比。
            </p>
          </div>
        )}
      </section>

      {/* North-star: weekly completed */}
      <Section title="週成功送出（北極星）">
        <WeeklyCompletedChart weeks={data.weekly_completed} />
      </Section>

      {/* Selected health metrics — 平台健康（待辦已置於頂部待辦條） */}
      <section>
        <SectionTitle>平台健康</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon="checkCircle" label="雙方確認完成" value={o.transactions.both_confirmed} sub="雙方都按完成（真正走完全程）" />
          <StatCard icon="heart" label="供需比（7 日）" value={data.health?.supply_demand_7d !== null && data.health?.supply_demand_7d !== undefined ? data.health.supply_demand_7d.toFixed(2) : "—"} sub="新券 / 新申請" />
          <StatCard icon="hourglass" label="平均送出時數" value={data.health?.avg_hours_to_claim !== null && data.health?.avg_hours_to_claim !== undefined ? `${data.health.avg_hours_to_claim.toFixed(1)}h` : "—"} sub="上架到送出" />
          <StatCard icon="send" label="平均每券申請" value={data.health?.avg_claims_per_coupon !== null && data.health?.avg_claims_per_coupon !== undefined ? data.health.avg_claims_per_coupon.toFixed(1) : "—"} sub="需求熱度" />
          <StatCard icon="check" label="申請通過率" value={data.health?.claim_approval_rate !== null && data.health?.claim_approval_rate !== undefined ? `${Math.round(data.health.claim_approval_rate * 100)}%` : "—"} sub="核准 / 已回覆" />
        </div>
      </section>

      {/* Alerts — 收斂下沉，不佔第一屏 */}
      {data.alerts && data.alerts.length > 0 && (
        <section>
          <SectionTitle>異常提醒</SectionTitle>
          <AlertBanner alerts={data.alerts} />
        </section>
      )}

      {/* Admin tools at the bottom */}
      <ScoreAdjust />
      <KillSwitches />
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────

function UsersTab({
  data,
  o,
  s,
  signupHours,
  setSignupHours,
}: {
  data: Stats;
  o: Stats["overview"];
  s: Stats["series"];
  signupHours: SignupHours;
  setSignupHours: (v: SignupHours) => void;
}) {
  return (
    <div className="space-y-6">
      {/* User summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon="user" label="總用戶" value={o.users.total} />
        <StatCard icon="user" label="今日新增" value={o.users.new_24h} />
        <StatCard icon="user" label="7 日新增" value={o.users.new_7d} />
        <StatCard icon="user" label="30 日新增" value={o.users.new_30d} />
        <StatCard icon="shield" label="已停權" value={o.users.suspended} tone={o.users.suspended > 0 ? "danger" : undefined} />
      </div>

      {/* Registration trend (fixed 30-day) */}
      <Section title="註冊趨勢（固定 30 天）">
        <TrendChart title="每日註冊" days={s.days} values={s.signups} />
      </Section>

      {/* Signup window heatmap */}
      <Section title="註冊熱力圖（台灣時間）">
        <SignupWindowPicker value={signupHours} onChange={setSignupHours} />
        <HourHeatmap hours={data.heatmap_hours} windowHours={data.signup_window.hours} />
      </Section>

      {/* Registration source */}
      <Section title="註冊來源">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-canvas/60 p-3 text-center">
            <p className="font-display text-2xl font-extrabold tabular-nums text-accent">
              {data.sources.referred.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">朋友推薦而來</p>
          </div>
          <div className="rounded-xl bg-canvas/60 p-3 text-center">
            <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
              {data.sources.organic.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">自然註冊</p>
          </div>
        </div>
        <div className="mt-4">
          <BarList items={data.sources.by_provider.map((p) => ({ label: PROVIDER_LABEL[p.key] || p.key, count: p.count }))} />
        </div>
      </Section>

      {/* UTM */}
      <Section title="UTM 貼文註冊">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="rounded-xl bg-canvas/60 p-3 text-center">
              <p className="font-display text-2xl font-extrabold tabular-nums text-accent">
                {data.utm.tracked.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">帶 UTM 的註冊</p>
            </div>
            <div className="mt-4">
              <BarList items={data.utm.by_source.map((p) => ({ label: p.key, count: p.count }))} />
            </div>
          </div>
          <UtmPostList posts={data.utm.top_posts} />
        </div>
      </Section>

      {/* UTM conversion quality */}
      {data.utm_conversion && data.utm_conversion.length > 0 && (
        <UtmConversionTable rows={data.utm_conversion} />
      )}

      {/* Age + Level */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="用戶年齡層">
          <BarList items={data.by_age.map((c) => ({ label: c.key, count: c.count }))} />
        </Section>
        <Section title="會員等級">
          <BarList items={data.by_level.map((c) => ({ label: LEVEL_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
      </div>

      {/* Retention cohort */}
      {data.retention && (
        <RetentionCohort
          retention={data.retention}
          retentionMeta={data.retention_meta}
        />
      )}

      {/* Leaderboard + recent */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="貢獻榜 Top 8">
          {data.top_contributors.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {data.top_contributors.map((u, i) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center text-sm font-bold text-ink-faint">{i + 1}</span>
                  <Avatar name={u.display_name ?? ""} url={u.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{u.display_name}</p>
                    <p className="text-xs text-ink-faint">{u.level_name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-accent">{u.contribution_score} 分</span>
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="最新註冊">
          {data.recent_users.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {data.recent_users.map((u) => (
                <Link key={u.id} href={`/users/${u.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-sand/60">
                  <Avatar name={u.display_name ?? ""} url={u.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{u.display_name}</p>
                    <p className="text-xs text-ink-faint">
                      {PROVIDER_LABEL[u.provider] || u.provider} · {u.level_name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">{relativeTime(u.created_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Coupons tab ───────────────────────────────────────────────────────────

function CouponsTab({ data, o, s }: { data: Stats; o: Stats["overview"]; s: Stats["series"] }) {
  return (
    <div className="space-y-6">
      {/* Coupon summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon="ticket" label="總票券" value={o.coupons.total} />
        <StatCard icon="ticket" label="今日新增" value={o.coupons.new_24h} />
        <StatCard icon="ticket" label="可領取" value={(data.by_status.find(b => b.key === "AVAILABLE")?.count) ?? 0} />
        <StatCard icon="ticket" label="已送出" value={(data.by_status.find(b => b.key === "CLAIMED")?.count) ?? 0} />
        <StatCard icon="ticket" label="已過期" value={(data.by_status.find(b => b.key === "EXPIRED")?.count) ?? 0} />
      </div>

      {/* Distribution breakdowns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="票券狀態">
          <BarList items={data.by_status.map((c) => ({ label: STATUS_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
        <Section title="票券分類">
          <BarList items={data.by_category.map((c) => ({ label: CAT_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
        <Section title="贈送 vs 交換">
          <BarList items={data.by_type.map((c) => ({ label: TYPE_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
      </div>

      {/* Upload trend (fixed 30-day) */}
      <Section title="每日上架趨勢（固定 30 天）">
        <TrendChart title="每日上架" days={s.days} values={s.coupons} />
      </Section>

      {/* Health */}
      {data.health && (
        <section>
          <SectionTitle>票券健康</SectionTitle>
          <HealthCards health={data.health} />
        </section>
      )}

      {/* Brands + recent */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Section title="熱門品牌">
            <BarList items={data.top_brands.map((b) => ({ label: b.brand, count: b.count }))} />
          </Section>
          <Section title="最多人追蹤">
            <BarList items={data.followed_brands.map((b) => ({ label: b.brand, count: b.count }))} />
          </Section>
        </div>
        <Section title="最新上架">
          {data.recent_coupons.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {data.recent_coupons.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {c.brand} · {TYPE_LABEL[c.type] || c.type} · {STATUS_LABEL[c.status] || c.status} · {c.owner}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">{relativeTime(c.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Growth tab ────────────────────────────────────────────────────────────

function GrowthTab({ data, s }: { data: Stats; s: Stats["series"] }) {
  return (
    <div className="space-y-6">
      {/* Activation funnel */}
      <Section title="啟動漏斗 · 有多少人真的用起來（累計不重複人數）">
        <FunnelRow label="註冊" value={data.activation.registered} base={data.activation.registered} />
        <FunnelRow label="分享過券" value={data.activation.shared} base={data.activation.registered} />
        <FunnelRow label="領取過券" value={data.activation.claimed} base={data.activation.registered} />
        <FunnelRow label="雙方確認完成" value={data.activation.completed} base={data.activation.registered} />
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
          近 7 日回訪老用戶（註冊超過 7 天、仍在使用）：
          <span className="font-semibold text-accent">{data.activation.returning_7d.toLocaleString()}</span> 人
        </p>
      </Section>

      {/* 48-hour pulse */}
      {data.four_hour && <FourHourChart fourHour={data.four_hour} />}

      {/* 30-day multi-series */}
      <SeriesChart series={data.series} />

      {/* 7x24 activity heatmap */}
      {data.activity_heatmap && <ActivityHeatmap activityHeatmap={data.activity_heatmap} />}

      {/* 近 7 日回訪 — already shown in funnel section above */}
    </div>
  );
}

// ── Enterprise tab ────────────────────────────────────────────────────────

function EnterpriseTab() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">企業合作數據</h2>
            <p className="mt-1 text-sm text-ink-soft">
              企業合作數據將在品牌專區上線後提供（ROADMAP Phase 4）。
            </p>
          </div>
          <Button href="/admin/business-leads" variant="outline" icon="shield">
            查看合作名單
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Shared small components ───────────────────────────────────────────────

function CoreCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: IconName;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-ink-faint">
        <Icon name={icon} size={15} />
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn("mt-1.5 text-3xl font-bold tabular-nums", accent ? "text-accent" : "text-ink")}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: IconName;
  tone?: "accent" | "danger";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-ink-faint">
        <Icon name={icon} size={15} />
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold tabular-nums",
          tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-ink",
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-semibold text-ink">{children}</h2>;
}

function TrendChart({ title, days, values }: { title: string; days: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  const total = sum(values);
  const W = 300;
  const H = 96;
  const P = 5;
  const n = values.length;
  const gid = "tg" + title.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  const xAt = (i: number) => (n <= 1 ? W / 2 : P + (i / (n - 1)) * (W - 2 * P));
  const yAt = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  const area = `${P},${H - P} ${line} ${W - P},${H - P}`;
  const last = values[n - 1] ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-faint">30 天共 {total}</p>
      </div>
      {total === 0 ? (
        <div className="flex h-28 items-center justify-center text-sm text-ink-faint">尚無資料</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-28 w-full">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gid})`} />
            <polyline
              points={line}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={xAt(n - 1)} cy={yAt(last)} r="2.6" fill="var(--color-accent)" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
            <span>{days[0]}</span>
            <span>{days[Math.floor(days.length / 2)]}</span>
            <span>{days[days.length - 1]}</span>
          </div>
        </>
      )}
    </div>
  );
}

function SignupWindowPicker({ value, onChange }: { value: SignupHours; onChange: (v: SignupHours) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {SIGNUP_WINDOWS.map((h) => (
        <button
          key={h}
          onClick={() => onChange(h)}
          className={cn(
            "h-8 rounded-full px-3 text-xs font-semibold transition-colors",
            value === h ? "bg-accent text-white shadow-soft" : "bg-sand text-ink-soft hover:text-ink",
          )}
        >
          {h} 小時
        </button>
      ))}
    </div>
  );
}

function HourHeatmap({ hours, windowHours }: { hours: number[]; windowHours: number }) {
  const total = sum(hours);
  if (total === 0) return <Empty />;
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  return (
    <div>
      <p className="mb-3 text-xs text-ink-soft">
        近 {windowHours} 小時尖峰 <span className="font-semibold text-accent">{peak}:00–{peak}:59</span>　·　{total} 筆註冊
      </p>
      <div className="flex h-24 items-end gap-px">
        {hours.map((c, h) => (
          <div
            key={h}
            className={cn("flex-1 rounded-t", h === peak ? "bg-accent" : "bg-accent/45")}
            style={{ height: c === 0 ? "2%" : `${Math.max(4, (c / max) * 100)}%` }}
            title={`${h}:00　${c} 人`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

function UtmPostList({
  posts,
}: {
  posts: { source: string | null; medium: string | null; campaign: string | null; content: string | null; post: string; count: number }[];
}) {
  if (posts.length === 0) return <Empty />;
  return (
    <div className="space-y-2.5">
      {posts.map((p, i) => {
        const meta = [p.source, p.medium, p.campaign].filter(Boolean).join(" · ");
        return (
          <div key={`${p.source}-${p.campaign}-${p.content}-${i}`} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-center text-sm font-bold text-ink-faint">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink" title={p.content || p.campaign || p.post}>
                {p.post}
              </p>
              <p className="truncate text-xs text-ink-faint">{meta || "未標來源"}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">{p.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function FunnelRow({ label, value, base }: { label: string; value: number; base: number }) {
  const pct = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="text-ink-faint">
          <span className="font-semibold text-ink">{value.toLocaleString()}</span> 人 · {pct}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

function BarList({ items }: { items: { label: string; count: number }[] }) {
  if (items.length === 0) return <Empty />;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate text-sm text-ink-soft" title={it.label}>
            {it.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(it.count / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-ink">{it.count}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreAdjust() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ display_name: string; before: number; contribution_score: number } | null>(null);

  async function submit() {
    const delta = Number(amount);
    if (!email.trim() || !Number.isInteger(delta) || delta === 0) {
      setErr("請輸入 Email 與非零的整數分數");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await apiFetch<{ user: { display_name: string; before: number; contribution_score: number } }>(
        "/api/v1/admin/users/adjust-score",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), delta, note: note.trim() || undefined }),
        },
      );
      setResult(r.user);
      setEmail("");
      setAmount("");
      setNote("");
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "調整失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="手動調整貢獻值">
      <div className="space-y-3">
        <Field label="使用者 Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="加減分（可為負）">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例如 20 或 -5" />
          </Field>
          <Field label="備註（選填）">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：補回被誤扣的分數" />
          </Field>
        </div>
        <Button loading={busy} onClick={submit} icon="plus">送出調整</Button>
        {err && <p className="text-sm font-medium text-danger">{err}</p>}
        {result && (
          <div className="rounded-xl bg-pine-tint/60 p-3 text-sm text-ink">
            已調整 <span className="font-semibold">{result.display_name}</span>：{result.before} →{" "}
            <span className="font-bold text-pine">{result.contribution_score}</span> 分
          </div>
        )}
      </div>
    </Section>
  );
}

function KillSwitches() {
  const { data, refetch } = useApi<{ flags: Record<string, boolean> }>("/api/v1/admin/settings");
  const [busy, setBusy] = useState<string | null>(null);
  const flags = data?.flags ?? {};
  const items = [
    { key: "claims_paused", label: "暫停領券", hint: "所有人都無法申請 / 領取票券" },
    { key: "register_paused", label: "暫停註冊", hint: "無法建立新帳號（現有用戶登入不受影響）" },
  ];
  async function toggle(key: string, value: boolean) {
    setBusy(key);
    try {
      await apiFetch("/api/v1/admin/settings", { method: "POST", body: JSON.stringify({ key, value }) });
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setBusy(null);
    }
  }
  return (
    <Section title="緊急控制（遭濫用時止血用）">
      <div className="space-y-2.5">
        {items.map((it) => {
          const on = !!flags[it.key];
          return (
            <div
              key={it.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                on ? "border-danger/40 bg-danger-tint/60" : "border-line bg-canvas/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  {it.label}
                  {on && <span className="ml-2 text-xs font-bold text-danger">● 已暫停</span>}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">{it.hint}</p>
              </div>
              <Button size="sm" variant={on ? "outline" : "danger"} loading={busy === it.key} onClick={() => toggle(it.key, !on)}>
                {on ? "恢復" : "暫停"}
              </Button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold text-ink">{title}</h2>
      {children}
    </Card>
  );
}

function Empty() {
  return <p className="py-3 text-sm text-ink-faint">尚無資料</p>;
}

function WeeklyCompletedChart({ weeks }: { weeks: { label: string; count: number }[] }) {
  if (weeks.length === 0) return <Empty />;
  const values = weeks.map((w) => w.count);
  const labels = weeks.map((w) => w.label);
  const max = Math.max(1, ...values);
  const total = sum(values);
  const W = 300;
  const H = 96;
  const P = 5;
  const n = values.length;
  const gid = "wk-completed";
  const xAt = (i: number) => (n <= 1 ? W / 2 : P + (i / (n - 1)) * (W - 2 * P));
  const yAt = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  const area = `${P},${H - P} ${line} ${W - P},${H - P}`;
  const last = values[n - 1] ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-ink-soft">每週成功送出張數（含當週）</p>
        <p className="text-xs text-ink-faint">8 週共 {total} 筆</p>
      </div>
      {total === 0 ? (
        <div className="flex h-28 items-center justify-center text-sm text-ink-faint">尚無資料</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-28 w-full">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gid})`} />
            <polyline
              points={line}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={xAt(n - 1)} cy={yAt(last)} r="2.6" fill="var(--color-accent)" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
            {labels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
