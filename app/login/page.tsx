"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiErr } from "@/lib/client";
import { Button, Card, Field, Input, Banner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.7-9.9 6.7-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.7-3.7-13.6-9.9l-7.9 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

// Google's OAuth blocks embedded in-app browsers (disallowed_useragent). Detect
// the common ones so we can nudge the user into Safari / Chrome.
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Messenger|Twitter|TikTok|musical_ly|KAKAOTALK|Snapchat|Threads|LinkedInApp/i.test(ua)) return true;
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) return true;
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return true;
  return false;
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
    const err = new URLSearchParams(window.location.search).get("error");
    if (err === "google_not_configured") setError("Google 登入尚未設定，請改用 Email 註冊或登入");
    else if (err === "google_failed") setError("Google 登入失敗，請再試一次");
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/login");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-grad-brand text-white shadow-glow">
          <Icon name="ticket" size={26} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink">歡迎來到 CouponShare</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          登入即可分享票券、申請領取，並累積你的貢獻值。
        </p>
      </div>

      <Card className="p-5">
        {inApp && (
          <div className="mb-4">
            <Banner tone="warn" icon="info">
              <div className="space-y-2">
                <p>
                  你正在 App 的內建瀏覽器，Google 會擋下登入。請改用
                  <span className="font-semibold"> Safari </span>或
                  <span className="font-semibold"> Chrome </span>
                  開啟（右上角「⋯」→ 用瀏覽器開啟），或複製網址貼到瀏覽器：
                </p>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 rounded-full bg-danger px-3 py-1.5 text-xs font-medium text-white"
                >
                  {copied ? (
                    <>
                      <Icon name="check" size={13} /> 已複製
                    </>
                  ) : (
                    "複製網址"
                  )}
                </button>
              </div>
            </Banner>
          </div>
        )}
        <button
          onClick={() => {
            window.location.href = "/api/v1/auth/google";
          }}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-paper py-2.5 text-[15px] font-medium text-ink transition-colors hover:bg-canvas-2"
        >
          <GoogleG />
          使用 Google 繼續
        </button>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-faint">或用 Email</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-sand p-1">
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

      <p className="mt-5 text-center text-xs leading-relaxed text-ink-faint">
        繼續使用即表示你已閱讀並同意我們的{" "}
        <Link href="/terms" className="font-medium text-accent hover:text-accent-press">
          使用條款
        </Link>{" "}
        與{" "}
        <Link href="/privacy" className="font-medium text-accent hover:text-accent-press">
          隱私權政策
        </Link>
        。
      </p>
    </div>
  );
}
