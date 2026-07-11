"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, ApiErr } from "@/lib/client";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { Icon } from "@/components/icons";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sand text-ink-faint">
          <Icon name="ban" size={22} />
        </span>
        <p className="mt-3 font-semibold text-ink">連結無效</p>
        <p className="mt-1 text-sm text-ink-soft">這條重設連結不完整，請再向管理員索取一條新的。</p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pine-tint text-pine">
          <Icon name="checkCircle" size={24} />
        </span>
        <p className="mt-3 font-semibold text-ink">密碼已重設</p>
        <p className="mt-1 text-sm text-ink-soft">請用你剛設定的新密碼登入。</p>
        <Button href="/login" full className="mt-4" iconRight="arrowRight">前往登入</Button>
      </Card>
    );
  }

  async function submit() {
    if (password.length < 6) {
      setErr("密碼至少 6 個字");
      return;
    }
    if (password !== confirm) {
      setErr("兩次輸入的密碼不一致");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "重設失敗，請再試一次");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <Field label="新密碼" hint="至少 6 個字">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="輸入新密碼" autoComplete="new-password" />
      </Field>
      <Field label="再輸入一次">
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再輸入一次新密碼" autoComplete="new-password" />
      </Field>
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button full size="lg" icon="check" loading={busy} onClick={submit}>設定新密碼</Button>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-tint text-accent">
          <Icon name="lock" size={22} />
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">重設密碼</h1>
        <p className="mt-1 text-sm text-ink-soft">設定一組新密碼，之後就用它登入。</p>
      </div>
      <Suspense fallback={<Skeleton className="h-52 rounded-2xl" />}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
