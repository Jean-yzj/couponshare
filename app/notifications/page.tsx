"use client";

import { useRouter } from "next/navigation";
import { apiFetch, useApi, useMe } from "@/lib/client";
import { Card, Button, Skeleton, EmptyState, NeedLogin, PageHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
};

const NOTIF_ICON: Record<string, IconName> = {
  CLAIM_REQUEST_RECEIVED: "user",
  CLAIM_APPROVED: "gift",
  CLAIM_REJECTED: "x",
  COUPON_EXPIRING_SOON: "clock",
  COUPON_EXPIRED: "clock",
  TRANSACTION_COMPLETED: "swap",
  TRANSACTION_MESSAGE: "send",
  RATING_RECEIVED: "star",
  REPORT_UPDATED: "flag",
  BRAND_RESTOCK: "bell",
  APPEAL_UPDATED: "shield",
  BUSINESS_LEAD_RECEIVED: "user",
};

export default function NotificationsPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  // Unconditional: parallel with the session check (endpoint enforces auth itself).
  const { data, loading, refetch } = useApi<{ data: Notif[]; unread_count: number }>(
    "/api/v1/notifications",
  );

  if (meLoading)
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可查看你的通知。" />;

  async function open(n: Notif) {
    if (!n.is_read) {
      await apiFetch(`/api/v1/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
      refetch();
    }
    if (n.reference_type === "coupon" && n.reference_id) router.push(`/coupons/${n.reference_id}`);
    // Exchange messages / handover updates live on the transaction page (chat +
    // 條碼/確認 flow), so deep-link straight to it — /wallet was a dead end here.
    else if (n.reference_type === "transaction" && n.reference_id)
      router.push(`/transactions/${n.reference_id}`);
    else if (n.reference_type === "transaction") router.push("/wallet");
    else if (n.reference_type === "appeal") router.push("/appeal");
    else if (n.reference_type === "business_lead") router.push("/admin/business-leads");
  }

  async function markAll() {
    await apiFetch("/api/v1/notifications/read-all", { method: "POST" }).catch(() => {});
    refetch();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Notifications"
        title="通知中心"
        action={
          (data?.unread_count ?? 0) > 0 ? (
            <Button size="sm" variant="ghost" icon="check" onClick={markAll}>
              全部已讀
            </Button>
          ) : null
        }
      />

      <div className="mt-5 space-y-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon="bell" title="目前沒有通知" hint="有人申請或回應你的票券時，會在這裡通知你。" />
        ) : (
          data.data.map((n) => (
            <button key={n.id} onClick={() => open(n)} className="block w-full text-left">
              <Card
                className={cn(
                  "flex items-start gap-3 p-4 transition-colors hover:border-sand-2",
                  !n.is_read && "border-accent/30 bg-accent-tint/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    n.is_read ? "bg-sand text-ink-soft" : "bg-accent text-white",
                  )}
                >
                  <Icon name={NOTIF_ICON[n.type] ?? "bell"} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-ink">{n.title}</p>
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-faint">{relativeTime(n.created_at)}</p>
                </div>
              </Card>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
