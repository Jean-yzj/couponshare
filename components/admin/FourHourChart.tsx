"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/display";

type FourHour = {
  labels: string[];
  signups: number[];
  coupons: number[];
  claims: number[];
  completed: number[];
  active: number[];
};

type SeriesKey = "active" | "claims" | "coupons" | "signups" | "completed";

const SERIES: { key: SeriesKey; label: string }[] = [
  { key: "active", label: "活躍" },
  { key: "claims", label: "申請" },
  { key: "coupons", label: "上架" },
  { key: "signups", label: "新增人數" },
  { key: "completed", label: "雙方完成" },
];

const COLORS: Record<SeriesKey, string> = {
  active: "var(--color-accent)",
  claims: "#6366f1",
  coupons: "#10b981",
  signups: "#f59e0b",
  completed: "#ef4444",
};

export function FourHourChart({ fourHour }: { fourHour: FourHour }) {
  const [active, setActive] = useState<Set<SeriesKey>>(
    new Set(["active", "claims", "coupons"])
  );

  function toggleSeries(key: SeriesKey) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const W = 600;
  const H = 120;
  const P = 8;
  const n = fourHour.labels.length;

  const allValues = SERIES.filter((s) => active.has(s.key)).flatMap(
    (s) => fourHour[s.key]
  );
  const maxVal = Math.max(1, ...allValues);

  const xAt = (i: number) =>
    n <= 1 ? W / 2 : P + (i / (n - 1)) * (W - 2 * P);
  const yAt = (v: number) => H - P - (v / maxVal) * (H - 2 * P);

  function polyline(key: SeriesKey) {
    const vals = fourHour[key];
    return vals
      .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
      .join(" ");
  }

  // Labels: show every other bucket on mobile; all on desktop via viewBox scale
  const labelIndices = fourHour.labels.map((_, i) => i).filter((i) => i % 2 === 0 || i === n - 1);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="mr-1 text-sm font-medium text-ink">48 小時脈搏（每 4 小時）</p>
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => toggleSeries(s.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity",
              active.has(s.key) ? "opacity-100" : "opacity-35"
            )}
            style={{ border: `1.5px solid ${COLORS[s.key]}`, color: COLORS[s.key] }}
          >
            <span
              className="inline-block h-1.5 w-3 rounded-full"
              style={{ background: COLORS[s.key] }}
            />
            {s.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-32 min-w-[300px] w-full"
        >
          {SERIES.filter((s) => active.has(s.key)).map((s) => (
            <polyline
              key={s.key}
              points={polyline(s.key)}
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
      <div className="mt-1 overflow-x-auto">
        <div className="flex min-w-[300px] justify-between text-[9px] text-ink-faint" style={{ paddingLeft: P, paddingRight: P }}>
          {labelIndices.map((i) => (
            <span key={i} style={{ transform: "rotate(-35deg)", display: "inline-block", transformOrigin: "top left" }}>
              {fourHour.labels[i]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
