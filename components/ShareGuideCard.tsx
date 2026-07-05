"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client";
import { Icon } from "@/components/icons";

// localStorage keys
const KEY_DISMISSED_AT = "cs-share-guide-dismissed-at";
const KEY_TIMES = "cs-share-guide-times";

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const times = Number(localStorage.getItem(KEY_TIMES) ?? "0");
    if (times >= 2) return false; // permanently hidden after 2nd close

    const dismissedAt = localStorage.getItem(KEY_DISMISSED_AT);
    if (!dismissedAt) return true; // never dismissed — show first time

    // Second chance: only after 7 days
    const elapsed = Date.now() - Number(dismissedAt);
    return elapsed >= 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function recordDismiss(): void {
  if (typeof window === "undefined") return;
  try {
    const times = Number(localStorage.getItem(KEY_TIMES) ?? "0") + 1;
    localStorage.setItem(KEY_TIMES, String(times));
    localStorage.setItem(KEY_DISMISSED_AT, String(Date.now()));
  } catch {
    /* storage unavailable — degrade silently */
  }
}

export function ShareGuideCard({ hasShared }: { hasShared: boolean }) {
  const [visible, setVisible] = useState(false);
  const firedRef = { current: false };

  useEffect(() => {
    // SSR-safe: evaluate after hydration.
    if (hasShared) return;
    if (!shouldShow()) return;
    setVisible(true);

    // Fire-and-forget埋點 (只記一次 guide.shown per user, server enforces idempotency).
    if (!firedRef.current) {
      firedRef.current = true;
      apiFetch("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({ type: "guide_shown" }),
      }).catch(() => {
        /* silent */
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShared]);

  if (!visible) return null;

  function dismiss() {
    recordDismiss();
    setVisible(false);
  }

  return (
    <div className="relative mb-6 rounded-2xl border border-accent/25 bg-accent-tint px-5 py-4 shadow-soft">
      {/* Close button */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="關閉引導"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-accent/60 transition-colors hover:bg-accent/10 hover:text-accent-press"
      >
        <Icon name="x" size={15} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon name="share" size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">收過別人的善意嗎？</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
            把你用不到的券也放上來，讓好康繼續流動。
          </p>
          <Link
            href="/new?src=guide"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-105 active:brightness-95"
          >
            <Icon name="plus" size={15} />
            分享一張券
          </Link>
        </div>
      </div>
    </div>
  );
}
