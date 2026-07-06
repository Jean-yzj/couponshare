"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Skeleton, EmptyState, NeedLogin, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ReasonModal } from "@/components/ReasonModal";
import { cn, relativeTime } from "@/lib/display";

type ReportAction = "dismiss" | "dismiss_malicious" | "strike_user" | "remove_coupon" | "suspend_user";
const ACTION_META: Record<
  ReportAction,
  { title: string; hint: string; variant: "primary" | "danger" | "outline"; presets: string[] }
> = {
  dismiss: {
    title: "駁回檢舉（判定無違規）",
    hint: "會通知檢舉人結果。",
    variant: "outline",
    presets: [
      "證據不足，無法判定違規",
      "檢舉內容與事實不符",
      "屬雙方交易糾紛，非平台違規",
      "票券經確認有效、無問題",
    ],
  },
  dismiss_malicious: {
    title: "判定惡意 / 不實檢舉",
    hint: "檢舉者記一次違規，累積 3 次自動停權。",
    variant: "danger",
    presets: ["查無此交易，疑似惡意檢舉", "重複濫用檢舉功能", "檢舉內容明顯不實、意圖騷擾"],
  },
  strike_user: {
    title: "記一次檢舉（累積 3 次停權）",
    hint: "被檢舉者記一次違規，滿 3 次系統自動停權。",
    variant: "danger",
    presets: [
      "提供無效或已過期的票券",
      "三天以上未回覆，視為放對方鴿子",
      "票券已被使用、無法兌換",
      "交換要求不合理",
    ],
  },
  remove_coupon: {
    title: "下架此券",
    hint: "會通知持有者。",
    variant: "danger",
    presets: ["無效券 / 已過期 / 已被使用", "未載明折扣金額或內容不具體", "涉及轉售、營利或違反平台規範"],
  },
  suspend_user: {
    title: "停權此帳號並下架其票券",
    hint: "會通知對方，可提出申訴。",
    variant: "danger",
    presets: ["多次提供無效券、經查證屬實", "多次放鳥、惡意不履行交換", "不當言論、騷擾或詐騙行為"],
  },
};

const REASON_LABEL: Record<string, string> = {
  INVALID_COUPON: "無效券 / 無法使用",
  EXPIRED_COUPON: "已過期",
  ALREADY_USED: "已被使用",
  UNREASONABLE_EXCHANGE: "不合理的交換要求",
  NO_RESPONSE: "持有者無回應 / 放鳥",
  ABUSIVE_MESSAGE: "不當訊息 / 騷擾",
  SCAM: "詐騙",
  OTHER: "其他",
};

type Report = {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  transaction_id: string | null;
  reporter: { display_name: string; avatar_url: string | null } | null;
  reported_user: { id: string; display_name: string; status: string } | null;
  coupon: { id: string; title: string; brand: string; status: string; report_count: number } | null;
};

type ReportDetail = {
  id: string;
  reason: string;
  description: string | null;
  offender_strikes: number;
  evidence_image_url: string | null;
  reporter: { id: string; display_name: string; contribution_score: number; created_at: string } | null;
  reported_user: {
    id: string;
    display_name: string;
    status: string;
    user_level: string;
    contribution_score: number;
    created_at: string;
    stats: {
      coupons_shared: number;
      reports_against: number;
      completed_transactions: number;
      rating_avg: number | null;
      rating_count: number;
    } | null;
  } | null;
  coupon: {
    id: string;
    title: string;
    brand: string;
    description: string | null;
    category: string | null;
    redeem_kind: string | null;
    type: string;
    exchange_target: string | null;
    status: string;
    expiry_date: string | null;
    report_count: number;
    view_count: number;
    claim_request_count: number;
    has_barcode: boolean;
    has_redeem_code: boolean;
    created_at: string;
    owner: { id: string; display_name: string } | null;
  } | null;
};

const TABS = [
  { key: "PENDING", label: "待處理" },
  { key: "RESOLVED", label: "已處置" },
  { key: "REJECTED", label: "已駁回" },
] as const;

export default function AdminReportsPage() {
  const { me, loading: meLoading } = useMe();
  const [tab, setTab] = useState<"PENDING" | "RESOLVED" | "REJECTED">("PENDING");
  const { data, loading, refetch } = useApi<{ data: Report[] }>(
    me?.is_admin ? `/api/v1/admin/reports?status=${tab}` : null,
  );
  const [acting, setActing] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: ReportAction } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function toggleDetail(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await apiFetch<ReportDetail>(`/api/v1/admin/reports/${id}`));
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

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

  // Every action opens the reason picker (preset chips + editable note); runAction
  // fires the resolve call once the admin confirms.
  async function runAction(reason: string) {
    if (!pending) return;
    const { id, action } = pending;
    setActing(id);
    try {
      await apiFetch(`/api/v1/admin/reports/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action, note: reason || undefined }),
      });
      setPending(null);
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setActing(null);
    }
  }

  // Undo a wrongful takedown straight from the report (also available on the
  // 被下架票券 page). Keyed on the coupon id for the busy state.
  async function restoreCoupon(couponId: string, title: string) {
    if (!confirm(`把「${title}」重新上架？`)) return;
    setActing(couponId);
    try {
      await apiFetch(`/api/v1/admin/coupons/${couponId}/restore`, { method: "POST" });
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setActing(null);
    }
  }

  const rows = data?.data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">檢舉複核</h1>
      <p className="mt-1 text-sm text-ink-soft">逐筆審核使用者檢舉，可駁回、記檢舉、下架票券或停權帳號。</p>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-accent text-white" : "bg-paper text-ink-soft hover:bg-sand",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : rows.length === 0 ? (
          <EmptyState
            icon="flag"
            title={tab === "PENDING" ? "待處理的檢舉都清空了" : "這個分頁目前是空的"}
            hint={
              tab === "PENDING"
                ? "處理過的檢舉不會消失，會移到上方「已處置」或「已駁回」分頁。"
                : "還沒有這個狀態的檢舉。"
            }
          />
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className="bg-danger-tint text-danger">{REASON_LABEL[r.reason] ?? r.reason}</Pill>
                <span className="text-xs text-ink-faint">{relativeTime(r.created_at)}</span>
                {r.reporter && (
                  <span className="text-xs text-ink-faint">· 檢舉人：{r.reporter.display_name}</span>
                )}
              </div>

              {r.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{r.description}</p>
              )}

              {/* Target */}
              <div className="mt-3 space-y-1.5 rounded-xl bg-canvas/60 p-3 text-sm">
                {r.coupon ? (
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/coupons/${r.coupon.id}`} className="min-w-0 truncate font-medium text-ink hover:text-accent">
                      票券：{r.coupon.brand}｜{r.coupon.title}
                    </Link>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {r.coupon.status} · 被檢舉 {r.coupon.report_count} 次
                    </span>
                  </div>
                ) : r.transaction_id ? (
                  <Link href={`/transactions/${r.transaction_id}`} className="font-medium text-ink hover:text-accent">
                    交易：{r.transaction_id.slice(0, 8)}…
                  </Link>
                ) : null}
                {r.reported_user && (
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/users/${r.reported_user.id}`} className="truncate text-ink hover:text-accent">
                      被檢舉帳號：{r.reported_user.display_name}
                    </Link>
                    <span className="shrink-0 text-xs text-ink-faint">{r.reported_user.status}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => toggleDetail(r.id)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-press"
              >
                <Icon name={expandedId === r.id ? "chevronDown" : "chevronRight"} size={13} />
                {expandedId === r.id ? "收合詳情" : "展開詳情（券內容 · 用戶歷史 · 證據）"}
              </button>
              {expandedId === r.id && <ReportDetailPanel detail={detail} loading={detailLoading} />}

              {r.admin_note && <p className="mt-2 text-xs text-ink-faint">處理備註：{r.admin_note}</p>}

              {r.status === "PENDING" || r.status === "REVIEWING" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" icon="check" loading={acting === r.id} onClick={() => setPending({ id: r.id, action: "dismiss" })}>
                    駁回（無違規）
                  </Button>
                  <Button size="sm" variant="outline" icon="flag" loading={acting === r.id} onClick={() => setPending({ id: r.id, action: "dismiss_malicious" })}>
                    判定惡意檢舉
                  </Button>
                  <Button size="sm" variant="outline" icon="shieldCheck" loading={acting === r.id} onClick={() => setPending({ id: r.id, action: "strike_user" })}>
                    記一次檢舉
                  </Button>
                  {r.coupon && (
                    <Button size="sm" variant="outline" icon="ban" loading={acting === r.id} onClick={() => setPending({ id: r.id, action: "remove_coupon" })}>
                      下架此券
                    </Button>
                  )}
                  {r.reported_user && r.reported_user.status === "ACTIVE" && (
                    <Button size="sm" variant="danger" icon="shield" loading={acting === r.id} onClick={() => setPending({ id: r.id, action: "suspend_user" })}>
                      停權帳號
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-ink-faint">
                    已{r.status === "RESOLVED" ? "處置" : "駁回"} · {r.resolved_at ? relativeTime(r.resolved_at) : ""}
                  </p>
                  {r.coupon && r.coupon.status === "SUSPENDED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon="ticket"
                      loading={acting === r.coupon.id}
                      onClick={() => restoreCoupon(r.coupon!.id, r.coupon!.title)}
                    >
                      重新上架此券
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <ReasonModal
        open={!!pending}
        title={pending ? ACTION_META[pending.action].title : ""}
        hint={pending ? ACTION_META[pending.action].hint : undefined}
        presets={pending ? ACTION_META[pending.action].presets : []}
        confirmLabel="確認送出"
        confirmVariant={pending ? ACTION_META[pending.action].variant : "primary"}
        busy={!!pending && acting === pending.id}
        onCancel={() => setPending(null)}
        onConfirm={runAction}
      />
    </div>
  );
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function ReportDetailPanel({ detail, loading }: { detail: ReportDetail | null; loading: boolean }) {
  if (loading)
    return (
      <div className="mt-2 rounded-xl bg-canvas/60 p-4 text-center text-sm text-ink-faint">載入中…</div>
    );
  if (!detail)
    return (
      <div className="mt-2 rounded-xl bg-canvas/60 p-4 text-center text-sm text-ink-faint">
        無法載入詳情
      </div>
    );
  const u = detail.reported_user;
  const c = detail.coupon;
  return (
    <div className="mt-2 space-y-3 rounded-xl border border-line bg-canvas/50 p-4 text-sm">
      {detail.offender_strikes > 0 && (
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-medium",
            detail.offender_strikes >= 2 ? "bg-danger-tint text-danger" : "bg-sand text-ink-soft",
          )}
        >
          此對象已累積 {detail.offender_strikes} 次成立檢舉（滿 3 次自動停權）
        </div>
      )}
      {c && (
        <section>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">被檢舉的券</p>
          <p className="font-medium text-ink">
            {c.brand}｜{c.title}
          </p>
          {c.description && <p className="mt-1 whitespace-pre-wrap text-ink-soft">{c.description}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-faint">
            <span>分類 {c.category ?? "—"}</span>
            <span>內容 {c.redeem_kind === "FREE_ITEM" ? "免費兌換" : c.redeem_kind === "DISCOUNT" ? "折價券" : "—"}</span>
            <span>{c.type === "GIFT" ? "贈送" : "交換"}</span>
            {c.exchange_target && <span>換：{c.exchange_target}</span>}
            <span>狀態 {c.status}</span>
            <span>到期 {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : "無期限"}</span>
            <span>瀏覽 {c.view_count}</span>
            <span>申請 {c.claim_request_count}</span>
            <span className={cn(c.report_count >= 3 && "font-bold text-danger")}>被檢舉 {c.report_count} 次</span>
            <span>{c.has_barcode ? "條碼圖" : c.has_redeem_code ? "文字兌換碼" : "無兌換內容"}</span>
          </div>
        </section>
      )}
      {u && (
        <section className="border-t border-line pt-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">被檢舉帳號歷史</p>
          <p className="font-medium text-ink">
            {u.display_name}
            <span className="ml-1.5 text-xs font-normal text-ink-faint">
              {u.status} · {u.user_level}
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-faint">
            <span>帳齡 {daysSince(u.created_at)} 天</span>
            <span>貢獻分 {u.contribution_score}</span>
            {u.stats && (
              <>
                <span>分享 {u.stats.coupons_shared} 張</span>
                <span>完成交易 {u.stats.completed_transactions}</span>
                <span className={cn(u.stats.reports_against >= 2 && "font-bold text-danger")}>
                  被 {u.stats.reports_against} 人檢舉
                </span>
                <span>
                  評價 {u.stats.rating_avg != null ? u.stats.rating_avg.toFixed(1) : "—"}（{u.stats.rating_count}）
                </span>
              </>
            )}
          </div>
        </section>
      )}
      {detail.reporter && (
        <section className="border-t border-line pt-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">檢舉人</p>
          <div className="flex flex-wrap gap-x-3 text-xs text-ink-faint">
            <span className="font-medium text-ink">{detail.reporter.display_name}</span>
            <span className={cn(daysSince(detail.reporter.created_at) < 1 && "font-bold text-danger")}>
              帳齡 {daysSince(detail.reporter.created_at)} 天
            </span>
            <span>貢獻分 {detail.reporter.contribution_score}</span>
          </div>
        </section>
      )}
      {detail.evidence_image_url && (
        <section className="border-t border-line pt-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">證據圖</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={detail.evidence_image_url}
            alt="檢舉證據"
            referrerPolicy="no-referrer"
            className="max-h-64 rounded-lg border border-line"
          />
        </section>
      )}
    </div>
  );
}
