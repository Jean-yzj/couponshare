"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, ApiErr, useApi, useMe } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "@/components/CouponCard";
import { Button, Card, Avatar, Skeleton, EmptyState, NeedLogin, Pill, PageHeader, LoadFailed } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Party = {
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
  owner: Party | null;
  claimant: Party | null;
  transaction_type: string;
  status: string;
  role?: string;
  rated_by_viewer?: boolean;
  created_at: string;
};
type Wallet = {
  listed: FeedCoupon[];
  applied: Applied[];
  received: FeedCoupon[];
  transactions: Txn[];
};

const TABS = [
  { key: "tx", label: "交易紀錄" },
  { key: "listed", label: "我上架的" },
  { key: "applied", label: "我申請的" },
  { key: "received", label: "我領取的" },
  { key: "expired", label: "已過期" },
  { key: "cancelled", label: "已取消" },
] as const;

const CR_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "申請中", cls: "bg-gold-tint text-gold" },
  APPROVED: { label: "已獲得", cls: "bg-pine-tint text-pine" },
  REJECTED: { label: "未獲選", cls: "bg-sand text-ink-faint" },
  EXPIRED: { label: "已過期", cls: "bg-sand text-ink-faint" },
  CANCELLED: { label: "已取消", cls: "bg-sand text-ink-faint" },
};

const TX_STATUS: Record<string, { label: string; cls: string }> = {
  CREATED: { label: "進行中", cls: "bg-gold-tint text-gold" },
  COMPLETED: { label: "已完成", cls: "bg-pine-tint text-pine" },
  DISPUTED: { label: "爭議中", cls: "bg-danger-tint text-danger" },
  CANCELLED: { label: "已取消", cls: "bg-sand text-ink-faint" },
};

export default function WalletPage() {
  const { me, loading: meLoading } = useMe();
  // Unconditional: parallel with the session check (endpoint enforces auth itself).
  const { data, loading, error, refetch } = useApi<Wallet>("/api/v1/me/wallet");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("tx");
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function cancelApplication(id: string) {
    if (!confirm("確定要取消這筆申請嗎？")) return;
    setCancelling(id);
    try {
      await apiFetch(`/api/v1/claim-requests/${id}/cancel`, { method: "POST" });
      refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "取消失敗");
    } finally {
      setCancelling(null);
    }
  }

  if (meLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-10 rounded-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可管理你上架、申請與領取的票券。" />;
  if (error && !data) return <LoadFailed onRetry={refetch} />;

  const listedActive = data?.listed.filter((c) => !["EXPIRED", "CANCELLED"].includes(c.status)) ?? [];
  const expired = data?.listed.filter((c) => c.status === "EXPIRED") ?? [];
  const cancelled = data?.listed.filter((c) => c.status === "CANCELLED") ?? [];

  return (
    <div>
      <PageHeader eyebrow="My wallet" title="我的錢包" subtitle="管理你分享、申請與領取的所有票券。" />

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

      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : tab === "listed" ? (
          <CouponGrid items={listedActive} empty="你還沒有上架任何票券" hint="把用不到的優惠券分享出去吧。" cta />
        ) : tab === "applied" ? (
          data && data.applied.length > 0 ? (
            <div className="space-y-3">
              {data.applied.map((a) => (
                <Link key={a.id} href={`/coupons/${a.coupon.id}`} className="block">
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
                    {a.status === "PENDING" ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelApplication(a.id);
                        }}
                        disabled={cancelling === a.id}
                        className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
                      >
                        {cancelling === a.id ? "取消中…" : "取消申請"}
                      </button>
                    ) : (
                      <Icon name="chevronRight" size={18} className="shrink-0 text-ink-faint" />
                    )}
                  </Card>
                </Link>
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
          <TransactionList txns={data?.transactions ?? []} />
        )}
      </div>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((c) => (
        <CouponCard key={c.id} c={c} />
      ))}
    </div>
  );
}

function TransactionList({ txns }: { txns: Txn[] }) {
  if (txns.length === 0)
    return <EmptyState icon="swap" title="還沒有交易紀錄" hint="完成第一筆贈送或交換後就會出現在這裡。" />;
  return (
    <div className="space-y-3">
      {txns.map((t) => {
        const counterpart = t.role === "owner" ? t.claimant : t.owner;
        const st = TX_STATUS[t.status] ?? { label: t.status, cls: "bg-sand text-ink-soft" };
        const needsAction = t.status === "COMPLETED" && !t.rated_by_viewer;
        return (
          <Link key={t.id} href={`/transactions/${t.id}`} className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:border-sand-2">
              {counterpart && <Avatar name={counterpart.display_name} url={counterpart.avatar_url} size={40} />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{t.coupon?.title ?? "票券"}</p>
                <p className="truncate text-xs text-ink-faint">
                  {t.role === "owner" ? "贈出給" : "領取自"} {counterpart?.display_name ?? "—"} ·{" "}
                  {relativeTime(t.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Pill className={st.cls}>{st.label}</Pill>
                {needsAction && <span className="text-xs font-medium text-accent">待評價</span>}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
