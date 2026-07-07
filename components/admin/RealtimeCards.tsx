"use client";

import { Card } from "@/components/ui";

type Realtime = {
  online_5m: number;
  active_30m: number;
  active_1h: number;
  active_24h: number;
};

export function RealtimeCards({ realtime }: { realtime: Realtime }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RealtimeCard label="目前在線" value={realtime.online_5m} accent />
        <RealtimeCard label="30 分鐘活躍" value={realtime.active_30m} />
        <RealtimeCard label="1 小時活躍" value={realtime.active_1h} />
        <RealtimeCard label="24 小時活躍" value={realtime.active_24h} />
      </div>
      <p className="text-xs text-ink-faint">在線 = 5 分鐘內有請求的登入使用者</p>
    </div>
  );
}

function RealtimeCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card className="p-4 text-center">
      <p
        className={`font-display text-3xl font-extrabold tabular-nums ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
    </Card>
  );
}
