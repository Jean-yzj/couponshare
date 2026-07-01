"use client";

import Link from "next/link";
import { useApi, useMe } from "@/lib/client";
import {
  Card,
  Skeleton,
  NeedLogin,
  Pill,
  PageHeader,
  Avatar,
  GradientPanel,
  ProgressBar,
  AchievementBadge,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { HeroSparkles } from "@/components/Mascot";
import { cn, relativeTime, LEVEL_META } from "@/lib/display";

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
const LEVEL_NUM: Record<string, number> = { LEVEL_1: 1, LEVEL_2: 2, LEVEL_3: 3 };

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

  const curMeta = LEVEL_META[data.user_level] ?? LEVEL_META.LEVEL_1;
  const levelNum = LEVEL_NUM[data.user_level] ?? 1;

  const doneEvents = new Set(data.ledger.map((e) => e.event_type));
  const badges: {
    icon: IconName;
    label: string;
    tone: "blue" | "gold" | "pine" | "teal" | "grape" | "rose";
    unlocked: boolean;
  }[] = [
    { icon: "leaf", label: "初來乍到", tone: "pine", unlocked: true },
    {
      icon: "gift",
      label: "樂於分享",
      tone: "blue",
      unlocked: doneEvents.has("COUPON_GIFTED") || data.contribution_score > 0,
    },
    { icon: "swap", label: "交換達人", tone: "teal", unlocked: doneEvents.has("COUPON_EXCHANGED") },
    { icon: "star", label: "人氣好評", tone: "gold", unlocked: doneEvents.has("POSITIVE_RATING") },
    { icon: "heart", label: "揪感心", tone: "rose", unlocked: doneEvents.has("THANK_YOU_MESSAGE") },
    { icon: "crown", label: "傳奇會員", tone: "grape", unlocked: data.user_level === "LEVEL_3" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Contribution"
        title="貢獻值與等級"
        subtitle="每一次贈出、交換與好評，都讓你更被社群信任。"
      />

      {/* Player card — gradient hero */}
      <GradientPanel className="mt-5 p-6">
        <HeroSparkles />
        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar
                name={me.display_name}
                url={me.avatar_url}
                size={64}
                className="ring-4 ring-white/30"
              />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-gold-ink shadow-soft">
                <Icon name="medal" size={15} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-extrabold">{me.display_name}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                <Icon name="medal" size={12} /> LV.{levelNum} · {data.level_name}
                <span className="tracking-tight text-white/90">{"★".repeat(curMeta.stars)}</span>
              </span>
            </div>
            <Link
              href="/leaderboard"
              aria-label="排行榜"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              <Icon name="trophy" size={18} />
            </Link>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-white/70">目前貢獻分</p>
              <p className="font-display text-[40px] font-extrabold leading-none">
                {data.contribution_score}
              </p>
            </div>
            {data.next_level && (
              <p className="text-right text-xs leading-relaxed text-white/80">
                再 <span className="font-bold text-white">{data.next_level.needScore}</span> 分
                <br />
                升上「{data.next_level.name}」
              </p>
            )}
          </div>

          {data.next_level ? (
            <div className="mt-3">
              <ProgressBar value={progress} onDark />
              <p className="mt-2 text-xs text-white/75">
                或本月再送出 {data.next_level.needGifts} 張也能升級（本月已送 {data.monthly_gifts} 張）
              </p>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white/15 py-2.5 text-sm font-bold backdrop-blur-sm">
              <Icon name="crown" size={18} /> 已達最高等級 · 傳奇 ★★★
            </div>
          )}
        </div>
      </GradientPanel>

      {/* Achievements */}
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="font-semibold text-ink">我的徽章</h2>
        <span className="text-xs text-ink-faint">
          已解鎖 {badges.filter((b) => b.unlocked).length}/{badges.length}
        </span>
      </div>
      <Card className="p-5">
        <div className="grid grid-cols-3 gap-y-5 sm:grid-cols-6">
          {badges.map((b) => (
            <AchievementBadge key={b.label} {...b} />
          ))}
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
          const lm = LEVEL_META[l.key] ?? LEVEL_META.LEVEL_1;
          return (
            <Card key={l.key} className={cn("p-4", active && "border-accent ring-2 ring-accent/15")}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white",
                      lm.emblem,
                      lm.emblemEdge,
                    )}
                  >
                    <Icon name="medal" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-ink">{l.name}</p>
                      <span className="text-[11px] leading-none text-gold">{"★".repeat(lm.stars)}</span>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-ink-faint">{l.label}</span>
                  </div>
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
