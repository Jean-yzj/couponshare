"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Textarea, Skeleton, EmptyState, NeedLogin } from "@/components/ui";
import { Icon } from "@/components/icons";

type Detail = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  application_mode: "DIRECT_CLAIM" | "MESSAGE_APPLICATION" | "TASK_UNLOCK";
  task_instruction: string | null;
  task_url: string | null;
  status: string;
  remaining: number;
  max_applications: number;
  usage_expiry: string | null;
  cta_text: string | null;
  cta_url: string | null;
  redeem_info: string | null;
  brand: { id: string; name: string; logo_text: string | null; logo_url: string | null; category: string | null };
  my_status: "PENDING" | "CLAIMED" | "REJECTED" | null;
};

export default function BrandCouponDetailPage() {
  const params = useParams<{ id: string }>();
  const { me } = useMe();
  const { data, loading, error, refetch } = useApi<Detail>(`/api/v1/brand-coupons/${params.id}`);
  const [message, setMessage] = useState("");
  const [taskDone, setTaskDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <div className="mx-auto max-w-lg"><Skeleton className="h-80 rounded-2xl" /></div>;
  if (error || !data)
    return (
      <div className="py-10">
        <EmptyState icon="ban" title="找不到這張券" hint="這張官方福利券不存在，或目前尚未開放。" />
      </div>
    );

  const c = data;
  const soldOut = c.remaining <= 0;
  const isMessage = c.application_mode === "MESSAGE_APPLICATION";
  const isTask = c.application_mode === "TASK_UNLOCK";

  // Fire-and-forget: increment click_count without blocking navigation or apply.
  function fireClick() {
    apiFetch(`/api/v1/brand-coupons/${params.id}/click`, { method: "POST" }).catch(() => {});
  }

  async function apply() {
    if (!me) return;
    if (isMessage && message.trim().length < 2) {
      setErr("請簡單寫一句申請原因");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/v1/brand-coupons/${params.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ message: message.trim() || undefined }),
      });
      await refetch();
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "送出失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link href={`/brands/${c.brand.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <Icon name="chevronLeft" size={16} /> {c.brand.name}
      </Link>

      <Card className="overflow-hidden p-0">
        {c.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image_url} alt="" className="h-48 w-full object-cover" />
        )}
        <div className="bg-grad-brand px-6 py-7 text-white">
          <div className="flex items-center gap-2 text-sm text-white/85">
            {c.brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.brand.logo_url} alt="" className="h-8 w-8 rounded-lg border border-white/30 object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">
                {c.brand.logo_text || c.brand.name.slice(0, 1)}
              </span>
            )}
            {c.brand.name}
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">官方福利券</span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-snug">{c.title}</h1>
          {c.description && <p className="mt-2 text-sm leading-relaxed text-white/90">{c.description}</p>}
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">剩餘名額</span>
            <span className="font-semibold text-ink">{Math.max(0, c.remaining)} / {c.max_applications}</span>
          </div>
          {c.usage_expiry && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">使用期限</span>
              <span className="font-semibold text-ink">{new Date(c.usage_expiry).toLocaleDateString("zh-TW")}</span>
            </div>
          )}

          {/* Already claimed → show redeem info + CTA */}
          {c.my_status === "CLAIMED" ? (
            <div className="rounded-xl border border-pine/30 bg-pine-tint/40 p-4">
              <p className="flex items-center gap-2 font-semibold text-pine">
                <Icon name="checkCircle" size={18} /> 你已經領到這張券
              </p>
              {c.redeem_info && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{c.redeem_info}</p>}
              {c.cta_url && (
                <Button href={c.cta_url} variant="primary" full className="mt-3" iconRight="arrowRight" onClick={fireClick}>
                  {c.cta_text || "前往使用"}
                </Button>
              )}
            </div>
          ) : c.my_status === "PENDING" ? (
            <div className="rounded-xl border border-gold/30 bg-gold-tint/50 p-4 text-sm text-ink-soft">
              <p className="flex items-center gap-2 font-semibold text-gold"><Icon name="hourglass" size={16} /> 申請審核中</p>
              <p className="mt-1">品牌會盡快審核你的申請，通過後會通知你。</p>
            </div>
          ) : c.my_status === "REJECTED" ? (
            <div className="rounded-xl border border-line bg-canvas p-4 text-sm text-ink-soft">
              這次的申請未通過，別灰心，還有其他官方福利券可以領。
            </div>
          ) : !me ? (
            <NeedLogin message="登入後即可申請這張官方福利券。" />
          ) : soldOut || c.status !== "ACTIVE" ? (
            <div className="rounded-xl border border-line bg-canvas p-4 text-center text-sm text-ink-faint">
              {soldOut ? "名額已經領完了" : "這張券目前無法領取"}
            </div>
          ) : (
            <div className="space-y-3">
              {isMessage && (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">申請原因</p>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="簡單寫一句你為什麼想領這張券"
                    maxLength={200}
                  />
                </div>
              )}
              {isTask && (
                <div className="space-y-3 rounded-xl border border-accent/25 bg-accent-tint/40 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                    <Icon name="sparkles" size={16} /> 完成任務即可解鎖
                  </p>
                  {c.task_instruction && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{c.task_instruction}</p>
                  )}
                  {c.task_url && (
                    <a
                      href={c.task_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-press"
                    >
                      前往任務頁 <Icon name="arrowRight" size={14} />
                    </a>
                  )}
                  <label className="flex cursor-pointer items-start gap-2 border-t border-accent/15 pt-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={taskDone}
                      onChange={(e) => setTaskDone(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-accent"
                    />
                    <span>我已完成上述任務</span>
                  </label>
                </div>
              )}
              {err && <p className="text-sm text-danger">{err}</p>}
              <Button full size="lg" loading={busy} disabled={isTask && !taskDone} icon={isMessage ? "send" : "gift"} onClick={apply}>
                {isMessage ? "送出申請" : "立即領取"}
              </Button>
              <p className="text-center text-xs text-ink-faint">
                {isMessage
                  ? "送出後由品牌審核，通過會通知你。"
                  : isTask
                    ? "完成任務並勾選後即可領取，每人限領一張。"
                    : "點擊即可領取，每人限領一張。"}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
