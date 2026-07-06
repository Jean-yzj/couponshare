"use client";

import { useEffect, useRef, useState } from "react";
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
  { title: "公開發文", desc: "在 Threads 帶上 #CouponShare 分享心得" },
  { title: "回來提交", desc: "附上貼文連結與截圖" },
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
  const [origin, setOrigin] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (meLoading) return <PageSkeleton />;
  if (!me) return <NeedLogin message="登入後即可使用發文獎勵。" />;
  if (loading || !data) return <PageSkeleton />;

  const canSubmit = topic.trim() && postDate && postUrl.trim() && !!image;
  const inviteUrl = `${origin || "https://couponshare.lazybearlife.com"}/login?ref=${me.id}`;
  const template = `我最近在用 CouponShare：把用不到的優惠券分享出去，也常領到別人分享的好康。讓券不浪費，也讓善意流動起來。

#CouponShare
${inviteUrl}`;

  const tm = data.this_month;
  const monthPost = tm ? (data.posts.find((p) => p.id === tm.id) ?? null) : null;

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can long-press the text */
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
              <p className="mt-1 text-[11px] text-white/80">審核通過</p>
            </div>
            <div className="rounded-xl bg-white/15 px-2 py-2.5 backdrop-blur-sm">
              <p className="font-display text-xl font-extrabold leading-none">+20</p>
              <p className="mt-1 text-[11px] text-white/80">讚數破百</p>
            </div>
            <div className="rounded-xl bg-white/15 px-2 py-2.5 backdrop-blur-sm">
              <p className="font-display text-xl font-extrabold leading-none">+5</p>
              <p className="mt-1 text-[11px] text-white/80">貢獻值</p>
            </div>
          </div>
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

      {/* Copyable template — with the user's invite link baked in */}
      <Card className="mt-4 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-ink">懶人範本</p>
          <span className="text-xs text-ink-faint">可直接複製，也歡迎自由改寫</span>
        </div>
        <div className="mt-2.5 whitespace-pre-wrap break-all rounded-xl bg-canvas/70 p-3.5 text-sm leading-relaxed text-ink-soft">
          {template}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-faint">
          <Icon name="gift" size={13} className="mt-0.5 shrink-0 text-pine" />
          範本已帶上你的邀請連結：每有一人透過它註冊，你再 +2 次。歡迎大家一起讓更多人知道這個平臺，把善意傳遞下去。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" icon={copied ? "check" : "edit"} onClick={copyTemplate}>
            {copied ? "已複製" : "複製範本"}
          </Button>
          <Button icon="arrowRight" onClick={() => window.open("https://www.threads.com/", "_blank", "noopener")}>
            打開 Threads
          </Button>
        </div>
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
                      上傳貼文截圖（需看得到 #CouponShare 與讚數）
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
