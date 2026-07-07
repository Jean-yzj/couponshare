"use client";

import { Card } from "@/components/ui";

type CohortRow = {
  week_start: string;
  size: number;
  d1: number;
  d1_eligible: number;
  d7: number;
  d7_eligible: number;
  d30: number;
  d30_eligible: number;
};

type RetentionMeta = {
  data_since: string;
};

function pct(num: number, denom: number): string | null {
  if (denom === 0) return null;
  return ((num / denom) * 100).toFixed(0) + "%";
}

function cellBg(num: number, denom: number): string {
  if (denom === 0) return "transparent";
  const ratio = num / denom;
  // accent = #0182FD with alpha
  const alpha = 0.06 + ratio * 0.74;
  return `rgba(1, 130, 253, ${alpha.toFixed(3)})`;
}

export function RetentionCohort({
  retention,
  retentionMeta,
}: {
  retention: CohortRow[];
  retentionMeta?: RetentionMeta;
}) {
  if (!retention || retention.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-ink">留存 Cohort（週）</h2>
        <p className="py-3 text-sm text-ink-faint">尚無資料</p>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="font-semibold text-ink">留存 Cohort（週）</h2>
      </div>
      <p className="mb-1 text-[11px] text-ink-faint">
        D1 = 次日回訪；D7 / D30 = N 日內曾回訪（分母 = 已滿 N 日的成員）
      </p>
      {retentionMeta && (
        <p className="mb-4 text-[11px] text-ink-faint">
          {retentionMeta.data_since} 前的留存僅含有操作記錄的用戶，精準活躍打點自該日起累積；未到觀察期顯示「—」
        </p>
      )}
      {!retentionMeta && <div className="mb-4" />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th className="pb-2 text-left font-medium">週開始</th>
              <th className="pb-2 text-center font-medium">人數</th>
              <th className="pb-2 text-center font-medium">D1</th>
              <th className="pb-2 text-center font-medium">D7</th>
              <th className="pb-2 text-center font-medium">D30</th>
            </tr>
          </thead>
          <tbody>
            {retention.map((row) => {
              const d1p = pct(row.d1, row.d1_eligible);
              const d7p = pct(row.d7, row.d7_eligible);
              const d30p = pct(row.d30, row.d30_eligible);
              return (
                <tr key={row.week_start} className="border-b border-line/40">
                  <td className="py-2 text-xs text-ink-soft">{row.week_start}</td>
                  <td className="py-2 text-center text-xs tabular-nums text-ink-faint">
                    {row.size}
                  </td>
                  <CohortCell value={d1p} bg={cellBg(row.d1, row.d1_eligible)} />
                  <CohortCell value={d7p} bg={cellBg(row.d7, row.d7_eligible)} />
                  <CohortCell value={d30p} bg={cellBg(row.d30, row.d30_eligible)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CohortCell({ value, bg }: { value: string | null; bg: string }) {
  return (
    <td className="py-2 text-center tabular-nums" style={{ background: bg }}>
      <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-ink">
        {value ?? "—"}
      </span>
    </td>
  );
}
