"use client";

import { Card } from "@/components/ui";

type Health = {
  claim_approval_rate: number | null;
  avg_claims_per_coupon: number | null;
  avg_hours_to_claim: number | null;
  supply_demand_7d: number | null;
  pending_over_48h: number;
};

function HealthCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-bold tabular-nums ${
          warn ? "text-amber-600" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}

export function HealthCards({ health }: { health: Health }) {
  const approvalPct =
    health.claim_approval_rate !== null
      ? (health.claim_approval_rate * 100).toFixed(1) + "%"
      : "—";
  const avgClaims =
    health.avg_claims_per_coupon !== null
      ? health.avg_claims_per_coupon.toFixed(1)
      : "—";
  const avgHours =
    health.avg_hours_to_claim !== null
      ? health.avg_hours_to_claim.toFixed(1) + " 時"
      : "—";
  const supplyDemand =
    health.supply_demand_7d !== null
      ? health.supply_demand_7d.toFixed(2)
      : "—";
  const pending48h = health.pending_over_48h;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <HealthCard label="申請核准率" value={approvalPct} hint="已決定中核准比例" />
      <HealthCard label="平均每券申請數" value={avgClaims} hint="非草稿票券" />
      <HealthCard label="平均送出時數" value={avgHours} hint="從上架到被認領" />
      <HealthCard label="供需比（7 日）" value={supplyDemand} hint="新券 / 新申請" />
      <HealthCard
        label="超時待審（>48h）"
        value={pending48h.toString()}
        hint="申請等待超過 48 小時"
        warn={pending48h > 0}
      />
    </div>
  );
}
