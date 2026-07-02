"use client";

import Link from "next/link";
import { useApi, useMe } from "@/lib/client";
import {
  Avatar,
  Card,
  GradientPanel,
  LevelBadge,
  NeedLogin,
  LoadFailed,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";

type Entry = {
  rank: number;
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_level: string;
  level_name: string;
  contribution_score: number;
};
type Data = { top: Entry[]; me: { rank: number; contribution_score: number } | null };

// Medal styling for the podium (ranks 1-3), using defined design tokens.
const MEDAL: Record<number, { ring: string; badge: string }> = {
  1: { ring: "ring-gold", badge: "bg-grad-gold" },
  2: { ring: "ring-ink-faint/50", badge: "bg-ink-faint" },
  3: { ring: "ring-gold-ink/50", badge: "bg-gold-ink" },
};

export default function LeaderboardPage() {
  const { me } = useMe();
  // Unconditional: parallel with the session check (endpoint enforces auth itself).
  const { data, loading, error, refetch } = useApi<Data>("/api/v1/leaderboard");

  if (!me) return <NeedLogin message="登入後即可查看貢獻排行榜。" />;
  if (error && !data)
    return (
      <div className="mx-auto max-w-2xl">
        <LoadFailed onRetry={refetch} />
      </div>
    );
  if (loading || !data)
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );

  const podium = data.top.slice(0, 3);
  const rest = data.top.slice(3);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Leaderboard" title="貢獻排行榜" subtitle="分享越多、幫助越多人，排名越前面。" />

      {/* Your rank */}
      {data.me && (
        <GradientPanel className="mt-5 flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={me.display_name} url={me.avatar_url} size={44} className="ring-2 ring-white/40" />
            <div>
              <p className="text-xs font-medium text-white/70">你目前的排名</p>
              <p className="font-display text-2xl font-extrabold leading-none">第 {data.me.rank} 名</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold leading-none">{data.me.contribution_score}</p>
            <p className="mt-1 text-xs text-white/70">貢獻分</p>
          </div>
        </GradientPanel>
      )}

      {/* Podium */}
      {podium.length > 0 && (
        <div className="mt-6 grid grid-cols-3 items-end gap-2.5">
          {[1, 0, 2].map((slot) => {
            const e = podium[slot];
            if (!e) return <div key={slot} />;
            const m = MEDAL[e.rank];
            const isFirst = e.rank === 1;
            return (
              <Link
                key={e.id}
                href={`/users/${e.id}`}
                className={cn(
                  "flex flex-col items-center rounded-2xl border border-line bg-paper p-3 shadow-soft",
                  isFirst && "-mt-2 pb-4",
                )}
              >
                <div className="relative">
                  <Avatar
                    name={e.display_name}
                    url={e.avatar_url}
                    size={isFirst ? 64 : 52}
                    className={cn("ring-4", m.ring)}
                  />
                  <span
                    className={cn(
                      "absolute -bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-xs font-extrabold text-white ring-2 ring-paper",
                      m.badge,
                    )}
                  >
                    {e.rank}
                  </span>
                </div>
                <p className="mt-3 max-w-full truncate text-sm font-bold text-ink">{e.display_name}</p>
                <p className="mt-0.5 flex items-center gap-1 font-display text-lg font-extrabold text-accent">
                  {e.contribution_score}
                </p>
                <span className="text-[11px] text-ink-faint">貢獻分</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Rest of the list */}
      {rest.length > 0 && (
        <Card className="mt-4 divide-y divide-line">
          {rest.map((e) => {
            const mine = e.id === me.id;
            return (
              <Link
                key={e.id}
                href={`/users/${e.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas-2",
                  mine && "bg-accent-tint/50",
                )}
              >
                <span className="w-6 shrink-0 text-center font-display text-base font-extrabold text-ink-faint">
                  {e.rank}
                </span>
                <Avatar name={e.display_name} url={e.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-medium text-ink">{e.display_name}</p>
                    {mine && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">你</span>
                    )}
                    <LevelBadge level={e.user_level} />
                  </div>
                </div>
                <span className="shrink-0 font-display text-base font-extrabold text-accent">
                  {e.contribution_score}
                </span>
              </Link>
            );
          })}
        </Card>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/score"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-press"
        >
          <Icon name="arrowLeft" size={15} /> 回到我的貢獻值
        </Link>
      </div>
    </div>
  );
}
