"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, useMe } from "@/lib/client";
import {
  Button,
  Card,
  Skeleton,
  NeedLogin,
  LoadFailed,
  Pill,
  PageHeader,
  Avatar,
  GradientPanel,
  ProgressBar,
  LevelEmblem,
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
  event_counts: Record<string, number>;
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

// Tiered achievements — each earns 銅 → 銀 → 金 → 傳說 as the lifetime count climbs,
// so there's always a next goal instead of everything unlocking on the first action.
const TIER_STYLE = [
  { name: "銅牌", bg: "#C17A43", edge: "#98592F" },
  { name: "銀牌", bg: "#96A2AF", edge: "#697583" },
  { name: "金牌", bg: "#F0A200", edge: "#B77C00" },
  { name: "傳說", bg: "#7C5CFC", edge: "#5B3FD1" },
];
const ACHIEVEMENTS: { key: string; label: string; unit: string; icon: IconName; thresholds: number[] }[] = [
  { key: "COUPON_GIFTED", label: "送出票券", unit: "張", icon: "gift", thresholds: [1, 10, 100, 1000] },
  { key: "COUPON_EXCHANGED", label: "完成交換", unit: "次", icon: "swap", thresholds: [1, 10, 50, 200] },
  { key: "POSITIVE_RATING", label: "收到好評", unit: "則", icon: "star", thresholds: [1, 10, 50, 200] },
  { key: "THANK_YOU_MESSAGE", label: "收到感謝", unit: "則", icon: "heart", thresholds: [1, 10, 50, 200] },
];

export default function ScorePage() {
  const { me, loading: meLoading } = useMe();
  // Unconditional: runs in parallel with the /auth/me session check (the API
  // itself enforces auth); gating on `me` would serialise the two round-trips.
  const { data, loading, error, refetch } = useApi<ScoreData>("/api/v1/me/score");

  if (meLoading)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可查看你的貢獻值與會員等級。" />;
  if (error && !data) return <LoadFailed onRetry={refetch} />;
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

  const counts = data.event_counts ?? {};
  const achievements = ACHIEVEMENTS.map((a) => {
    const count = counts[a.key] ?? 0;
    const tier = a.thresholds.filter((t) => count >= t).length; // 0=locked … 4=傳說
    return { ...a, count, tier };
  });
  const unlockedTiers = achievements.reduce((n, a) => n + a.tier, 0);
  const totalTiers = ACHIEVEMENTS.length * TIER_STYLE.length;

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
              <span className="absolute -bottom-2 -right-2 rounded-[11px] bg-white/90 p-0.5 shadow-soft">
                <LevelEmblem level={data.user_level} size={30} />
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

      {/* Today's daily application quota */}
      {me.apply_remaining !== undefined && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-tint text-accent">
            <Icon name="send" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">今日申請額度</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {me.has_shared
                ? `每日 ${me.apply_base} 張，每分享一張券當天再 +3`
                : `體驗期共 3 次，分享一張券後改為依等級每日 ${me.apply_base} 張`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl font-extrabold leading-none text-accent">
              {me.apply_remaining}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">還可申請</p>
          </div>
        </div>
      )}

      {/* This month's accumulated bonus pool (社群發文 / 推薦) — usable any day this month */}
      {me.apply_bonus_pool !== undefined && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pine-tint text-pine">
            <Icon name="coin" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">本月累積額度</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              發文、邀請賺到的加碼次數，這個月內哪天用都可以。
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl font-extrabold leading-none text-pine">
              {me.apply_bonus_pool}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">次剩餘</p>
          </div>
        </div>
      )}

      {/* Social post reward entry (before invite, per product order) */}
      <div className="mt-4 rounded-2xl border border-line bg-paper p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-tint text-accent">
            <Icon name="send" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">社群發文換申請次數</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              發文分享使用心得，最多換 20 次申請次數（每月限 500 名）。
            </p>
          </div>
        </div>
        <Button href="/social-reward" full variant="outline" iconRight="chevronRight" className="mt-3">
          前往發文
        </Button>
      </div>

      {/* Invite friends */}
      <InviteCard userId={me.id} />

      {/* Achievements — tiered 銅 / 銀 / 金 / 傳說 */}
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="font-semibold text-ink">成就徽章</h2>
        <span className="text-xs text-ink-faint">已達 {unlockedTiers}/{totalTiers} 級</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {achievements.map((a) => (
          <TierAchievement
            key={a.key}
            label={a.label}
            unit={a.unit}
            icon={a.icon}
            thresholds={a.thresholds}
            count={a.count}
            tier={a.tier}
          />
        ))}
      </div>

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
                  <LevelEmblem level={l.key} size={54} className="-my-1 shrink-0" />
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

function InviteCard({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login?ref=${userId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can share the page URL manually */
    }
  }
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pine-tint text-pine">
          <Icon name="gift" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">邀請好友，賺申請次數</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            歡迎大家一起讓更多人知道這個平臺，然後把善意傳遞下去。
          </p>
        </div>
      </div>
      <button
        onClick={copy}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-grad-brand py-2.5 text-sm font-semibold text-white shadow-glow transition-transform active:scale-[0.99]"
      >
        <Icon name={copied ? "check" : "share"} size={16} />
        {copied ? "已複製邀請連結" : "複製我的邀請連結"}
      </button>
    </div>
  );
}

function TierAchievement({
  label,
  unit,
  icon,
  thresholds,
  count,
  tier,
}: {
  label: string;
  unit: string;
  icon: IconName;
  thresholds: number[];
  count: number;
  tier: number;
}) {
  const unlocked = tier > 0;
  const cur = unlocked ? TIER_STYLE[tier - 1] : { name: "未解鎖", bg: "#D9D3C7", edge: "#B9B3A6" };
  const nextT = tier < thresholds.length ? thresholds[tier] : null;
  const prevT = tier > 0 ? thresholds[tier - 1] : 0;
  const pct = nextT ? Math.min(100, Math.round(((count - prevT) / (nextT - prevT)) * 100)) : 100;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3.5 shadow-soft">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
        style={{ backgroundColor: cur.bg, boxShadow: `0 3px 0 0 ${cur.edge}` }}
      >
        <Icon name={icon} size={22} className={unlocked ? undefined : "opacity-60"} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold text-ink">{label}</p>
          <span
            className={cn("shrink-0 text-xs font-bold", !unlocked && "text-ink-faint")}
            style={unlocked ? { color: cur.edge } : undefined}
          >
            {cur.name}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cur.bg }} />
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          {nextT
            ? `已達 ${count} ${unit}・距${TIER_STYLE[tier].name}還差 ${(nextT - count).toLocaleString()} ${unit}`
            : `已達 ${count.toLocaleString()} ${unit}・最高級`}
        </p>
      </div>
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
