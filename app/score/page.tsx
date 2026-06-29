"use client";

import { useApi, useMe } from "@/lib/client";
import { Card, Skeleton, NeedLogin, Pill } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Level = {
  key: string;
  name: string;
  min: number;
  max: number | null;
  daily_claim: number;
  daily_publish: number;
  perks: string[];
};
type Ledger = {
  id: string;
  event_type: string;
  score_delta: number;
  description: string | null;
  created_at: string;
};
type ScoreData = {
  contribution_score: number;
  user_level: string;
  level_name: string;
  risk_flag: boolean;
  next_level: { level: string; at: number } | null;
  levels: Level[];
  ledger: Ledger[];
};

const EVENT_META: Record<string, { label: string; icon: IconName }> = {
  COUPON_GIFTED: { label: "成功贈出票券", icon: "gift" },
  COUPON_EXCHANGED: { label: "成功交換票券", icon: "swap" },
  THANK_YOU_MESSAGE: { label: "留下感謝訊息", icon: "heart" },
  POSITIVE_RATING: { label: "收到 4 星以上好評", icon: "star" },
  INVALID_COUPON_REPORT_CONFIRMED: { label: "提供無效券", icon: "flag" },
  NO_SHOW_REPORT_CONFIRMED: { label: "惡意放鳥", icon: "flag" },
  ADMIN_ADJUSTMENT: { label: "管理員調整", icon: "shield" },
};

const LEVEL_EN: Record<string, string> = { LEVEL_1: "Newcomer", LEVEL_2: "Pro", LEVEL_3: "Legend" };

export default function ScorePage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading } = useApi<ScoreData>(me ? "/api/v1/me/score" : null);

  if (meLoading)
    return (
      <div className="flex justify-center py-20">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可查看你的貢獻值與會員等級。" />;
  if (loading || !data) return <Skeleton className="h-64 rounded-3xl" />;

  const currentLevel = data.levels.find((l) => l.key === data.user_level);
  const base = currentLevel?.min ?? 0;
  const target = data.next_level?.at ?? data.contribution_score;
  const progress = data.next_level
    ? Math.min(100, Math.max(0, ((data.contribution_score - base) / (target - base)) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">貢獻值與等級</h1>
      <p className="mt-1.5 text-sm text-ink-soft">每一次贈出、交換與好評，都讓你更靠近下一個等級。</p>

      {/* Score hero */}
      <Card className="mt-5 overflow-hidden">
        <div className="bg-gradient-to-br from-accent-tint to-transparent px-6 py-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-ink-soft">目前貢獻分</p>
              <p className="font-display text-6xl font-semibold leading-none text-ink">
                {data.contribution_score}
              </p>
            </div>
            <div className="text-right">
              <Pill className="bg-paper/80 text-ink" icon="medal">
                {data.level_name}
              </Pill>
              <p className="mt-1 font-display text-sm uppercase tracking-wide text-ink-faint">
                {LEVEL_EN[data.user_level]}
              </p>
            </div>
          </div>

          {data.next_level ? (
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-ink-soft">
                <span>距離下一級</span>
                <span className="font-medium text-ink">
                  還差 {Math.max(0, target - data.contribution_score)} 分
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-paper/70">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-5 flex items-center gap-1.5 text-sm font-medium text-gold">
              <Icon name="trophy" size={16} /> 你已達到最高等級，傳奇！
            </p>
          )}

          {data.risk_flag && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-accent-press">
              <Icon name="info" size={15} /> 你的分數偏低，每日申請上限已暫時調降。
            </p>
          )}
        </div>
      </Card>

      {/* Levels */}
      <h2 className="mb-3 mt-7 font-semibold text-ink">等級與權限</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.levels.map((l) => {
          const active = l.key === data.user_level;
          return (
            <Card
              key={l.key}
              className={cn("p-4", active && "border-accent ring-2 ring-accent/15")}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">{l.name}</p>
                {active && <Pill className="bg-accent-tint text-accent-press">目前</Pill>}
              </div>
              <p className="mt-0.5 text-xs text-ink-faint">
                {l.max ? `${l.min} – ${l.max} 分` : `${l.min}+ 分`}
              </p>
              <ul className="mt-3 space-y-1.5">
                <li className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <Icon name="check" size={13} className="text-pine" /> 每日申請 {l.daily_claim} 張
                </li>
                <li className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <Icon name="check" size={13} className="text-pine" /> 每日上架 {l.daily_publish} 張
                </li>
                {l.perks.slice(1).map((p) => (
                  <li key={p} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <Icon name="check" size={13} className="text-pine" /> {p}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* Ledger */}
      <h2 className="mb-3 mt-7 font-semibold text-ink">分數紀錄</h2>
      {data.ledger.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-soft">
          還沒有分數紀錄，開始分享票券來累積貢獻值吧。
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {data.ledger.map((e) => {
            const meta = EVENT_META[e.event_type] ?? { label: e.event_type, icon: "sparkle" as IconName };
            const positive = e.score_delta >= 0;
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    positive ? "bg-pine-tint text-pine" : "bg-accent-tint text-accent-press",
                  )}
                >
                  <Icon name={meta.icon} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{e.description || meta.label}</p>
                  <p className="text-xs text-ink-faint">{relativeTime(e.created_at)}</p>
                </div>
                <span
                  className={cn(
                    "font-display text-lg font-semibold",
                    positive ? "text-pine" : "text-accent-press",
                  )}
                >
                  {positive ? "+" : ""}
                  {e.score_delta}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
