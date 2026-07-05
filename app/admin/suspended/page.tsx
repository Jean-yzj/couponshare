"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Avatar, Skeleton, EmptyState, NeedLogin, Eyebrow, Pill } from "@/components/ui";
import { relativeTime } from "@/lib/display";

type SuspendedUser = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  provider: string;
  contribution_score: number;
  level_name: string;
  risk_flag: boolean;
  created_at: string;
  updated_at: string;
  suspend_reason: string;
  suspended_at: string | null;
};

export default function AdminSuspendedPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<{ data: SuspendedUser[] }>(
    me?.is_admin ? "/api/v1/admin/users?status=SUSPENDED" : null,
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

  async function restore(id: string, name: string) {
    if (!confirm(`恢復「${name}」的帳號並重新上架其票券？`)) return;
    setActing(id);
    try {
      await apiFetch(`/api/v1/admin/users/${id}/restore`, { method: "POST" });
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
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">被停權的帳號</h1>
      <p className="mt-1 text-sm text-ink-soft">
        目前被停權的帳號共 {rows.length} 個。若是誤判（例如被集體亂檢舉），可一鍵恢復。
      </p>
      <div className="mt-3 flex gap-2 text-sm">
        <Link href="/admin" className="text-accent hover:underline">
          數據總覽
        </Link>
        <span className="text-ink-faint">·</span>
        <Link href="/admin/reports" className="text-accent hover:underline">
          檢舉審核
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : rows.length === 0 ? (
          <EmptyState icon="shield" title="沒有被停權的帳號" hint="目前所有帳號都正常。" />
        ) : (
          rows.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={u.display_name} url={u.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/users/${u.id}`}
                    className="truncate font-semibold text-ink hover:text-accent"
                  >
                    {u.display_name}
                  </Link>
                  <p className="truncate text-xs text-ink-faint">
                    {u.email || "（無 Email）"} · {u.provider} · {u.level_name} · {u.contribution_score} 分
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  icon="check"
                  loading={acting === u.id}
                  onClick={() => restore(u.id, u.display_name)}
                >
                  解除停權
                </Button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 text-xs text-ink-soft">
                <Pill className="bg-danger-tint text-danger">{u.suspend_reason}</Pill>
                {u.risk_flag && <Pill className="bg-danger-tint text-danger">風險標記</Pill>}
                <span className="text-ink-faint">
                  停權於 {u.suspended_at ? relativeTime(u.suspended_at) : relativeTime(u.updated_at)}
                  　·　註冊於 {relativeTime(u.created_at)}
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
