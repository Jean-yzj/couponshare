"use client";

import { Card } from "@/components/ui";
import { cn } from "@/lib/display";

type VsItem = { current: number; previous: number };

type PeriodVs = {
  label_current: string;
  label_previous: string;
  signups: VsItem;
  coupons: VsItem;
  claims: VsItem;
  completed: VsItem;
  reports: VsItem;
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

function VsCard({
  label,
  item,
  labelCurrent,
  labelPrevious,
  invertColor,
}: {
  label: string;
  item: VsItem;
  labelCurrent: string;
  labelPrevious: string;
  invertColor?: boolean;
}) {
  const { current, previous } = item;

  // Safe percentage: previous=0 → show "新" instead of Infinity/NaN
  let pctDisplay: React.ReactNode;
  if (previous === 0) {
    pctDisplay = <span className="text-ink-faint">新</span>;
  } else {
    const pct = Math.round(((current - previous) / previous) * 100);
    const isUp = pct > 0;
    const isDown = pct < 0;
    const goodColor = invertColor ? "text-danger" : "text-pine";
    const badColor = invertColor ? "text-pine" : "text-danger";
    pctDisplay = (
      <span className={cn(isUp ? goodColor : isDown ? badColor : "text-ink-faint")}>
        {isUp ? <ArrowUp /> : isDown ? <ArrowDown /> : null}
        {isUp ? "+" : ""}
        {pct}%
        <span className="ml-1 text-ink-faint">vs {labelPrevious}</span>
      </span>
    );
  }

  return (
    <Card className="p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">
        {current.toLocaleString()}
      </p>
      <p className="mt-1 text-xs">{pctDisplay}</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        {labelPrevious}：{previous.toLocaleString()}
      </p>
    </Card>
  );
}

export function PeriodVsCards({ periodVs }: { periodVs: PeriodVs }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <VsCard
        label="期間新增人數"
        item={periodVs.signups}
        labelCurrent={periodVs.label_current}
        labelPrevious={periodVs.label_previous}
      />
      <VsCard
        label="期間新增票券"
        item={periodVs.coupons}
        labelCurrent={periodVs.label_current}
        labelPrevious={periodVs.label_previous}
      />
      <VsCard
        label="期間申請件數"
        item={periodVs.claims}
        labelCurrent={periodVs.label_current}
        labelPrevious={periodVs.label_previous}
      />
      <VsCard
        label="期間完成交易"
        item={periodVs.completed}
        labelCurrent={periodVs.label_current}
        labelPrevious={periodVs.label_previous}
      />
      <VsCard
        label="期間檢舉數"
        item={periodVs.reports}
        labelCurrent={periodVs.label_current}
        labelPrevious={periodVs.label_previous}
        invertColor
      />
    </div>
  );
}
