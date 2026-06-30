"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Avatar, LevelBadge, Skeleton, EmptyState, NeedLogin, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

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

  async function resolve(id: string, decision: "ACCEPT" | "REJECT") {
    let note: string | undefined;
    if (decision === "REJECT") {
      note = window.prompt("駁回原因（選填，會通知對方）") || undefined;
    } else if (!window.confirm("通過申訴並恢復這個帳號？")) {
      return;
    }
    setActing(id);
    try {
      await apiFetch(`/api/v1/admin/appeals/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ decision, note: note ?? null }),
      });
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setActing(null);
    }
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

              {a.status === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon="check" loading={acting === a.id} onClick={() => resolve(a.id, "ACCEPT")}>
                    通過，恢復帳號
                  </Button>
                  <Button size="sm" variant="danger" loading={acting === a.id} onClick={() => resolve(a.id, "REJECT")}>
                    駁回
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
