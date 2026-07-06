"use client";

import { useRef, useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { fileToDataUri } from "@/lib/client-image";
import {
  Button,
  Card,
  Field,
  Input,
  Banner,
  NeedLogin,
  Skeleton,
  Pill,
  PageHeader,
  Eyebrow,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { relativeTime } from "@/lib/display";

type SocialPostStatus = "PENDING" | "APPROVED" | "REJECTED";

type ThisMonth = {
  id: string;
  status: SocialPostStatus;
  created_at: string;
};

type SocialPost = {
  id: string;
  topic: string;
  post_url: string;
  status: SocialPostStatus;
  bonus_granted: number | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

type SocialPostsData = {
  pool_remaining: number;
  can_submit: boolean;
  this_month: ThisMonth | null;
  posts: SocialPost[];
};

const STATUS_PILL: Record<SocialPostStatus, { label: (bonus: number | null) => string; cls: string }> = {
  PENDING: { label: () => "審核中", cls: "bg-accent-tint text-accent-press" },
  APPROVED: { label: (b) => `已通過 +${b ?? 10}`, cls: "bg-pine-tint text-pine" },
  REJECTED: { label: () => "未通過", cls: "bg-danger-tint text-danger" },
};

export default function SocialRewardPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<SocialPostsData>(
    me ? "/api/v1/social-posts" : null,
  );

  const [topic, setTopic] = useState("");
  const [postDate, setPostDate] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (meLoading) return <Skeleton className="mx-auto h-64 max-w-2xl rounded-2xl" />;
  if (!me) return <NeedLogin message="登入後即可使用發文獎勵。" />;
  if (loading || !data) return <Skeleton className="mx-auto h-64 max-w-2xl rounded-2xl" />;

  const canSubmit = topic.trim() && postDate && postUrl.trim() && !!image;

  async function pickImage(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("請選擇圖片檔");
      return;
    }
    try {
      setImage(await fileToDataUri(f));
      setError(null);
    } catch {
      setError("圖片處理失敗，請換一張");
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/social-posts", {
        method: "POST",
        body: JSON.stringify({
          topic: topic.trim(),
          post_date: postDate,
          post_url: postUrl.trim(),
          evidence_image: image,
        }),
      });
      setSuccess(true);
      refetch();
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "送出失敗");
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login?ref=${me!.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="獎勵" title="社群發文換申請次數" />

      {/* Pool remaining */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 shadow-soft">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-tint text-accent">
          <Icon name="coin" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">本月加碼次數</p>
          <p className="mt-0.5 text-sm text-ink-soft">本月尚有配額，通過審核即發放</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl font-extrabold leading-none text-accent">
            {data.pool_remaining}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">次剩餘</p>
        </div>
      </div>

      {/* Rules */}
      <Card className="mt-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Eyebrow>活動說明</Eyebrow>
        </div>
        <ul className="space-y-2 text-sm text-ink-soft">
          <li className="flex items-start gap-2">
            <Icon name="check" size={15} className="mt-0.5 shrink-0 text-pine" />
            在 Threads 等社群發一篇公開貼文、帶上 <span className="font-medium text-ink">#CouponShare</span>，分享你的使用心得（可以寫：在平台上得到的優惠券、收穫到的好評、分享出去的東西，但不限於這些）。
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={15} className="mt-0.5 shrink-0 text-pine" />
            審核 7 天內完成。通過 <span className="font-medium text-ink">+10 次申請</span>、貼文讚數破 100（以截圖為準）<span className="font-medium text-ink">+20 次</span>、貢獻值 <span className="font-medium text-ink">+5</span>。
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={15} className="mt-0.5 shrink-0 text-pine" />
            每人每月限一篇。帳號需設為公開，審核者才看得到內容。
          </li>
          <li className="flex items-start gap-2">
            <Icon name="info" size={15} className="mt-0.5 shrink-0 text-ink-faint" />
            內容偏負面不予通過。
          </li>
        </ul>
      </Card>

      {/* Invite nudge */}
      <div className="mt-4 rounded-2xl border border-line bg-paper p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pine-tint text-pine">
            <Icon name="users" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">帶上邀請連結，再多賺</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              發文時帶上你的邀請連結，每有一人透過它註冊，你再 +2 次申請次數。
            </p>
          </div>
        </div>
        <button
          onClick={copyInvite}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-grad-brand py-2.5 text-sm font-semibold text-white shadow-glow transition-transform active:scale-[0.99]"
        >
          <Icon name={copied ? "check" : "share"} size={16} />
          {copied ? "已複製邀請連結" : "複製我的邀請連結"}
        </button>
      </div>

      {/* Submit form or already-submitted state */}
      <div className="mt-6">
        {data.can_submit ? (
          success ? (
            <Card className="p-6 text-center">
              <Icon name="checkCircle" size={36} className="mx-auto text-pine" />
              <p className="mt-3 font-semibold text-ink">已送出，等待審核</p>
              <p className="mt-1 text-sm text-ink-soft">審核通常在 7 天內完成，通過後次數會自動發放。</p>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="font-semibold text-ink mb-4">提交貼文</h2>
              <div className="space-y-4">
                <Field label="發文主題" required hint="簡短描述你的貼文內容，例如：分享到期快的 7-11 票券">
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="例如：免費兌換一杯中杯飲料，直接送出去了"
                  />
                </Field>
                <Field label="發文日期" required>
                  <Input
                    type="date"
                    value={postDate}
                    onChange={(e) => setPostDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                </Field>
                <Field label="發文連結" required hint="請貼上公開貼文的完整網址">
                  <Input
                    type="url"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    placeholder="https://www.threads.net/..."
                  />
                </Field>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">
                    貼文截圖 <span className="text-accent">*</span>
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                  />
                  {image ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt="貼文截圖" className="max-h-48 rounded-xl border border-line" />
                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        aria-label="移除圖片"
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shadow-soft"
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-canvas/50 py-4 text-sm text-ink-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      <Icon name="image" size={18} />
                      上傳貼文截圖（需顯示 #CouponShare 標籤與讚數）
                    </button>
                  )}
                </div>
                {error && (
                  <Banner tone="warn" icon="info">{error}</Banner>
                )}
                <Button full icon="send" loading={busy} disabled={!canSubmit} onClick={submit}>
                  送出申請
                </Button>
              </div>
            </Card>
          )
        ) : (
          <Card className="p-5">
            <Banner tone="info" icon="clock">
              你這個月已經提交過了，不可以再提交。
            </Banner>
            {data.this_month && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-ink-soft">本月提交狀態：</span>
                <Pill
                  className={STATUS_PILL[data.this_month.status].cls}
                >
                  {STATUS_PILL[data.this_month.status].label(null)}
                </Pill>
                <span className="text-xs text-ink-faint">{relativeTime(data.this_month.created_at)}</span>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Past submissions */}
      {data.posts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold text-ink">過往提交紀錄</h2>
          <div className="space-y-3">
            {data.posts.map((p) => {
              const meta = STATUS_PILL[p.status];
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink truncate">{p.topic}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">{relativeTime(p.created_at)}</p>
                    </div>
                    <Pill className={meta.cls}>
                      {meta.label(p.bonus_granted)}
                    </Pill>
                  </div>
                  {p.admin_note && (
                    <p className="mt-2 text-xs text-ink-faint">
                      審核備註：{p.admin_note}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
