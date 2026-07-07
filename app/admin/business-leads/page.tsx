"use client";

import { useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Skeleton, EmptyState, NeedLogin, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  job_title: string | null;
  email: string;
  phone: string;
  line_id: string;
  goals: string | null;
  categories: string | null;
  status: "PENDING" | "CONTACTED";
  created_at: string;
  contacted_at: string | null;
};

const TABS = [
  { key: "PENDING", label: "待寄報價" },
  { key: "CONTACTED", label: "已寄報價" },
] as const;

export default function AdminBusinessLeadsPage() {
  const { me, loading: meLoading } = useMe();
  const [tab, setTab] = useState<"PENDING" | "CONTACTED">("PENDING");
  const { data, loading, refetch } = useApi<{ data: Lead[] }>(
    me?.is_admin ? `/api/v1/admin/business-leads?status=${tab}` : null,
  );
  const [acting, setActing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  async function setStatus(id: string, status: "PENDING" | "CONTACTED") {
    setActing(id);
    try {
      await apiFetch(`/api/v1/admin/business-leads/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setActing(null);
    }
  }

  function copy(key: string, value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  const rows = data?.data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">企業合作名單</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        企業主從合作窗口留下的聯絡資料。寄出報價後記得按「已寄報價」歸檔。
      </p>

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
        ) : rows.length === 0 ? (
          <EmptyState
            icon="bell"
            title={tab === "PENDING" ? "目前沒有待處理的洽詢" : "還沒有已寄報價的紀錄"}
            hint={tab === "PENDING" ? "有企業主填寫合作窗口時，會出現在這裡並通知你。" : "在待寄報價分頁按下「已寄報價」後會移到這裡。"}
          />
        ) : (
          rows.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {l.company || l.name}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {l.name}
                    {l.job_title ? ` · ${l.job_title}` : ""}
                  </p>
                </div>
                <Pill className={l.status === "CONTACTED" ? "bg-pine-tint text-pine" : "bg-gold-tint text-gold"}>
                  {l.status === "CONTACTED" ? "已寄報價" : "待寄報價"}
                </Pill>
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {relativeTime(l.created_at)} 填寫
                {l.contacted_at ? ` · ${relativeTime(l.contacted_at)} 寄出報價` : ""}
              </p>
              {(l.goals || l.categories) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.categories?.split(", ").filter(Boolean).map((c) => (
                    <span key={`c-${c}`} className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-medium text-accent">{c}</span>
                  ))}
                  {l.goals?.split(", ").filter(Boolean).map((g) => (
                    <span key={`g-${g}`} className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-ink-soft">{g}</span>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <a href={`mailto:${l.email}`} className="flex min-w-0 items-center gap-2 text-accent hover:text-accent-press">
                    <Icon name="send" size={14} className="shrink-0" />
                    <span className="truncate">{l.email}</span>
                  </a>
                  <button onClick={() => copy(`${l.id}:email`, l.email)} className="shrink-0 text-xs text-ink-faint hover:text-ink">
                    {copied === `${l.id}:email` ? "已複製" : "複製"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <a href={`tel:${l.phone}`} className="flex min-w-0 items-center gap-2 text-ink-soft hover:text-ink">
                    <Icon name="bell" size={14} className="shrink-0" />
                    <span className="truncate">{l.phone}</span>
                  </a>
                  <button onClick={() => copy(`${l.id}:phone`, l.phone)} className="shrink-0 text-xs text-ink-faint hover:text-ink">
                    {copied === `${l.id}:phone` ? "已複製" : "複製"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                    <Icon name="user" size={14} className="shrink-0" />
                    <span className="truncate">LINE：{l.line_id}</span>
                  </span>
                  <button onClick={() => copy(`${l.id}:line`, l.line_id)} className="shrink-0 text-xs text-ink-faint hover:text-ink">
                    {copied === `${l.id}:line` ? "已複製" : "複製"}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {l.status === "PENDING" ? (
                  <Button size="sm" icon="check" loading={acting === l.id} onClick={() => setStatus(l.id, "CONTACTED")}>
                    已寄報價
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" loading={acting === l.id} onClick={() => setStatus(l.id, "PENDING")}>
                    標回待處理
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
