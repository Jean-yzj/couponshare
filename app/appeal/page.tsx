"use client";

import { useState } from "react";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Field, Textarea, Banner, NeedLogin, Skeleton, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/display";

type AppealData = {
  suspended: boolean;
  appeal: {
    id: string;
    status: string;
    message: string;
    admin_note: string | null;
    created_at: string;
  } | null;
};

export default function AppealPage() {
  const { me, loading: meLoading } = useMe();
  // Unconditional: parallel with the session check (endpoint enforces auth itself).
  const { data, loading, refetch } = useApi<AppealData>("/api/v1/me/appeal");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (meLoading) return <Skeleton className="mx-auto h-48 max-w-xl rounded-2xl" />;
  if (!me) return <NeedLogin message="登入後即可提出申訴。" />;
  if (loading || !data) return <Skeleton className="mx-auto h-48 max-w-xl rounded-2xl" />;

  async function submit() {
    if (message.trim().length < 5) {
      setError("請至少寫 5 個字說明情況");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/appeals", {
        method: "POST",
        body: JSON.stringify({ message: message.trim() }),
      });
      setSent(true);
      refetch();
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "送出失敗");
      setBusy(false);
    }
  }

  const pending = sent || data.appeal?.status === "PENDING";
  const rejected = data.appeal?.status === "REJECTED";

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow="Appeal" title="帳號申訴" />

      {!data.suspended ? (
        <Card className="mt-5 p-6 text-center">
          <Icon name="shieldCheck" size={32} className="mx-auto text-pine" />
          <p className="mt-2 font-medium text-ink">你的帳號狀態正常</p>
          <p className="text-sm text-ink-soft">目前不需要申訴。</p>
          <div className="mt-4">
            <Button href="/" variant="outline">
              回到探索
            </Button>
          </div>
        </Card>
      ) : pending ? (
        <Card className="mt-5 p-6">
          <Banner tone="info" icon="clock">你的申訴正在審核中，我們會盡快人工複核，請耐心等候。</Banner>
          {data.appeal && (
            <>
              <p className="mt-4 whitespace-pre-wrap text-sm text-ink-soft">{data.appeal.message}</p>
              <p className="mt-2 text-xs text-ink-faint">送出於 {formatDate(data.appeal.created_at)}</p>
            </>
          )}
        </Card>
      ) : (
        <Card className="mt-5 p-6">
          {rejected && (
            <div className="mb-4">
              <Banner tone="warn" icon="info">
                上次申訴未通過{data.appeal?.admin_note ? `：${data.appeal.admin_note}` : ""}。你可以再次說明並送出。
              </Banner>
            </div>
          )}
          <p className="text-sm leading-relaxed text-ink-soft">
            你的帳號因被多位使用者檢舉而停權。若你認為這是誤會，請說明情況，我們會人工複核。
          </p>
          <div className="mt-4">
            <Field label="申訴說明" required>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="請說明你的情況，例如：票券都是真實有效的、與對方有誤會等…"
              />
            </Field>
          </div>
          {error && (
            <div className="mt-3">
              <Banner tone="warn" icon="info">{error}</Banner>
            </div>
          )}
          <Button className="mt-4" full icon="send" loading={busy} onClick={submit}>
            送出申訴
          </Button>
        </Card>
      )}
    </div>
  );
}
