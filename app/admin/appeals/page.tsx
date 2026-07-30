"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Avatar, LevelBadge, Skeleton, EmptyState, NeedLogin, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ReasonModal } from "@/components/ReasonModal";
import { cn, relativeTime } from "@/lib/display";

const REJECT_PRESETS = [
  "經複核，原停權處置正確，維持停權",
  "申訴未提出新的具體事證",
  "違規事實明確，不予恢復",
  "多次被檢舉且經查證屬實",
];

type AppealRow = {
  id: string;
  status: string;
  message: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    user_level: string;
    level_name: string;
    contribution_score: number;
    status: string;
  };
};

const TABS = [
  { key: "PENDING", label: "待處理" },
  { key: "ACCEPTED", label: "已通過" },
  { key: "REJECTED", label: "已駁回" },
] as const;

export default function AdminAppealsPage() {
  const { me, loading: meLoading } = useMe();
  const [tab, setTab] = useState<"PENDING" | "ACCEPTED" | "REJECTED">("PENDING");
  const { data, loading, refetch } = useApi<{ data: AppealRow[] }>(
    me?.is_admin ? `/api/v1/admin/appeals?status=${tab}` : null,
  );
  const [acting, setActing] = useState<string | null>(null);
  const [pendingReject, setPendingReject] = useState<string | null>(null);

  if (meLoading)
    return (
      <div className="flex justify-center py-20">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可使用管理功能。" />;
  if (!me.is_admin)
    return (
      <div className="py-10">
        <EmptyState icon="lock" title="沒有權限" hint="這是管理員專用頁面。" action={<Button href="/" variant="outline">回到探索</Button>} />
      </div>
    );

  async function submit(id: string, decision: "ACCEPT" | "REJECT", note?: string) {
    setActing(id);
    try {
      await apiFetch(`/api/v1/admin/appeals/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ decision, note: note ?? null }),
      });
      setPendingReject(null);
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setActing(null);
    }
  }

  function accept(id: string) {
    if (!window.confirm("通過申訴並恢復這個帳號？")) return;
    submit(id, "ACCEPT");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">申訴複核</h1>
      <p className="mt-1.5 text-sm text-ink-soft">審核被停權帳號的申訴。通過即自動恢復帳號並重新上架其票券。</p>

      <div className="mt-5 inline-flex gap-1 rounded-full bg-sand p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-paper text-ink shadow-soft" : "text-ink-soft",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon="shieldCheck" title="沒有待處理的申訴" hint="目前這個分頁是空的。" />
        ) : (
          data.data.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-3">
                <Link href={`/users/${a.user.id}`}>
                  <Avatar name={a.user.display_name} url={a.user.avatar_url} size={40} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/users/${a.user.id}`} className="truncate font-medium text-ink hover:text-accent">
                      {a.user.display_name}
                    </Link>
                    <LevelBadge level={a.user.user_level} />
                  </div>
                  <p className="text-xs text-ink-faint">
                    {a.user.contribution_score} 貢獻分 · {relativeTime(a.created_at)} 申訴
                  </p>
                </div>
                {a.status !== "PENDING" && (
                  <Pill className={a.status === "ACCEPTED" ? "bg-pine-tint text-pine" : "bg-sand text-ink-faint"}>
                    {a.status === "ACCEPTED" ? "已通過" : "已駁回"}
                  </Pill>
                )}
              </div>

              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-canvas/60 p-3 text-sm leading-relaxed text-ink-soft">
                {a.message}
              </p>

              {a.admin_note && (
                <p className="mt-2 text-xs text-ink-faint">複核備註：{a.admin_note}</p>
              )}

              <SuspensionContext userId={a.user.id} />

              {a.status === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon="check" loading={acting === a.id} onClick={() => accept(a.id)}>
                    通過，恢復帳號
                  </Button>
                  <Button size="sm" variant="danger" loading={acting === a.id} onClick={() => setPendingReject(a.id)}>
                    駁回
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <ReasonModal
        open={!!pendingReject}
        title="駁回這則申訴"
        hint="會通知對方駁回原因，維持原停權。"
        presets={REJECT_PRESETS}
        confirmLabel="駁回申訴"
        confirmVariant="danger"
        busy={!!pendingReject && acting === pendingReject}
        onCancel={() => setPendingReject(null)}
        onConfirm={(reason) =>
          pendingReject && submit(pendingReject, "REJECT", reason || undefined)
        }
      />
    </div>
  );
}

type SuspensionCtx = {
  suspension: {
    kind: string;
    label: string;
    at: string;
    actor: { id: string; display_name: string } | null;
    reason: string | null;
    detail: Record<string, unknown> | null;
  } | null;
  reports_against: {
    id: string;
    reason_label: string;
    description: string | null;
    evidence_image_url: string | null;
    status: string;
    admin_note: string | null;
    created_at: string;
    coupon: { id: string; title: string; brand: string | null; status: string } | null;
    reporter: {
      id: string;
      display_name: string;
      account_age_days: number;
      contribution_score: number;
      status: string;
    } | null;
  }[];
  stats: {
    distinct_reporters: number;
    reports_against_count: number;
    reports_filed_count: number;
    transactions_completed: number;
    transactions_disputed: number;
    rating_avg: number | null;
    rating_count: number;
    appeals_count: number;
    coupons_by_status: Record<string, number>;
  };
  user: { account_age_days: number; contribution_score: number };
};

// The reviewer's core question is "why is this person suspended?" — the answer
// lives in audit_logs + reports, which the appeal row never carried. Collapsed
// by default so the queue stays scannable; fetched only when opened.
function SuspensionContext({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const { data, loading } = useApi<SuspensionCtx>(
    open ? `/api/v1/admin/users/${userId}/suspension-context` : null,
  );

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-press"
      >
        <Icon name="chevronDown" className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        {open ? "收合停權原因" : "查看停權原因"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading || !data ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : (
            <>
              {data.suspension ? (
                <div className="rounded-xl bg-danger-tint/50 p-3">
                  <p className="text-sm font-bold text-danger">{data.suspension.label}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {relativeTime(data.suspension.at)}
                    {data.suspension.actor && ` · 執行者 ${data.suspension.actor.display_name}`}
                  </p>
                  {data.suspension.reason && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">
                      理由：{data.suspension.reason}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-sand p-3 text-sm text-ink-soft">
                  查無停權紀錄。可能是舊資料（稽核日誌上線前），或帳號其實未被停權。
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Stat
                  label="不同檢舉人"
                  value={String(data.stats.distinct_reporters)}
                  warn={data.stats.distinct_reporters >= 3}
                  hint="滿 3 人即自動停權"
                />
                <Stat label="完成交易" value={String(data.stats.transactions_completed)} />
                <Stat
                  label="評價"
                  value={
                    data.stats.rating_count
                      ? `${data.stats.rating_avg?.toFixed(1)} / ${data.stats.rating_count}`
                      : "無"
                  }
                />
                <Stat
                  label="他檢舉別人"
                  value={String(data.stats.reports_filed_count)}
                  warn={data.stats.reports_filed_count >= 3}
                  hint="偏高可能是互相檢舉"
                />
              </div>

              {data.reports_against.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
                    被檢舉明細（{data.reports_against.length}）
                  </p>
                  <div className="space-y-2">
                    {data.reports_against.map((r) => (
                      <div key={r.id} className="rounded-xl bg-canvas/60 p-2.5 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill className="bg-danger-tint text-danger">{r.reason_label}</Pill>
                          {r.coupon && (
                            <Link
                              href={`/coupons/${r.coupon.id}`}
                              className="truncate text-ink-soft hover:text-accent"
                            >
                              {r.coupon.title}
                            </Link>
                          )}
                          <span className="ml-auto text-ink-faint">{relativeTime(r.created_at)}</span>
                        </div>
                        {r.description && (
                          <p className="mt-1.5 whitespace-pre-wrap text-ink-soft">{r.description}</p>
                        )}
                        {r.reporter && (
                          <p className="mt-1.5 text-ink-faint">
                            檢舉人 {r.reporter.display_name} · 帳齡{" "}
                            <span className={cn(r.reporter.account_age_days < 2 && "font-bold text-danger")}>
                              {r.reporter.account_age_days} 天
                            </span>{" "}
                            · {r.reporter.contribution_score} 貢獻分
                          </p>
                        )}
                        {r.evidence_image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.evidence_image_url}
                            alt="檢舉證據"
                            className="mt-2 max-h-48 rounded-lg border border-line object-contain"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
  hint,
}: {
  label: string;
  value: string;
  warn?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-canvas/60 p-2">
      <p className="text-ink-faint">{label}</p>
      <p className={cn("mt-0.5 text-sm font-bold", warn ? "text-danger" : "text-ink")}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-ink-faint">{hint}</p>}
    </div>
  );
}
