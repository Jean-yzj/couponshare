"use client";

import { useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "@/components/CouponCard";
import {
  Button,
  Card,
  Field,
  Textarea,
  Banner,
  Avatar,
  Skeleton,
  EmptyState,
  NeedLogin,
  Pill,
} from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Owner = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_level: string;
  level_name: string;
  contribution_score: number;
};
type Applied = {
  id: string;
  status: string;
  request_type: string;
  message: string;
  created_at: string;
  coupon: FeedCoupon;
};
type Txn = {
  id: string;
  coupon: { id: string; title: string; brand: string } | null;
  owner: Owner | null;
  claimant: Owner | null;
  transaction_type: string;
  status: string;
  role?: string;
  rated_by_viewer?: boolean;
  completed_at: string | null;
  created_at: string;
};
type Wallet = {
  listed: FeedCoupon[];
  applied: Applied[];
  received: FeedCoupon[];
  transactions: Txn[];
};

const TABS = [
  { key: "listed", label: "我上架的" },
  { key: "applied", label: "我申請的" },
  { key: "received", label: "我領取的" },
  { key: "expired", label: "已過期" },
  { key: "cancelled", label: "已取消" },
  { key: "tx", label: "交易紀錄" },
] as const;

const CR_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "申請中", cls: "bg-gold-tint text-gold" },
  APPROVED: { label: "已獲得", cls: "bg-pine-tint text-pine" },
  REJECTED: { label: "未獲選", cls: "bg-sand text-ink-faint" },
  EXPIRED: { label: "已過期", cls: "bg-sand text-ink-faint" },
  CANCELLED: { label: "已取消", cls: "bg-sand text-ink-faint" },
};

export default function WalletPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<Wallet>(me ? "/api/v1/me/wallet" : null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("listed");
  const [ratingTxn, setRatingTxn] = useState<Txn | null>(null);

  if (meLoading)
    return (
      <div className="flex justify-center py-20">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可管理你上架、申請與領取的票券。" />;

  const listedActive = data?.listed.filter((c) => !["EXPIRED", "CANCELLED"].includes(c.status)) ?? [];
  const expired = data?.listed.filter((c) => c.status === "EXPIRED") ?? [];
  const cancelled = data?.listed.filter((c) => c.status === "CANCELLED") ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">我的錢包</h1>
      <p className="mt-1.5 text-sm text-ink-soft">管理你分享、申請與領取的所有票券。</p>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-ink text-canvas" : "bg-paper text-ink-soft hover:bg-sand/70",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : tab === "listed" ? (
          <CouponGrid
            items={listedActive}
            empty="你還沒有上架任何票券"
            hint="把用不到的優惠券分享出去吧。"
            cta
          />
        ) : tab === "applied" ? (
          data && data.applied.length > 0 ? (
            <div className="space-y-3">
              {data.applied.map((a) => (
                <a key={a.id} href={`/coupons/${a.coupon.id}`} className="block">
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:border-sand-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-faint">
                          {a.coupon.brand}
                        </span>
                        <Pill className={CR_STATUS[a.status]?.cls ?? "bg-sand text-ink-soft"}>
                          {CR_STATUS[a.status]?.label ?? a.status}
                        </Pill>
                      </div>
                      <p className="mt-1 truncate font-medium text-ink">{a.coupon.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-faint">
                        {relativeTime(a.created_at)} 申請
                      </p>
                    </div>
                    <Icon name="chevronRight" size={18} className="shrink-0 text-ink-faint" />
                  </Card>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState icon="send" title="還沒有申請紀錄" hint="去探索頁找找喜歡的票券吧。" action={<Button href="/" variant="outline">前往探索</Button>} />
          )
        ) : tab === "received" ? (
          <CouponGrid items={data?.received ?? []} empty="還沒有成功領取的票券" hint="被持有者選中後就會出現在這裡。" />
        ) : tab === "expired" ? (
          <CouponGrid items={expired} empty="沒有已過期的票券" />
        ) : tab === "cancelled" ? (
          <CouponGrid items={cancelled} empty="沒有已取消的票券" />
        ) : (
          <TransactionList
            txns={data?.transactions ?? []}
            meId={me.id}
            onRate={(t) => setRatingTxn(t)}
          />
        )}
      </div>

      <RatingModal
        txn={ratingTxn}
        onClose={() => setRatingTxn(null)}
        onDone={() => {
          setRatingTxn(null);
          refetch();
        }}
      />
    </div>
  );
}

function CouponGrid({
  items,
  empty,
  hint,
  cta,
}: {
  items: FeedCoupon[];
  empty: string;
  hint?: string;
  cta?: boolean;
}) {
  if (items.length === 0)
    return (
      <EmptyState
        icon="ticket"
        title={empty}
        hint={hint}
        action={cta ? <Button href="/new" icon="plus">新增優惠券</Button> : undefined}
      />
    );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((c) => (
        <CouponCard key={c.id} c={c} />
      ))}
    </div>
  );
}

function TransactionList({
  txns,
  meId,
  onRate,
}: {
  txns: Txn[];
  meId: string;
  onRate: (t: Txn) => void;
}) {
  if (txns.length === 0)
    return <EmptyState icon="swap" title="還沒有交易紀錄" hint="完成第一筆贈送或交換後就會出現在這裡。" />;
  return (
    <div className="space-y-3">
      {txns.map((t) => {
        const counterpart = t.role === "owner" ? t.claimant : t.owner;
        const completed = t.status === "COMPLETED";
        return (
          <Card key={t.id} className="p-4">
            <div className="flex items-center gap-3">
              {counterpart && <Avatar name={counterpart.display_name} url={counterpart.avatar_url} size={40} />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{t.coupon?.title ?? "票券"}</p>
                <p className="truncate text-xs text-ink-faint">
                  {t.role === "owner" ? "贈出給" : "領取自"} {counterpart?.display_name ?? "—"} ·{" "}
                  {relativeTime(t.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusTxn status={t.status} />
                {completed && !t.rated_by_viewer && counterpart && (
                  <Button size="sm" variant="outline" icon="star" onClick={() => onRate(t)}>
                    評價
                  </Button>
                )}
                {completed && t.rated_by_viewer && (
                  <span className="text-xs text-ink-faint">已評價</span>
                )}
                {!completed && t.role && (
                  <CompleteButton txnId={t.id} />
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function StatusTxn({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    CREATED: { label: "進行中", cls: "bg-gold-tint text-gold" },
    COMPLETED: { label: "已完成", cls: "bg-pine-tint text-pine" },
    DISPUTED: { label: "爭議中", cls: "bg-accent-tint text-accent-press" },
    CANCELLED: { label: "已取消", cls: "bg-sand text-ink-faint" },
  };
  const m = map[status] ?? { label: status, cls: "bg-sand text-ink-soft" };
  return <Pill className={m.cls}>{m.label}</Pill>;
}

function CompleteButton({ txnId }: { txnId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function complete() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/transactions/${txnId}/complete`, { method: "POST" });
      setDone(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  if (done) return <span className="text-xs text-pine">已確認</span>;
  return (
    <Button size="sm" variant="ghost" loading={busy} onClick={complete}>
      確認完成
    </Button>
  );
}

const TAG_PRESETS = ["回覆速度快", "人很好", "票券有效", "乾脆爽快", "會再交易"];

function RatingModal({
  txn,
  onClose,
  onDone,
}: {
  txn: Txn | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [score, setScore] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!txn) return null;
  const counterpart = txn.role === "owner" ? txn.claimant : txn.owner;

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit() {
    if (!counterpart) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/transactions/${txn!.id}/ratings`, {
        method: "POST",
        body: JSON.stringify({
          to_user_id: counterpart.id,
          rating_score: score,
          tags,
          comment: comment.trim() || null,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "送出失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!txn}
      onClose={onClose}
      title={`評價 ${counterpart?.display_name ?? ""}`}
      footer={
        <Button full icon="star" loading={busy} onClick={submit}>
          送出評價
        </Button>
      }
    >
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setScore(n)} aria-label={`${n} 星`}>
            <Icon
              name="star"
              size={34}
              className={cn(
                "transition-colors",
                n <= score ? "fill-gold text-gold" : "text-line",
              )}
            />
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-sm text-ink-soft">
        {score >= 4 ? "很棒的體驗！" : score === 3 ? "還不錯" : "可以更好"}
      </p>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-ink">給個標籤（可複選）</p>
        <div className="flex flex-wrap gap-2">
          {TAG_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                tags.includes(t)
                  ? "border-accent bg-accent-tint text-accent-press"
                  : "border-line bg-paper text-ink-soft hover:bg-canvas-2",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Field label="留言（選填）">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="謝謝分享，使用很順利！"
          />
        </Field>
      </div>
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
