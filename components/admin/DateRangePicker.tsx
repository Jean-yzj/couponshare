"use client";

import { useState } from "react";
import { cn } from "@/lib/display";

export type DateRange = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

type Preset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom";

function taipeiToday(): string {
  // Server is UTC; add 8h to get Taipei date
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function thisMonthRange(): DateRange {
  const today = taipeiToday();
  const from = today.slice(0, 7) + "-01";
  return { from, to: today };
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const today = taipeiToday();
  const yesterday = addDays(today, -1);

  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === "today") onChange({ from: today, to: today });
    else if (p === "yesterday") onChange({ from: yesterday, to: yesterday });
    else if (p === "last7") onChange({ from: addDays(today, -6), to: today });
    else if (p === "last30") onChange({ from: addDays(today, -29), to: today });
    else if (p === "thisMonth") onChange(thisMonthRange());
    // custom: don't fire onChange yet; user adjusts inputs
  }

  function applyCustom(from: string, to: string) {
    if (from && to && to >= from) {
      onChange({ from, to });
    }
  }

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "今日" },
    { key: "yesterday", label: "昨日" },
    { key: "last7", label: "近 7 天" },
    { key: "last30", label: "近 30 天" },
    { key: "thisMonth", label: "本月" },
    { key: "custom", label: "自訂" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={cn(
              "h-7 rounded-full px-3 text-xs font-medium transition-colors",
              preset === p.key
                ? "bg-accent text-white"
                : "bg-sand text-ink-soft hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-1.5 text-xs">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              applyCustom(e.target.value, customTo);
            }}
            className="rounded-lg border border-line bg-canvas px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="text-ink-faint">—</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={today}
            onChange={(e) => {
              setCustomTo(e.target.value);
              applyCustom(customFrom, e.target.value);
            }}
            className="rounded-lg border border-line bg-canvas px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      <span className="text-[11px] text-ink-faint">僅影響統計數字</span>
    </div>
  );
}
