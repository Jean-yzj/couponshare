"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Skeleton, EmptyState, NeedLogin, Eyebrow, Pill } from "@/components/ui";
import { relativeTime } from "@/lib/display";

type RemovedCoupon = {
  id: string;
  title: string;
  brand: string;
  type: string;
  category: string | null;
  status: string;
  report_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  owner: { id: string; display_name: string } | null;
};

const TYPE_LABEL: Record<string, string> = { GIFT: "免費贈送", EXCHANGE: "交換" };

export default function AdminRemovedCouponsPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<{ data: RemovedCoupon[] }>(
    me?.is_admin ? "/api/v1/admin/coupons?status=SUSPENDED" : null,
  );
  const [acting, setActing] = useState<string | null>(null);

  if (meLoading) return <ListSkeleton />;
  if (!me) return <NeedLogin message="登入後即可使用管理功能。" />;
  if (!me.is_admin)
    return (
      <div className="py-10">
        <EmptyState
          icon="lock"
          title="沒有權限"
          hint="這是管理員專用頁面。"
          action={
            <Button href="/" variant="outline">
              回到探索
            </Button>
          }
        />
      </div>
    );

  async function restore(id: string, title: string) {
    if (!confirm(`把「${title}」重新上架？`)) return;
    setActing(id);
    try {
      await apiFetch(`/api/v1/admin/coupons/${id}/restore`, { method: "POST" });
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
      <Eyebrow>Admin</Eyebrow>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">被下架的票券</h1>
      <p className="mt-1 text-sm text-ink-soft">
        目前被下架、但持有者仍正常的票券共 {rows.length} 張。若是被亂檢舉誤下架，可一鍵重新上架。
        （帳號被停權者的票券請到「被停權帳號」恢復帳號，會一併上架。）
      </p>

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : rows.length === 0 ? (
          <EmptyState icon="ticket" title="沒有被下架的票券" hint="目前沒有需要處理的下架票券。" />
        ) : (
          rows.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/coupons/${c.id}`}
                    className="truncate font-semibold text-ink hover:text-accent"
                  >
                    {c.brand}｜{c.title}
                  </Link>
                  <p className="truncate text-xs text-ink-faint">
                    {TYPE_LABEL[c.type] || c.type}
                    {c.category ? ` · ${c.category}` : ""} · 持有者：
                    {c.owner ? (
                      <Link href={`/users/${c.owner.id}`} className="hover:text-accent">
                        {c.owner.display_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  icon="check"
                  loading={acting === c.id}
                  onClick={() => restore(c.id, c.title)}
                >
                  重新上架
                </Button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 text-xs text-ink-soft">
                <Pill className={c.report_count >= 3 ? "bg-danger-tint text-danger" : "bg-sand text-ink-soft"}>
                  被檢舉 {c.report_count} 次
                </Pill>
                <span className="text-ink-faint">
                  下架於 {relativeTime(c.updated_at)}　·　上架於 {relativeTime(c.created_at)}　·　瀏覽 {c.view_count}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}
