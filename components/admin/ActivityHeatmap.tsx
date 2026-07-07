"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/display";

type HeatmapData = {
  claims: number[][];
  uploads: number[][];
  completions: number[][];
};

type MetricKey = "claims" | "uploads" | "completions";

const METRIC_LABELS: Record<MetricKey, string> = {
  claims: "申請",
  uploads: "上架",
  completions: "雙方完成",
};

const DAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function ActivityHeatmap({ activityHeatmap }: { activityHeatmap: HeatmapData }) {
  const [metric, setMetric] = useState<MetricKey>("claims");
  const matrix = activityHeatmap[metric]; // [7][24]

  const allVals = matrix.flatMap((row) => row);
  const max = Math.max(1, ...allVals);

  function cellOpacity(v: number): number {
    if (v === 0) return 0;
    return 0.08 + (v / max) * 0.82;
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-1 font-semibold text-ink">活躍熱力圖（台北時區，14 日）</h2>
        <div className="flex gap-1">
          {(["claims", "uploads", "completions"] as MetricKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={cn(
                "rounded-full px-3 py-0.5 text-xs font-medium transition-colors",
                metric === k
                  ? "bg-accent text-white"
                  : "bg-sand text-ink-soft hover:text-ink"
              )}
            >
              {METRIC_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          {/* Hour axis header */}
          <div className="mb-1 flex">
            <div className="w-6 shrink-0" />
            <div className="flex flex-1 justify-between px-0.5 text-[9px] text-ink-faint">
              {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>
          {/* Rows: weekday */}
          {matrix.map((row, di) => (
            <div key={di} className="mb-0.5 flex items-center gap-0.5">
              <span className="w-5 shrink-0 text-right text-[10px] text-ink-faint">
                {DAYS[di]}
              </span>
              <div className="flex flex-1 gap-px">
                {row.map((v, h) => (
                  <div
                    key={h}
                    className="h-4 flex-1 rounded-sm"
                    style={{
                      background: `rgba(1, 130, 253, ${cellOpacity(v).toFixed(3)})`,
                    }}
                    title={`週${DAYS[di]} ${h}:00　${v} 次`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-ink-faint">色深代表活躍次數；週一為首列；台北時間（UTC+8）</p>
    </Card>
  );
}
