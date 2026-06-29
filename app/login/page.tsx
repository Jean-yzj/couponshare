"use client";

import { useState } from "react";
import { apiFetch, useApi, ApiErr } from "@/lib/client";
import { Button, Card, Field, Input, Avatar, Banner, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";

type DemoUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  level_name: string;
  contribution_score: number;
  email: string;
};

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: demo } = useApi<{ data: DemoUser[] }>("/api/v1/auth/demo");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await apiFetch("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      } else {
        await apiFetch("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, display_name: displayName }),
        });
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ApiErr ? err.message : "發生錯誤");
      setBusy(false);
    }
  }

  async function demoLogin(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/demo", { method: "POST", body: JSON.stringify({ user_id: id }) });
      window.location.href = "/";
    } catch {
      setError("登入失敗，請稍後再試");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-soft">
          <Icon name="ticket" size={26} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink">歡迎來到 CouponShare</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          登入即可分享票券、申請領取，並累積你的貢獻值。
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-sand/70 p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "rounded-full py-2 text-sm font-medium transition-colors",
                mode === m ? "bg-paper text-ink shadow-soft" : "text-ink-soft",
              )}
            >
              {m === "login" ? "登入" : "註冊"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <Field label="顯示名稱" required>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="想讓大家怎麼稱呼你？"
                required
              />
            </Field>
          )}
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field label="密碼" required hint={mode === "register" ? "至少 6 個字元" : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          {error && <Banner tone="warn" icon="info">{error}</Banner>}

          <Button type="submit" full size="lg" loading={busy}>
            {mode === "login" ? "登入" : "建立帳號"}
          </Button>
        </form>
      </Card>

      {/* Demo personas */}
      <div className="mt-7">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium text-ink-faint">或一鍵體驗 Demo 帳號</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {!demo ? (
          <div className="flex justify-center py-4">
            <Spinner className="text-ink-faint" />
          </div>
        ) : (
          <div className="space-y-2">
            {demo.data.map((u) => (
              <button
                key={u.id}
                onClick={() => demoLogin(u.id)}
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left shadow-soft transition-colors hover:border-sand-2 hover:bg-canvas-2 disabled:opacity-50"
              >
                <Avatar name={u.display_name} url={u.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{u.display_name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {u.level_name} · {u.contribution_score} 貢獻分
                  </p>
                </div>
                <Icon name="chevronRight" size={18} className="text-ink-faint" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
