"use client";

import Link from "next/link";
import { useApi, useMe } from "@/lib/client";
import { Card, Avatar, Skeleton, EmptyState, Button, NeedLogin, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";
import { CATEGORIES } from "@/lib/categories";

type Stats = {
  generated_at: string;
  overview: {
    users: { total: number; active: number; suspended: number; new_3h: number; new_24h: number; new_48h: number; new_7d: number; new_30d: number };
    coupons: { total: number; new_24h: number; new_7d: number; new_30d: number };
    transactions: { total: number; completed: number; gift: number; exchange: number };
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
  series: {
    days: string[];
    signups: number[];
    coupons: number[];
    transactions: number[];
    claimers: number[];
    sharers: number[];
    dau: number[];
  };
  active_users: { dau_today: number; wau: number };
  activation: { registered: number; shared: number; claimed: number; completed: number; returning_7d: number };
  sources: { referred: number; organic: number; by_provider: { key: string; count: number }[] };
  heatmap_hours: number[];
  top_contributors: { id: string; display_name: string; avatar_url: string | null; level_name: string; contribution_score: number }[];
  top_brands: { brand: string; count: number }[];
  followed_brands: { brand: string; count: number }[];
  recent_users: { id: string; display_name: string; avatar_url: string | null; level_name: string; provider: string; created_at: string }[];
  recent_coupons: { id: string; title: string; brand: string; type: string; category: string; status: string; owner: string; created_at: string }[];
};

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

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export default function AdminDashboardPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading } = useApi<Stats>(me?.is_admin ? "/api/v1/admin/stats" : null);

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

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">數據總覽</h1>
        <p className="mt-1 text-sm text-ink-soft">
          CouponShare 營運數據與趨勢　·　更新於 {relativeTime(data.generated_at)}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon="user" label="總會員" value={o.users.total} sub={`今日 +${o.users.new_24h}　7 日 +${o.users.new_7d}`} />
        <StatCard icon="ticket" label="總票券" value={o.coupons.total} sub={`今日 +${o.coupons.new_24h}　7 日 +${o.coupons.new_7d}`} />
        <StatCard icon="heart" label="成功媒合" value={o.transactions.total} sub={`贈送 ${o.transactions.gift}　交換 ${o.transactions.exchange}　已完成 ${o.transactions.completed}`} />
        <StatCard icon="send" label="進行中申請" value={o.claims.pending} sub={`累計 ${o.claims.total} 筆`} />
        <StatCard icon="flag" label="待處理檢舉" value={o.reports.pending} tone={o.reports.pending > 0 ? "danger" : undefined} sub={`累計 ${o.reports.total} 筆`} />
        <StatCard icon="shield" label="待處理申訴" value={o.appeals.pending} tone={o.appeals.pending > 0 ? "accent" : undefined} sub={`累計 ${o.appeals.total} 筆`} />
      </div>

      {/* Activity + registration velocity */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon="lightning" label="當日活躍 DAU" value={data.active_users.dau_today} sub="今日有動作的人" tone="accent" />
        <StatCard icon="users" label="7 日活躍 WAU" value={data.active_users.wau} sub="近 7 日活躍人數" />
        <StatCard icon="user" label="3 小時註冊" value={o.users.new_3h} />
        <StatCard icon="user" label="24 小時註冊" value={o.users.new_24h} />
        <StatCard icon="user" label="48 小時註冊" value={o.users.new_48h} />
      </div>

      {/* Registration-by-hour heatmap */}
      <Section title="註冊時段分佈（台灣時間）">
        <HourHeatmap hours={data.heatmap_hours} />
      </Section>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendChart title="每日註冊" days={s.days} values={s.signups} />
        <TrendChart title="每日上架" days={s.days} values={s.coupons} />
        <TrendChart title="每日媒合" days={s.days} values={s.transactions} />
        <TrendChart title="每日活躍 DAU" days={s.days} values={s.dau} />
        <TrendChart title="每日領券人數" days={s.days} values={s.claimers} />
        <TrendChart title="每日分享人數" days={s.days} values={s.sharers} />
      </div>

      {/* Activation funnel */}
      <Section title="啟動漏斗 · 有多少人真的用起來（累計不重複人數）">
        <FunnelRow label="註冊" value={data.activation.registered} base={data.activation.registered} />
        <FunnelRow label="分享過券" value={data.activation.shared} base={data.activation.registered} />
        <FunnelRow label="領取過券" value={data.activation.claimed} base={data.activation.registered} />
        <FunnelRow label="完成交易" value={data.activation.completed} base={data.activation.registered} />
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
          近 7 日回訪老用戶（註冊超過 7 天、仍在使用）：
          <span className="font-semibold text-accent">{data.activation.returning_7d.toLocaleString()}</span> 人
        </p>
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
          <BarList
            items={data.sources.by_provider.map((p) => ({ label: PROVIDER_LABEL[p.key] || p.key, count: p.count }))}
          />
        </div>
      </Section>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="票券分類">
          <BarList items={data.by_category.map((c) => ({ label: CAT_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
        <Section title="票券狀態">
          <BarList items={data.by_status.map((c) => ({ label: STATUS_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
        <Section title="會員等級">
          <BarList items={data.by_level.map((c) => ({ label: LEVEL_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
        <Section title="贈送 vs 交換">
          <BarList items={data.by_type.map((c) => ({ label: TYPE_LABEL[c.key] || c.key, count: c.count }))} />
        </Section>
      </div>

      {/* Leaderboard + brands */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="貢獻榜 Top 8">
          {data.top_contributors.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2.5">
              {data.top_contributors.map((u, i) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center text-sm font-bold text-ink-faint">{i + 1}</span>
                  <Avatar name={u.display_name} url={u.avatar_url} size={32} />
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
        <div className="space-y-4">
          <Section title="熱門品牌">
            <BarList items={data.top_brands.map((b) => ({ label: b.brand, count: b.count }))} />
          </Section>
          <Section title="最多人追蹤">
            <BarList items={data.followed_brands.map((b) => ({ label: b.brand, count: b.count }))} />
          </Section>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="最新註冊">
          {data.recent_users.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2.5">
              {data.recent_users.map((u) => (
                <Link key={u.id} href={`/users/${u.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-sand/60">
                  <Avatar name={u.display_name} url={u.avatar_url} size={32} />
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
        <Section title="最新上架">
          {data.recent_coupons.length === 0 ? (
            <Empty />
          ) : (
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
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
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
    <Card className="p-5">
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
    </Card>
  );
}

function HourHeatmap({ hours }: { hours: number[] }) {
  const total = sum(hours);
  if (total === 0) return <Empty />;
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  return (
    <div>
      <p className="mb-3 text-xs text-ink-soft">
        尖峰時段 <span className="font-semibold text-accent">{peak}:00–{peak}:59</span>　·　全站累計 {total} 筆註冊
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

function DashSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
