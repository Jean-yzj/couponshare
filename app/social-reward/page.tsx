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
  GradientPanel,
  ProgressBar,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { HeroSparkles } from "@/components/Mascot";
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
  month_count: number;
  month_cap: number;
  blocked_reason: "already_submitted" | "quota_full" | null;
  can_submit: boolean;
  this_month: ThisMonth | null;
  posts: SocialPost[];
};

const STATUS_PILL: Record<SocialPostStatus, { label: (bonus: number | null) => string; cls: string }> = {
  PENDING: { label: () => "審核中", cls: "bg-accent-tint text-accent-press" },
  APPROVED: { label: (b) => `已通過 +${b ?? 10}`, cls: "bg-pine-tint text-pine" },
  REJECTED: { label: () => "未通過", cls: "bg-danger-tint text-danger" },
};

const STEPS = [
  { title: "公開發文", desc: "提到 CouponShare＋平台截圖＋至少 30 字心得" },
  { title: "回來提交", desc: "附上公開連結與可審核截圖" },
  { title: "等待審核", desc: "7 天內完成，通過即發放" },
];

export default function SocialRewardPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<SocialPostsData>(me ? "/api/v1/social-posts" : null);

  const [topic, setTopic] = useState("");
  const [postDate, setPostDate] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (meLoading) return <PageSkeleton />;
  if (!me) return <NeedLogin message="登入後即可使用發文獎勵。" />;
  if (loading || !data) return <PageSkeleton />;

  const canSubmit = topic.trim() && postDate && postUrl.trim() && !!image;
  const tm = data.this_month;
  const monthPost = tm ? (data.posts.find((p) => p.id === tm.id) ?? null) : null;
  const quotaPct = Math.min(100, Math.round((data.month_count / data.month_cap) * 100));

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login?ref=${me!.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

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

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hero — the whole deal at a glance */}
      <GradientPanel className="p-6">
        <HeroSparkles />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Icon name="sparkles" size={13} /> 社群任務・每人每月一篇
          </span>
          <h1 className="mt-3 font-display text-[26px] font-extrabold leading-tight">
            發一篇 Threads，
            <br />
            換申請次數
          </h1>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/15 px-2 py-2.5 backdrop-blur-sm">
              <p className="font-display text-xl font-extrabold leading-none">+10</p>
              <p className="mt-1 text-[11px] text-white/80">發文通過</p>
            </div>
            <div className="rounded-xl bg-white/15 px-2 py-2.5 backdrop-blur-sm">
              <p className="font-display text-xl font-extrabold leading-none">+20</p>
              <p className="mt-1 text-[11px] text-white/80">讚數破百</p>
            </div>
            <div className="rounded-xl bg-white/15 px-2 py-2.5 backdrop-blur-sm">
              <p className="font-display text-xl font-extrabold leading-none">+5</p>
              <p className="mt-1 text-[11px] text-white/80">貢獻值皆有</p>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-white/75">
            +10 與 +20 擇一發放：讚數破百就發 +20（以你提交的截圖為準），否則發 +10。
          </p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
            <span className="inline-flex items-center gap-1.5 text-sm text-white/85">
              <Icon name="coin" size={15} /> 本月加碼池（哪天用都行）
            </span>
            <span className="font-display text-lg font-extrabold">{data.pool_remaining} 次</span>
          </div>
        </div>
      </GradientPanel>

      {/* Three steps */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-line bg-paper p-3 text-center shadow-soft">
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint font-display text-sm font-extrabold text-accent">
              {i + 1}
            </span>
            <p className="mt-1.5 text-sm font-semibold text-ink">{s.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Monthly quota progress — 500 participants per month, first come first served */}
      <Card className="mt-4 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-ink">本月名額</p>
          <p className="text-sm text-ink-faint">
            已有 <span className="font-bold text-accent">{data.month_count.toLocaleString()}</span> 人發文 / 限{" "}
            {data.month_cap} 人
          </p>
        </div>
        <div className="mt-2">
          <ProgressBar value={quotaPct} />
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          額滿之後，這個月的發文就不會獲得獎勵；下個月 1 號重新開放。
        </p>
      </Card>

      {/* Invite link — free to copy; the post itself should be in the user's own words */}
      <Card className="mt-4 flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pine-tint text-pine">
          <Icon name="gift" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">貼文裡放上你的邀請連結</p>
          <p className="mt-0.5 text-sm text-ink-soft">每有一人透過它註冊，你再 +2 次（進當月加碼池）。</p>
        </div>
        <Button size="sm" variant="outline" icon={copied ? "check" : "share"} onClick={copyInvite}>
          {copied ? "已複製" : "複製連結"}
        </Button>
      </Card>

      {/* Submit form / this-month status */}
      <div className="mt-4">
        {data.can_submit ? (
          success ? (
            <Card className="p-6 text-center">
              <Icon name="checkCircle" size={36} className="mx-auto text-pine" />
              <p className="mt-3 font-semibold text-ink">已送出，等待審核</p>
              <p className="mt-1 text-sm text-ink-soft">
                審核通常在 7 天內完成，通過後次數會直接加進本月加碼池，並發通知給你。
              </p>
              <Button href="/score" variant="outline" className="mt-4" icon="medal">
                回到貢獻值
              </Button>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-ink">發完文，回來這裡提交</h2>
              <Banner tone="info" icon="image">
                貼文需包含：你實際使用平台的截圖（例如探索頁、錢包、領券畫面）＋至少 30
                字的使用心得，並用自己的話寫、文中有提到 CouponShare 即可（加不加 # 都可以）。
              </Banner>
              <div className="space-y-4">
                <Field label="發文主題" required hint="一句話描述你的貼文內容">
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="例如：免費換到一杯拿鐵，順手把用不到的券送出去"
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
                    placeholder="https://www.threads.com/..."
                  />
                </Field>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">
                    審核截圖 <span className="text-accent">*</span>
                  </p>
                  <p className="mb-2 text-xs leading-relaxed text-ink-faint">
                    請上傳能看出貼文內容（平台截圖＋心得文字＋提到 CouponShare）與讚數的截圖。
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
                      上傳審核截圖（需看得到貼文內容與讚數）
                    </button>
                  )}
                </div>
                {error && <Banner tone="warn" icon="info">{error}</Banner>}
                <Button full icon="send" loading={busy} disabled={!canSubmit} onClick={submit}>
                  送出申請
                </Button>
              </div>
            </Card>
          )
        ) : data.blocked_reason === "quota_full" ? (
          <Card className="p-5">
            <p className="font-semibold text-ink">本月名額已滿</p>
            <div className="mt-3">
              <Banner tone="warn" icon="info">
                本月 {data.month_cap} 個發文獎勵名額已滿，現在發文不會獲得獎勵。下個月 1
                號重新開放，歡迎先把心得存起來、月初再來提交。
              </Banner>
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <p className="font-semibold text-ink">你這個月已經提交過了，不可以再提交</p>
            <div className="mt-3">
              {tm?.status === "PENDING" && (
                <Banner tone="info" icon="clock">
                  已收到你的提交，審核中（7 天內完成），結果會發通知給你。
                </Banner>
              )}
              {tm?.status === "APPROVED" && (
                <Banner tone="success" icon="checkCircle">
                  本月已通過審核，+{monthPost?.bonus_granted ?? 10} 次已加進你的加碼池。下個月可以再來一篇。
                </Banner>
              )}
              {tm?.status === "REJECTED" && (
                <Banner tone="warn" icon="info">
                  本月的提交未通過{monthPost?.admin_note ? `：${monthPost.admin_note}` : ""}。下個月可以再提交一次。
                </Banner>
              )}
            </div>
            {tm && (
              <p className="mt-2.5 text-xs text-ink-faint">提交於 {relativeTime(tm.created_at)}</p>
            )}
          </Card>
        )}
      </div>

      {/* Fine print */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-xs text-ink-faint">
        <span className="inline-flex items-center gap-1">
          <Icon name="eye" size={12} /> 帳號需設為公開
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="clock" size={12} /> 每人每月限一篇
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="users" size={12} /> 每月限 {data.month_cap} 名
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="edit" size={12} /> 心得至少 30 字
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="image" size={12} /> 文內需有平台使用截圖
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="star" size={12} /> 讚數以截圖為準
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="info" size={12} /> 內容偏負面不予通過
        </span>
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
                      <p className="truncate font-medium text-ink">{p.topic}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">{relativeTime(p.created_at)}</p>
                    </div>
                    <Pill className={meta.cls}>{meta.label(p.bonus_granted)}</Pill>
                  </div>
                  {p.admin_note && (
                    <p className="mt-2 text-xs text-ink-faint">審核備註：{p.admin_note}</p>
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

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
