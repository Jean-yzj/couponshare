"use client";

import { useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Avatar, Skeleton, EmptyState, NeedLogin, LoadFailed } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type SocialPostStatus = "PENDING" | "APPROVED" | "REJECTED";

type AdminSocialPost = {
  id: string;
  topic: string;
  post_date: string;
  post_url: string;
  status: SocialPostStatus;
  bonus_granted: number | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    contribution_score: number;
    status: string;
  };
};

const TABS = [
  { key: "PENDING", label: "待審核" },
  { key: "APPROVED", label: "已通過" },
  { key: "REJECTED", label: "未通過" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function AdminSocialPostsPage() {
  const { me, loading: meLoading } = useMe();
  const [tab, setTab] = useState<Tab>("PENDING");
  const { data, loading, error, refetch } = useApi<{ data: AdminSocialPost[] }>(
    me?.is_admin ? `/api/v1/admin/social-posts?status=${tab}` : null,
  );
  const [acting, setActing] = useState<string | null>(null);

  if (meLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可使用管理功能。" />;
  if (!me.is_admin)
    return (
      <div className="py-10">
        <EmptyState icon="lock" title="沒有權限" hint="這是管理員專用頁面。" />
      </div>
    );

  async function act(
    id: string,
    decision: "APPROVE" | "REJECT",
    bonus?: 10 | 20,
  ) {
    let note: string | undefined;
    if (decision === "REJECT") {
      const raw = window.prompt("請輸入未通過原因（可留空）");
      if (raw === null) return; // cancelled
      note = raw.trim() || undefined;
    }
    setActing(id);
    try {
      await apiFetch(`/api/v1/admin/social-posts/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ decision, ...(bonus ? { bonus } : {}), ...(note ? { note } : {}) }),
      });
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
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">發文審核</h1>
      <p className="mt-1 text-sm text-ink-soft">
        審核社群發文換申請次數的申請。通過前請確認貼文公開、含 #CouponShare，且貼文內容本身有放平台使用截圖。
      </p>

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

      <div className="mt-5 space-y-4">
        {error && !data ? (
          <LoadFailed onRetry={refetch} />
        ) : loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
        ) : rows.length === 0 ? (
          <EmptyState
            icon="send"
            title={tab === "PENDING" ? "目前沒有待審核的申請" : "這個分頁目前是空的"}
            hint={
              tab === "PENDING"
                ? "通過或退回後會移到對應分頁。"
                : undefined
            }
          />
        ) : (
          rows.map((post) => (
            <Card key={post.id} className="p-4">
              {/* User info */}
              <div className="flex items-center gap-3">
                <Avatar name={post.user.display_name} url={post.user.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink truncate">{post.user.display_name}</p>
                  <p className="text-xs text-ink-faint">貢獻分 {post.user.contribution_score}</p>
                </div>
                <span className="text-xs text-ink-faint">{relativeTime(post.created_at)}</span>
              </div>

              {/* Post details */}
              <div className="mt-3 space-y-1.5 rounded-xl bg-canvas/60 p-3 text-sm">
                <p className="font-medium text-ink">{post.topic}</p>
                <p className="text-xs text-ink-faint">
                  發文日期：{post.post_date}
                </p>
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-press"
                >
                  <Icon name="arrowRight" size={13} />
                  前往貼文
                </a>
              </div>

              {/* Evidence screenshot */}
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-ink-faint">
                  審核截圖需看得到：平台使用截圖、#CouponShare 與讚數。
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/v1/admin/social-posts/${post.id}/image`}
                  className="max-h-64 rounded-lg border border-line"
                  alt="發文截圖"
                  loading="lazy"
                />
              </div>

              {/* Actions for pending */}
              {post.status === "PENDING" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon="check"
                    loading={acting === post.id}
                    onClick={() => act(post.id, "APPROVE", 10)}
                  >
                    通過 +10
                  </Button>
                  <Button
                    size="sm"
                    variant="gold"
                    icon="star"
                    loading={acting === post.id}
                    onClick={() => act(post.id, "APPROVE", 20)}
                  >
                    破百讚 +20
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon="x"
                    loading={acting === post.id}
                    onClick={() => act(post.id, "REJECT")}
                  >
                    未通過
                  </Button>
                </div>
              )}

              {/* Outcome for resolved */}
              {post.status === "APPROVED" && (
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
                  <Icon name="checkCircle" size={14} className="text-pine" />
                  <span>
                    已通過，發放 +{post.bonus_granted ?? 10} 次申請
                    {post.resolved_at && <>　·　{relativeTime(post.resolved_at)}</>}
                  </span>
                </div>
              )}
              {post.status === "REJECTED" && (
                <div className="mt-3 text-xs text-ink-faint">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="x" size={13} className="text-danger" />
                    未通過
                    {post.resolved_at && <>　·　{relativeTime(post.resolved_at)}</>}
                  </span>
                  {post.admin_note && (
                    <p className="mt-1">備註：{post.admin_note}</p>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
