"use client";

import { useState } from "react";
import { useApi, useMe } from "@/lib/client";
import { Button, Card, Skeleton, EmptyState, NeedLogin } from "@/components/ui";
import { cn, relativeTime } from "@/lib/display";

type Step = { key: string; label: string; events: number; actors: number; pct_of_first: number | null };
type Simple = { key: string; label: string; events: number; actors: number };

type Data = {
  window_days: number;
  since: string;
  coupon_funnel: Step[];
  publish_funnel: Step[];
  opens: Simple[];
  by_platform: { platform: string; events: number; actors: number }[];
  health: { total_events_all_time: number; last_event_at: string | null };
};

const WINDOWS = [
  { days: 7, label: "7 天" },
  { days: 14, label: "14 天" },
  { days: 30, label: "30 天" },
] as const;

const PLATFORM_LABEL: Record<string, string> = { ios: "iPhone", android: "Android", web: "網頁" };

// A pipeline that has gone quiet is the failure mode this whole feature exists to
// make visible, so say it in words rather than leaving an admin to notice that a
// number stopped moving.
function staleness(lastAt: string | null): { tone: "ok" | "warn" | "dead"; text: string } {
  if (!lastAt) return { tone: "dead", text: "還沒有收到任何事件" };
  const hours = (Date.now() - new Date(lastAt).getTime()) / 3_600_000;
  if (hours > 24) return { tone: "dead", text: `最後一筆是 ${relativeTime(lastAt)}，超過一天沒進帳了` };
  if (hours > 3) return { tone: "warn", text: `最後一筆是 ${relativeTime(lastAt)}` };
  return { tone: "ok", text: `最後一筆是 ${relativeTime(lastAt)}` };
}

function Funnel({ steps, empty }: { steps: Step[]; empty: string }) {
  const first = steps[0]?.actors ?? 0;
  if (first === 0) return <p className="text-sm text-ink-faint">{empty}</p>;

  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const width = first > 0 ? Math.max((s.actors / first) * 100, s.actors > 0 ? 2 : 0) : 0;
        const prev = steps[i - 1];
        // Step-to-step drop is the actionable number: "where did they leave",
        // not just "how far did they get overall". Only from the third step on —
        // at step two it is the same number as pct_of_first, and printing it
        // twice reads as two findings when there is only one.
        const fromPrev =
          i >= 2 && prev && prev.actors > 0 ? Math.round((s.actors / prev.actors) * 1000) / 10 : null;
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{s.label}</span>
              <span className="shrink-0 text-sm tabular-nums text-ink-soft">
                {s.actors} 人
                <span className="ml-1.5 text-xs text-ink-faint">({s.events} 次)</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {i === 0 ? "起點" : `${s.pct_of_first ?? 0}% 走到這一步`}
              {fromPrev !== null && i > 0 ? ` · 上一步有 ${fromPrev}% 接著往下` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminEventsPage() {
  const { me, loading: meLoading } = useMe();
  const [days, setDays] = useState<number>(7);
  const { data, loading } = useApi<Data>(me?.is_admin ? `/api/v1/admin/events?days=${days}` : null);

  if (meLoading)
    return (
      <div className="flex justify-center py-20">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可使用管理功能。" />;
  if (!me.is_admin)
    return (
      <div className="py-10">
        <EmptyState
          icon="lock"
          title="沒有權限"
          hint="這是管理員專用頁面。"
          action={<Button href="/" variant="outline">回到探索</Button>}
        />
      </div>
    );

  const health = data ? staleness(data.health.last_event_at) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">行為漏斗</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        使用者在 App 裡「看了但沒往下走」的地方。這些步驟不會在票券或交易紀錄裡留下任何一列，只能靠埋點。
      </p>

      <div className="mt-5 inline-flex gap-1 rounded-full bg-sand p-1">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setDays(w.days)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              days === w.days ? "bg-paper text-ink shadow-soft" : "text-ink-soft",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !data ? (
        <div className="mt-5">
          <EmptyState icon="bell" title="讀不到資料" hint="稍後再試一次。" />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {health && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">埋點管線狀態</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      health.tone === "ok" && "text-ink-soft",
                      health.tone === "warn" && "text-gold",
                      health.tone === "dead" && "text-clay",
                    )}
                  >
                    {health.text}
                  </p>
                </div>
                <span className="shrink-0 text-right text-sm tabular-nums text-ink-soft">
                  {data.health.total_events_all_time}
                  <span className="ml-1 text-xs text-ink-faint">筆累計</span>
                </span>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <p className="text-sm font-semibold text-ink">看券 → 申請</p>
            <p className="mb-3 mt-0.5 text-xs text-ink-faint">
              看了券的人裡，有多少真的按下申請、又有多少送得出去。
            </p>
            <Funnel steps={data.coupon_funnel} empty={`最近 ${data.window_days} 天還沒有看券的紀錄。`} />
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold text-ink">上架 → 完成</p>
            <p className="mb-3 mt-0.5 text-xs text-ink-faint">開始填上架表單後中途放棄的比例。</p>
            <Funnel steps={data.publish_funnel} empty={`最近 ${data.window_days} 天還沒有人開始上架。`} />
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold text-ink">通知點開</p>
            <p className="mb-3 mt-0.5 text-xs text-ink-faint">
              只有點開次數。點開率算不出來——「發出去幾則」目前沒有被記錄，要另外補。
            </p>
            <div className="grid grid-cols-2 gap-3">
              {data.opens.map((o) => (
                <div key={o.key} className="rounded-xl bg-sand px-3 py-2.5">
                  <p className="text-xs text-ink-soft">{o.label}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                    {o.events}
                    <span className="ml-1 text-xs font-normal text-ink-soft">次</span>
                  </p>
                  <p className="text-xs tabular-nums text-ink-faint">{o.actors} 人</p>
                </div>
              ))}
            </div>
          </Card>

          {data.by_platform.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold text-ink">來源平台</p>
              <div className="space-y-1.5">
                {data.by_platform.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                    <span className="tabular-nums text-ink-soft">
                      {p.events} 次
                      <span className="ml-1.5 text-xs text-ink-faint">{p.actors} 人</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
