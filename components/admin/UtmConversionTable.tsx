"use client";

import { Card } from "@/components/ui";

type UtmRow = {
  source: string;
  signups: number;
  sharers: number;
  claimers: number;
  active_7d: number;
};

export function UtmConversionTable({ rows }: { rows: UtmRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-ink">來源品質表</h2>
        <p className="py-3 text-sm text-ink-faint">尚無資料</p>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold text-ink">來源品質表</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th className="pb-2 text-left font-medium">來源</th>
              <th className="pb-2 text-right font-medium">註冊</th>
              <th className="pb-2 text-right font-medium">曾分享</th>
              <th className="pb-2 text-right font-medium">曾申請</th>
              <th className="pb-2 text-right font-medium">7 日活躍</th>
              <th className="pb-2 text-right font-medium">分享率</th>
              <th className="pb-2 text-right font-medium">申請率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const shareRate =
                r.signups > 0
                  ? ((r.sharers / r.signups) * 100).toFixed(1) + "%"
                  : "—";
              const claimRate =
                r.signups > 0
                  ? ((r.claimers / r.signups) * 100).toFixed(1) + "%"
                  : "—";
              return (
                <tr key={r.source} className="border-b border-line/40 hover:bg-sand/30">
                  <td className="py-2 font-medium text-ink">{r.source}</td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {r.signups.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {r.sharers.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {r.claimers.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {r.active_7d.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink">{shareRate}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{claimRate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
