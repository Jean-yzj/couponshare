"use client";

import { useApi, useMe } from "@/lib/client";
import { Card, Skeleton, NeedLogin, Pill } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Rule = { label: string; delta: number; icon: IconName };
type Level = {
  key: string;
  name: string;
  label: string;
  min_score: number;
  max_score: number | null;
  monthly_gifts: number;
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
  monthly_gifts: number;
  next_level: { level: string; name: string; needScore: number; needGifts: number } | null;
  earn_rules: Rule[];
  penalty_rules: Rule[];
  levels: Level[];
  ledger: Ledger[];
};

const EVENT_ICON: Record<string, IconName> = {
  COUPON_GIFTED: "gift",
  COUPON_EXCHANGED: "swap",
  THANK_YOU_MESSAGE: "heart",
  POSITIVE_RATING: "star",
  COUPON_WITHDRAWN: "ban",
  INVALID_COUPON_REPORT_CONFIRMED: "flag",
  NO_SHOW_REPORT_CONFIRMED: "flag",
  ADMIN_ADJUSTMENT: "shield",
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

  const cur = data.levels.find((l) => l.key === data.user_level);
  const nextL = data.next_level ? data.levels.find((l) => l.key === data.next_level!.level) : null;
  const base = cur?.min_score ?? 0;
  const target = nextL?.min_score ?? data.contribution_score;
  const progress = nextL
    ? Math.min(100, Math.max(0, ((data.contribution_score - base) / (target - base)) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">貢獻值與等級</h1>
      <p className="mt-1.5 text-sm text-ink-soft">每一次贈出、交換與好評，都讓你更被社群信任。</p>

      {/* Score hero */}
      <Card className="mt-5 overflow-hidden">
        <div className="bg-accent-tint px-6 py-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-ink-soft">目前貢獻分</p>
              <p className="text-6xl font-bold leading-none tracking-tight text-ink">
                {data.contribution_score}
              </p>
            </div>
            <div className="text-right">
              <Pill className="bg-paper text-accent-press" icon="medal">
                {data.level_name}
              </Pill>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-ink-faint">
                {LEVEL_EN[data.user_level]}
              </p>
              <p className="mt-1 text-xs text-ink-soft">本月已送出 {data.monthly_gifts} 張</p>
            </div>
          </div>

          {data.next_level ? (
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-ink-soft">
                <span>升級到 {data.next_level.name}</span>
                <span className="font-medium text-ink">
                  再 +{data.next_level.needScore} 分　或　本月再送出 {data.next_level.needGifts} 張
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <p className="mt-5 flex items-center gap-1.5 text-sm font-medium text-gold">
              <Icon name="trophy" size={16} /> 你已達到最高等級，傳奇！
            </p>
          )}
        </div>
      </Card>

      {/* How to earn */}
      <h2 className="mb-3 mt-7 font-semibold text-ink">如何賺取貢獻分</h2>
      <Card className="divide-y divide-line">
        {data.earn_rules.map((r) => (
          <RuleRow key={r.label} rule={r} positive />
        ))}
        {data.penalty_rules.map((r) => (
          <RuleRow key={r.label} rule={r} positive={false} />
        ))}
      </Card>

      {/* Levels */}
      <h2 className="mb-3 mt-7 font-semibold text-ink">等級與權限</h2>
      <div className="space-y-3">
        {data.levels.map((l) => {
          const active = l.key === data.user_level;
          return (
            <Card key={l.key} className={cn("p-4", active && "border-accent ring-2 ring-accent/15")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{l.name}</p>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    {l.label}
                  </span>
                </div>
                {active && <Pill className="bg-accent-tint text-accent-press">目前</Pill>}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                達成條件：
                {l.key === "LEVEL_1" ? (
                  <span>所有人預設</span>
                ) : (
                  <span className="font-medium text-ink">
                    貢獻分 ≥ {l.min_score}　或　當月成功送出 ≥ {l.monthly_gifts} 張
                  </span>
                )}
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {l.perks.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <Icon name="check" size={13} className="shrink-0 text-pine" /> {p}
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
            const positive = e.score_delta >= 0;
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    positive ? "bg-pine-tint text-pine" : "bg-danger-tint text-danger",
                  )}
                >
                  <Icon name={EVENT_ICON[e.event_type] ?? "sparkle"} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{e.description || e.event_type}</p>
                  <p className="text-xs text-ink-faint">{relativeTime(e.created_at)}</p>
                </div>
                <span className={cn("text-lg font-bold", positive ? "text-pine" : "text-danger")}>
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

function RuleRow({ rule, positive }: { rule: Rule; positive: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          positive ? "bg-pine-tint text-pine" : "bg-danger-tint text-danger",
        )}
      >
        <Icon name={rule.icon} size={17} />
      </span>
      <p className="flex-1 text-sm text-ink">{rule.label}</p>
      <span className={cn("text-base font-bold", positive ? "text-pine" : "text-danger")}>
        {rule.delta > 0 ? "+" : ""}
        {rule.delta}
      </span>
    </div>
  );
}
