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
    users: { total: number; active: number; suspended: number; new_24h: number; new_7d: number; new_30d: number };
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
  series: { days: string[]; signups: number[]; coupons: number[]; transactions: number[] };
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
        <StatCard icon="heart" label="成功媒合" value={o.transactions.completed} sub={`贈送 ${o.transactions.gift}　交換 ${o.transactions.exchange}`} />
        <StatCard icon="send" label="進行中申請" value={o.claims.pending} sub={`累計 ${o.claims.total} 筆`} />
        <StatCard icon="flag" label="待處理檢舉" value={o.reports.pending} tone={o.reports.pending > 0 ? "danger" : undefined} sub={`累計 ${o.reports.total} 筆`} />
        <StatCard icon="shield" label="待處理申訴" value={o.appeals.pending} tone={o.appeals.pending > 0 ? "accent" : undefined} sub={`累計 ${o.appeals.total} 筆`} />
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendChart title="每日註冊" days={s.days} values={s.signups} />
        <TrendChart title="每日上架" days={s.days} values={s.coupons} />
        <TrendChart title="每日媒合" days={s.days} values={s.transactions} />
      </div>

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
          <div className="mt-4 flex h-28 items-end gap-px">
            {values.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-accent/85"
                style={{ height: v === 0 ? "0%" : `${Math.max(5, (v / max) * 100)}%` }}
                title={`${days[i]}：${v}`}
              />
            ))}
          </div>
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
