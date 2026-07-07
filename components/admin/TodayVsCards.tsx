"use client";

import { Card } from "@/components/ui";

type TodayVsItem = {
  today: number;
  yesterday_same_time: number;
  avg_7d: number | null;
};

type TodayVs = {
  signups: TodayVsItem;
  coupons: TodayVsItem;
  claims: TodayVsItem;
  completed: TodayVsItem;
  reports: TodayVsItem;
};

function ArrowUp() {
  return (
    <svg className="inline h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg className="inline h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 3V11M7 11L3 7M7 11L11 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TodayVsCard({
  label,
  item,
  invertColor,
}: {
  label: string;
  item: TodayVsItem;
  invertColor?: boolean;
}) {
  const yday = item.yesterday_same_time;
  const pct = yday > 0 ? Math.round(((item.today - yday) / yday) * 100) : null;
  const isUp = pct !== null && pct > 0;
  const isDown = pct !== null && pct < 0;
  // For reports: up = bad (red), down = good (green)
  const goodColor = invertColor ? "text-danger" : "text-pine";
  const badColor = invertColor ? "text-pine" : "text-danger";

  return (
    <Card className="p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">
        {item.today.toLocaleString()}
      </p>
      <p className="mt-1 text-xs">
        {pct !== null ? (
          <span className={isUp ? goodColor : isDown ? badColor : "text-ink-faint"}>
            {isUp ? <ArrowUp /> : isDown ? <ArrowDown /> : null}
            {isUp ? "+" : ""}
            {pct}%
            <span className="ml-1 text-ink-faint">昨同期</span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </p>
      {item.avg_7d !== null && (
        <p className="mt-0.5 text-xs text-ink-faint">7 日均 {item.avg_7d}</p>
      )}
    </Card>
  );
}

export function TodayVsCards({ todayVs }: { todayVs: TodayVs }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <TodayVsCard label="今日新增人數" item={todayVs.signups} />
      <TodayVsCard label="今日新增票券" item={todayVs.coupons} />
      <TodayVsCard label="今日申請件數" item={todayVs.claims} />
      <TodayVsCard label="今日完成交易" item={todayVs.completed} />
      <TodayVsCard label="今日檢舉數" item={todayVs.reports} invertColor />
    </div>
  );
}
