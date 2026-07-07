"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/display";

type SeriesData = {
  days: string[];
  signups: number[];
  coupons: number[];
  transactions: number[];
  claimers: number[];
  sharers: number[];
  dau: number[];
  claims: number[];
  completed: number[];
};

type Key = "dau" | "signups" | "coupons" | "claims" | "completed" | "claimers" | "sharers" | "transactions";

const ALL_SERIES: { key: Key; label: string }[] = [
  { key: "dau", label: "DAU" },
  { key: "claims", label: "申請" },
  { key: "completed", label: "雙方完成" },
  { key: "signups", label: "新增人數" },
  { key: "coupons", label: "上架" },
  { key: "claimers", label: "送出申請人" },
  { key: "sharers", label: "分享人" },
  { key: "transactions", label: "媒合" },
];

const COLORS: Record<Key, string> = {
  dau: "var(--color-accent)",
  claims: "#6366f1",
  completed: "#10b981",
  signups: "#f59e0b",
  coupons: "#8b5cf6",
  claimers: "#06b6d4",
  sharers: "#ec4899",
  transactions: "#64748b",
};

const DEFAULT_ACTIVE: Set<Key> = new Set(["dau", "claims", "transactions"]);

export function SeriesChart({ series }: { series: SeriesData }) {
  const [active, setActive] = useState<Set<Key>>(DEFAULT_ACTIVE);

  function toggle(key: Key) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const W = 600;
  const H = 140;
  const P = 8;
  const n = series.days.length;

  const activeSeries = ALL_SERIES.filter((s) => active.has(s.key));
  const allValues = activeSeries.flatMap((s) => series[s.key]);
  const maxVal = Math.max(1, ...allValues);

  const xAt = (i: number) =>
    n <= 1 ? W / 2 : P + (i / (n - 1)) * (W - 2 * P);
  const yAt = (v: number) => H - P - (v / maxVal) * (H - 2 * P);

  function points(key: Key) {
    return series[key]
      .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
      .join(" ");
  }

  const total = series.days.length;
  const midIdx = Math.floor(total / 2);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <p className="mr-1 text-sm font-medium text-ink">30 日趨勢</p>
        {ALL_SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity",
              active.has(s.key) ? "opacity-100" : "opacity-30"
            )}
            style={{ border: `1.5px solid ${COLORS[s.key]}`, color: COLORS[s.key] }}
          >
            <span className="h-1.5 w-2.5 rounded-full" style={{ background: COLORS[s.key] }} />
            {s.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-36 min-w-[280px] w-full"
        >
          {activeSeries.map((s) => (
            <polyline
              key={s.key}
              points={points(s.key)}
              fill="none"
              stroke={COLORS[s.key]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.85"
            />
          ))}
        </svg>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
        <span>{series.days[0]}</span>
        <span>{series.days[midIdx]}</span>
        <span>{series.days[series.days.length - 1]}</span>
      </div>
    </Card>
  );
}
