"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import {
  Button,
  Card,
  Field,
  Textarea,
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
import { ReportModal } from "@/components/ReportModal";
import { Icon } from "@/components/icons";
import { cn, expiryText, formatDate, relativeTime, STATUS_META } from "@/lib/display";
import { categoryStyle } from "@/lib/categories";

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
  category?: string | null;
  description: string | null;
  type: string;
  exchange_target: string | null;
  expiry_date: string | null;
  status: string;
  visibility_level: string;
  view_count: number;
  claim_request_count: number;
  has_barcode: boolean;
  can_view_barcode: boolean;
  is_owner: boolean;
  is_claimant: boolean;
  my_request_status: string | null;
  my_request_id: string | null;
  claimed_at: string | null;
  created_at: string;
  owner: Owner | null;
  owner_rating?: { avg: number | null; count: number };
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
  const { me, refetch: refetchMe } = useMe();
  const { data: coupon, loading, refetch } = useApi<Detail>(`/api/v1/coupons/${id}`);
  const reqs = useApi<{ data: CR[] }>(coupon?.is_owner ? `/api/v1/coupons/${id}/claim-requests` : null);

  const [claimOpen, setClaimOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const brandsApi = useApi<{ brands: string[] }>(me ? "/api/v1/me/brands" : null);

  // Warm the barcode image cache the moment the page loads so "出示我的票券"
  // opens with no wait (the image route serves it in a single cookie-auth hop).
  const canViewBarcode = coupon?.can_view_barcode;
  const couponId = coupon?.id;
  useEffect(() => {
    if (canViewBarcode && couponId) {
      const img = new window.Image();
      img.src = `/api/v1/coupons/${couponId}/barcode/image`;
    }
  }, [canViewBarcode, couponId]);

  if (loading) return <DetailSkeleton />;
  if (!coupon) {
    return (
      <div className="py-10">
        <EmptyState icon="ticket" title="找不到這張票券" hint="它可能已被刪除或下架。" action={<Button href="/" variant="outline">回到探索</Button>} />
      </div>
    );
  }

  const exp = expiryText(coupon.expiry_date);
  const isExpired = !!coupon.expiry_date && new Date(coupon.expiry_date).getTime() <= Date.now();
  const canClaim = !coupon.is_owner && coupon.status === "AVAILABLE" && !isExpired;
  const hasPendingRequest = coupon.my_request_status === "PENDING";
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
    const willPenalize = coupon?.status === "AVAILABLE" || coupon?.status === "PENDING";
    const msg = willPenalize
      ? "這張票券已上架但還沒送出，下架會扣 5 貢獻分。確定要下架嗎？"
      : "確定要下架這張優惠券嗎？";
    if (!confirm(msg)) return;
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

  async function cancelMyRequest() {
    if (!coupon?.my_request_id) return;
    if (!confirm("確定要取消這筆申請嗎？取消後這張券會回到可申請狀態。")) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/v1/claim-requests/${coupon.my_request_id}/cancel`, { method: "POST" });
      await Promise.all([refetch(), refetchMe()]);
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "取消失敗");
    } finally {
      setCancelling(false);
    }
  }

  const isFollowing = !!brandsApi.data?.brands.some(
    (b) => b.toLowerCase() === coupon.brand.toLowerCase(),
  );
  const brandName = coupon.brand;
  async function toggleFollow() {
    await apiFetch(`/api/v1/brands/${isFollowing ? "unfollow" : "follow"}`, {
      method: "POST",
      body: JSON.stringify({ brand: brandName }),
    }).catch(() => {});
    brandsApi.refetch();
  }

  const cs = categoryStyle(coupon.category);

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
        <div className="border-b border-line px-5 pt-5 pb-4" style={{ backgroundColor: cs.tint }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-soft"
                style={{ backgroundImage: cs.grad, textShadow: "0 1px 1px rgba(0,0,0,.22)" }}
              >
                {coupon.brand.trim()[0] ?? "?"}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-accent">{coupon.brand}</p>
                <h1 className="mt-0.5 text-2xl font-extrabold leading-snug tracking-tight text-ink">
                  {coupon.title}
                </h1>
              </div>
            </div>
            <StatusPill status={coupon.status} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TypePill type={coupon.type} />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-paper/70 px-2.5 py-1 text-xs font-medium",
                exp.urgent ? "text-danger" : "text-ink-soft",
              )}
            >
              <Icon name="clock" size={13} />
              {exp.text}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-paper/70 px-2.5 py-1 text-xs font-medium text-ink-soft">
              <Icon name="eye" size={13} />
              {coupon.view_count} 次瀏覽
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-paper/70 px-2.5 py-1 text-xs font-medium text-ink-soft">
              <Icon name="users" size={13} />
              {coupon.claim_request_count} 人申請
            </span>
            {me && (
              <button
                onClick={toggleFollow}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  isFollowing
                    ? "bg-accent text-white"
                    : "bg-paper/70 text-ink-soft hover:text-accent",
                )}
              >
                <Icon name="bell" size={13} />
                {isFollowing ? "已追蹤品牌" : `追蹤 ${coupon.brand}`}
              </button>
            )}
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
            <Link
              href={`/users/${coupon.owner.id}`}
              className="flex items-center gap-3 rounded-xl bg-canvas/60 p-3 transition-colors hover:bg-canvas-2"
            >
              <Avatar name={coupon.owner.display_name} url={coupon.owner.avatar_url} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{coupon.owner.display_name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                  {coupon.owner_rating && coupon.owner_rating.count > 0 ? (
                    <span className="inline-flex items-center gap-0.5 font-medium text-gold">
                      <Icon name="star" size={12} className="fill-gold" />
                      {coupon.owner_rating.avg?.toFixed(1)}
                      <span className="font-normal text-ink-faint">（{coupon.owner_rating.count}）</span>
                    </span>
                  ) : (
                    <span>尚無評價</span>
                  )}
                  · 分享於 {formatDate(coupon.created_at)}
                </p>
              </div>
              <LevelBadge level={coupon.owner.user_level} />
              <Icon name="chevronRight" size={16} className="text-ink-faint" />
            </Link>
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
          <p className="mt-1 text-sm text-ink-soft">
            {coupon.type === "GIFT"
              ? "這張券已經是你的了，結帳時出示畫面即可，也可以截圖保存。"
              : "條碼僅供你本人兌換，請勿轉傳。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon="ticket" onClick={() => setBarcodeOpen(true)}>
              {coupon.type === "GIFT" ? "出示我的票券" : "查看條碼"}
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
            {["DRAFT", "AVAILABLE", "PENDING"].includes(coupon.status) && (
              <Button variant="outline" icon="edit" href={`/coupons/${coupon.id}/edit`}>
                編輯資料
              </Button>
            )}
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
          {hasPendingRequest ? (
            <Card className="p-5">
              <div className="flex items-center gap-2 text-gold-ink">
                <Icon name="hourglass" size={20} />
                <p className="font-semibold">已送出申請，等待持有者選擇</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                持有者會親手挑選領取者。被選中後你會收到通知，票券也會出現在「我的錢包 · 我領取的」。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" icon="ban" loading={cancelling} onClick={cancelMyRequest}>
                  取消申請
                </Button>
                <Button variant="outline" href="/wallet" icon="wallet">
                  查看我的申請
                </Button>
              </div>
            </Card>
          ) : canClaim ? (
            <Card className="p-4">
              {!me ? (
                <Button full size="lg" icon="login" href="/login">
                  登入後申請領取
                </Button>
              ) : (me.apply_remaining ?? 1) <= 0 ? (
                <div className="text-center">
                  <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-grad-brand text-white shadow-glow">
                    <Icon name="gift" size={24} />
                  </span>
                  <p className="font-bold text-ink">
                    {me.has_shared ? "今日申請額度已用完" : "先分享一張券，再繼續申請"}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
                    {me.has_shared
                      ? "分享一張你用不到的券，就能立即再獲得 3 次申請機會。"
                      : "你已用完前 3 次體驗申請。分享一張自己用不到的券，之後就能依等級每天申請，額度用完再分享還能 +3 次。"}
                  </p>
                  <Button full size="lg" icon="plus" href="/new" className="mt-4">
                    {me.has_shared ? "分享一張券，+3 次申請" : "分享一張券"}
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    full
                    size="lg"
                    icon={coupon.type === "GIFT" ? "gift" : "swap"}
                    onClick={() => setClaimOpen(true)}
                  >
                    {coupon.type === "GIFT" ? "我要領取" : "我要交換"}
                  </Button>
                  <p className="mt-2 text-center text-xs text-ink-faint">
                    送出申請不代表已取得票券，需由持有者選擇。
                  </p>
                  {me.apply_remaining !== undefined && (
                    <p className="mt-1.5 text-center text-xs font-medium text-ink-faint">
                      {me.has_shared
                        ? `今天還可以申請 ${me.apply_remaining} 張`
                        : `體驗期還可以申請 ${me.apply_remaining} 次，分享一張券後改為每日 ${me.apply_base ?? 5} 張`}
                    </p>
                  )}
                </>
              )}
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
          refetchMe();
        }}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        couponId={coupon.id}
        onDone={() => setReportOpen(false)}
      />
      <BarcodeModal
        couponId={coupon.id}
        owned={coupon.is_owner || coupon.type === "GIFT"}
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
      />
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
        {r.requester && (
          <Link href={`/users/${r.requester.id}`}>
            <Avatar name={r.requester.display_name} url={r.requester.avatar_url} size={40} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {r.requester ? (
              <Link
                href={`/users/${r.requester.id}`}
                className="truncate font-medium text-ink transition-colors hover:text-accent"
              >
                {r.requester.display_name}
              </Link>
            ) : (
              <p className="truncate font-medium text-ink">—</p>
            )}
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

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="mb-4 h-5 w-16" />
      <Skeleton className="h-52 rounded-2xl" />
      <Skeleton className="mt-4 h-24 rounded-2xl" />
    </div>
  );
}
