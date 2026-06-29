"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import {
  Button,
  Card,
  Field,
  Textarea,
  Select,
  Banner,
  Avatar,
  StatusPill,
  TypePill,
  LevelBadge,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { Modal } from "@/components/Modal";
import { BarcodeModal } from "@/components/BarcodeModal";
import { Icon } from "@/components/icons";
import { cn, expiryText, formatDate, relativeTime, STATUS_META } from "@/lib/display";

type Owner = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_level: string;
  level_name: string;
  contribution_score: number;
};

type Detail = {
  id: string;
  title: string;
  brand: string;
  description: string | null;
  type: string;
  exchange_target: string | null;
  expiry_date: string;
  status: string;
  visibility_level: string;
  view_count: number;
  claim_request_count: number;
  has_barcode: boolean;
  can_view_barcode: boolean;
  is_owner: boolean;
  is_claimant: boolean;
  claimed_at: string | null;
  created_at: string;
  owner: Owner | null;
};

type CR = {
  id: string;
  requester: Owner | null;
  request_type: string;
  message: string;
  exchange_offer_text: string | null;
  status: string;
  owner_response_message: string | null;
  created_at: string;
};

const UNAVAILABLE_MSG: Record<string, string> = {
  CLAIMED: "這張票券已經送給其他人了",
  EXPIRED: "這張票券已過期",
  CANCELLED: "持有者已將這張票券下架",
  PENDING: "這張票券正在處理中",
  REPORTED: "此票券因檢舉暫時無法申請",
  SUSPENDED: "此票券已被暫停顯示",
  DRAFT: "這張票券尚未上架",
};

export default function CouponDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const { data: coupon, loading, refetch } = useApi<Detail>(`/api/v1/coupons/${id}`);
  const reqs = useApi<{ data: CR[] }>(coupon?.is_owner ? `/api/v1/coupons/${id}/claim-requests` : null);

  const [claimOpen, setClaimOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <DetailSkeleton />;
  if (!coupon) {
    return (
      <div className="py-10">
        <EmptyState icon="ticket" title="找不到這張票券" hint="它可能已被刪除或下架。" action={<Button href="/" variant="outline">回到探索</Button>} />
      </div>
    );
  }

  const exp = expiryText(coupon.expiry_date);
  const isExpired = new Date(coupon.expiry_date).getTime() <= Date.now();
  const canClaim = !coupon.is_owner && coupon.status === "AVAILABLE" && !isExpired;
  const canCancel =
    coupon.is_owner && ["DRAFT", "AVAILABLE", "PENDING", "REPORTED", "SUSPENDED"].includes(coupon.status);

  async function act(crId: string, action: "approve" | "reject") {
    setActingId(crId);
    try {
      await apiFetch(`/api/v1/claim-requests/${crId}/${action}`, {
        method: "POST",
        body: action === "reject" ? JSON.stringify({ reason: "" }) : undefined,
      });
      await Promise.all([refetch(), reqs.refetch()]);
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setActingId(null);
    }
  }

  async function cancelCoupon() {
    if (!confirm("確定要下架這張優惠券嗎？")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/coupons/${id}/cancel`, { method: "POST" });
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  const railTint = coupon.type === "GIFT" ? "from-pine/12" : "from-teal/12";

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} />
        返回
      </button>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className={cn("bg-gradient-to-br to-transparent px-5 pt-5 pb-4", railTint)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{coupon.brand}</p>
              <h1 className="mt-1 text-2xl font-bold leading-snug tracking-tight text-ink">{coupon.title}</h1>
            </div>
            <StatusPill status={coupon.status} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TypePill type={coupon.type} />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-paper/70 px-2.5 py-1 text-xs font-medium",
                exp.urgent ? "text-accent-press" : "text-ink-soft",
              )}
            >
              <Icon name="clock" size={13} />
              {exp.text}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-paper/70 px-2.5 py-1 text-xs font-medium text-ink-soft">
              <Icon name="eye" size={13} />
              {coupon.view_count} 次瀏覽
            </span>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {coupon.description && (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
              {coupon.description}
            </p>
          )}
          {coupon.type === "EXCHANGE" && coupon.exchange_target && (
            <Banner tone="info" icon="swap">
              持有者想交換：<span className="font-medium">{coupon.exchange_target}</span>
            </Banner>
          )}

          {/* Owner */}
          {coupon.owner && (
            <div className="flex items-center gap-3 rounded-xl bg-canvas/60 p-3">
              <Avatar name={coupon.owner.display_name} url={coupon.owner.avatar_url} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{coupon.owner.display_name}</p>
                <p className="text-xs text-ink-faint">分享於 {formatDate(coupon.created_at)}</p>
              </div>
              <LevelBadge level={coupon.owner.user_level} />
            </div>
          )}
        </div>
      </Card>

      {/* Claimant: success + barcode */}
      {coupon.is_claimant && coupon.status === "CLAIMED" && (
        <Card className="mt-4 p-5">
          <div className="flex items-center gap-2 text-pine">
            <Icon name="shieldCheck" size={20} />
            <p className="font-semibold">你已成功領取這張票券</p>
          </div>
          <p className="mt-1 text-sm text-ink-soft">條碼僅供你本人兌換，請勿轉傳。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon="ticket" onClick={() => setBarcodeOpen(true)}>
              查看條碼
            </Button>
            <Button variant="outline" href="/wallet" icon="wallet">
              前往我的錢包評價
            </Button>
          </div>
        </Card>
      )}

      {/* Owner: actions + applicants */}
      {coupon.is_owner ? (
        <div className="mt-4 space-y-4">
          <Card className="flex flex-wrap items-center gap-2 p-4">
            {coupon.has_barcode && (
              <Button variant="outline" icon="eye" onClick={() => setBarcodeOpen(true)}>
                查看我的條碼
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" icon="ban" loading={busy} onClick={cancelCoupon}>
                下架票券
              </Button>
            )}
          </Card>

          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-semibold text-ink">申請列表</h2>
              <span className="text-sm text-ink-faint">
                {reqs.data?.data.length ?? 0} 筆申請
              </span>
            </div>
            {reqs.loading ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : !reqs.data || reqs.data.data.length === 0 ? (
              <EmptyState icon="user" title="還沒有人申請" hint="分享出去，讓更多人看到這張票券吧。" />
            ) : (
              <div className="space-y-2.5">
                {reqs.data.data.map((r) => (
                  <RequestRow
                    key={r.id}
                    r={r}
                    actionable={["AVAILABLE", "PENDING"].includes(coupon.status)}
                    acting={actingId === r.id}
                    onApprove={() => act(r.id, "approve")}
                    onReject={() => act(r.id, "reject")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Visitor / claimant actions */
        <div className="mt-4">
          {canClaim ? (
            <Card className="p-4">
              {me ? (
                <Button
                  full
                  size="lg"
                  icon={coupon.type === "GIFT" ? "gift" : "swap"}
                  onClick={() => setClaimOpen(true)}
                >
                  {coupon.type === "GIFT" ? "我要領取" : "我要交換"}
                </Button>
              ) : (
                <Button full size="lg" icon="login" href="/login">
                  登入後申請領取
                </Button>
              )}
              <p className="mt-2 text-center text-xs text-ink-faint">
                送出申請不代表已取得票券，需由持有者選擇。
              </p>
            </Card>
          ) : (
            !coupon.is_claimant && (
              <Banner tone="warn" icon="info">
                {UNAVAILABLE_MSG[coupon.status] ?? "此票券目前無法申請"}
              </Banner>
            )
          )}

          {me && !coupon.is_owner && (
            <button
              onClick={() => setReportOpen(true)}
              className="mx-auto mt-4 flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-accent-press"
            >
              <Icon name="flag" size={15} />
              檢舉這張票券
            </button>
          )}
        </div>
      )}

      <ClaimModal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        couponId={coupon.id}
        type={coupon.type}
        onDone={() => {
          setClaimOpen(false);
          refetch();
        }}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        couponId={coupon.id}
        onDone={() => setReportOpen(false)}
      />
      <BarcodeModal couponId={coupon.id} open={barcodeOpen} onClose={() => setBarcodeOpen(false)} />
    </div>
  );
}

function RequestRow({
  r,
  actionable,
  acting,
  onApprove,
  onReject,
}: {
  r: CR;
  actionable: boolean;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = r.status === "PENDING";
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {r.requester && <Avatar name={r.requester.display_name} url={r.requester.avatar_url} size={40} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-ink">{r.requester?.display_name ?? "—"}</p>
            {r.requester && <LevelBadge level={r.requester.user_level} />}
            {!pending && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_META[r.status === "APPROVED" ? "CLAIMED" : "CANCELLED"]?.cls,
                )}
              >
                {r.status === "APPROVED" ? "已選擇" : r.status === "REJECTED" ? "未選擇" : r.status}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {r.requester?.contribution_score ?? 0} 貢獻分 · {relativeTime(r.created_at)}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{r.message}</p>
          {r.exchange_offer_text && (
            <p className="mt-1.5 rounded-lg bg-teal-tint/60 px-2.5 py-1.5 text-xs text-teal">
              交換提案：{r.exchange_offer_text}
            </p>
          )}
          {pending && actionable && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" icon="check" loading={acting} onClick={onApprove}>
                選擇 TA
              </Button>
              <Button size="sm" variant="ghost" loading={acting} onClick={onReject}>
                婉拒
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ClaimModal({
  open,
  onClose,
  couponId,
  type,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  couponId: string;
  type: string;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("");
  const [offer, setOffer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/coupons/${couponId}/claim-requests`, {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          request_type: type,
          exchange_offer_text: type === "EXCHANGE" ? offer.trim() : null,
        }),
      });
      setMessage("");
      setOffer("");
      onDone();
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "送出失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={type === "GIFT" ? "申請領取" : "申請交換"}
      footer={
        <Button full loading={busy} icon="send" onClick={submit} disabled={!message.trim()}>
          送出申請
        </Button>
      }
    >
      <Field label="給持有者的留言" required hint="真誠的留言更容易被選中">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="您好，我剛好需要這張券，會好好珍惜，謝謝你！"
        />
      </Field>
      {type === "EXCHANGE" && (
        <div className="mt-4">
          <Field label="你想用什麼交換？" required>
            <Textarea
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="例如：我有一張全家中杯咖啡，可以跟你交換"
            />
          </Field>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Banner tone="warn" icon="info">
            {error}
          </Banner>
        </div>
      )}
    </Modal>
  );
}

const REPORT_REASONS = [
  { value: "INVALID_COUPON", label: "無效券" },
  { value: "EXPIRED_COUPON", label: "已過期" },
  { value: "ALREADY_USED", label: "已被使用" },
  { value: "NO_RESPONSE", label: "持有者無回應 / 放鳥" },
  { value: "ABUSIVE_MESSAGE", label: "不當訊息" },
  { value: "SCAM", label: "詐騙" },
  { value: "OTHER", label: "其他" },
];

function ReportModal({
  open,
  onClose,
  couponId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  couponId: string;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("INVALID_COUPON");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({ coupon_id: couponId, reason, description: description.trim() || null }),
      });
      setDone(true);
      setTimeout(onDone, 1200);
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "檢舉失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="檢舉票券"
      footer={
        !done && (
          <Button full variant="danger" loading={busy} icon="flag" onClick={submit}>
            送出檢舉
          </Button>
        )
      }
    >
      {done ? (
        <div className="py-6 text-center">
          <Icon name="check" size={32} className="mx-auto text-pine" />
          <p className="mt-2 font-medium text-ink">已收到你的檢舉</p>
          <p className="text-sm text-ink-soft">我們會盡快處理，謝謝你維護社群。</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="檢舉原因" required>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="補充說明">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：到店使用時顯示已被兌換"
            />
          </Field>
          {error && <Banner tone="warn" icon="info">{error}</Banner>}
        </div>
      )}
    </Modal>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="mb-4 h-5 w-16" />
      <Skeleton className="h-52 rounded-2xl" />
      <Skeleton className="mt-4 h-24 rounded-2xl" />
    </div>
  );
}
