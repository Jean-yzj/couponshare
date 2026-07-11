"use client";

import { useState } from "react";
import { apiFetch, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Field, Input, Skeleton, NeedLogin, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";

type Result = {
  reset_url: string;
  expires_hours: number;
  user: { display_name: string; email: string };
};

export default function AdminAccountRecoveryPage() {
  const { me, loading: meLoading } = useMe();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

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
        <EmptyState icon="lock" title="沒有權限" hint="這是管理員專用頁面。" />
      </div>
    );

  async function generate() {
    if (!email.trim()) {
      setErr("請填使用者的 Email");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    setCopied(false);
    try {
      const r = await apiFetch<Result>("/api/v1/admin/password-reset-link", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setResult(r);
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "產生失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard?.writeText(result.reset_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight text-ink">帳號救援・忘記密碼</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        使用者忘記密碼時，在這裡輸入他的 Email，產生一條<strong className="text-ink">一次性重設連結</strong>給他，他自己開連結設新密碼。
        你全程<strong className="text-ink">不會看到、也不用輸入</strong>他的密碼。（只適用 Email 密碼帳號；Google／Apple 登入的人沒有密碼。）
      </p>

      <Card className="mt-5 space-y-3 p-4">
        <Field label="使用者 Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@example.com" onKeyDown={(e) => e.key === "Enter" && generate()} />
        </Field>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button icon="lock" loading={busy} onClick={generate}>產生重設連結</Button>
      </Card>

      {result && (
        <Card className="mt-4 space-y-3 border-accent/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-pine">
            <Icon name="checkCircle" size={16} /> 已為 {result.user.display_name}（{result.user.email}）產生重設連結
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-xs text-ink-soft">{result.reset_url}</code>
            <button onClick={copy} className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-press">
              {copied ? "已複製" : "複製連結"}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-ink-faint">
            把這條連結傳給他（LINE、Email 都可以）。連結 <strong className="text-ink-soft">{result.expires_hours} 小時內有效、只能用一次</strong>，用過或過期就會失效。
            你不會看到他設定的新密碼。
          </p>
        </Card>
      )}
    </div>
  );
}
