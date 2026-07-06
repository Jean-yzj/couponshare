"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiErr } from "@/lib/client";
import { cn, formatDate } from "@/lib/display";
import { Modal } from "./Modal";
import { Button, Spinner, Banner } from "./ui";
import { Icon } from "./icons";

export function BarcodeModal({
  couponId,
  endpoint,
  title,
  owned = false,
  expiry,
  open,
  onClose,
}: {
  couponId?: string;
  endpoint?: string;
  title?: string;
  // The viewer owns this coupon outright (a received gift, or their own coupon).
  // Show it as a plain, keepable ticket instead of a self-destructing barcode.
  owned?: boolean;
  // The giver's expiry date (raw ISO). null = no expiry; undefined = don't show.
  // Surfaced here because this is the point of use — the recipient needs to know
  // how long the ticket is good for while they're at the counter.
  expiry?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  // Single-hop, cookie-authenticated image when we have a couponId — the browser
  // starts downloading the instant the modal opens (no "issue signed URL" pre-fetch),
  // so a received ticket shows up immediately instead of lagging behind two requests.
  const directSrc = couponId ? `/api/v1/coupons/${couponId}/barcode/image` : null;

  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Self-heal transient image load failures (a flaky hop, a heavy screenshot that
  // got interrupted) by silently re-fetching a couple of times before showing the
  // manual retry. The endpoint + data are sound; the failure is almost always the
  // network, so an automatic retry usually recovers without the user noticing.
  const autoRetries = useRef(0);
  const MAX_AUTO_RETRIES = 2;

  // Exchange offer-barcode path (transactions) still resolves a signed URL first,
  // and silently re-issues it ~20s before expiry so it never blanks at the till.
  const loadViaToken = useCallback(async () => {
    if (!endpoint) return;
    setError(null);
    try {
      const r = await apiFetch<{ barcode_url: string; expires_in_seconds: number }>(endpoint);
      setUrl(r.barcode_url);
      if (timer.current) clearTimeout(timer.current);
      const refreshMs = Math.max(15, (r.expires_in_seconds || 300) - 20) * 1000;
      timer.current = setTimeout(() => void loadViaToken(), refreshMs);
    } catch (e) {
      setLoading(false);
      setError(e instanceof ApiErr ? e.message : "無法取得票券圖片");
    }
  }, [endpoint]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    autoRetries.current = 0;
    if (directSrc) {
      setUrl(nonce ? `${directSrc}?r=${nonce}` : directSrc);
    } else if (endpoint) {
      setUrl(null);
      void loadViaToken();
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, directSrc, endpoint, loadViaToken, nonce]);

  function retry() {
    setError(null);
    setLoading(true);
    if (directSrc) setNonce((n) => n + 1);
    else void loadViaToken();
  }

  const heading = title ?? (owned ? "你的票券" : "票券條碼");

  return (
    <Modal open={open} onClose={onClose} title={heading} size="sm">
      {owned ? (
        <Banner tone="success" icon="checkCircle">
          這張券已經是你的了！結帳時把畫面出示給店員即可，也可以直接截圖保存。
        </Banner>
      ) : (
        <Banner tone="warn" icon="shield">
          此條碼僅供你本次兌換使用，請勿截圖或轉傳給他人。
        </Banner>
      )}

      <div className="relative mt-4 flex min-h-60 items-center justify-center overflow-hidden rounded-2xl border border-accent/15 bg-white p-4 ring-4 ring-accent/5">
        {url && !error && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="票券圖片"
            className={cn("max-h-72 w-auto rounded-lg transition-opacity duration-200", loading && "opacity-0")}
            onLoad={() => setLoading(false)}
            onError={() => {
              // Retry a couple of times automatically (cache-busting each time)
              // before surfacing the manual retry — most failures are a transient
              // network blip on the heavy image and recover on the next attempt.
              if (directSrc && autoRetries.current < MAX_AUTO_RETRIES) {
                autoRetries.current += 1;
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setNonce((n) => n + 1), 600);
                return;
              }
              setLoading(false);
              setError("無法載入票券圖片");
            }}
          />
        )}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size={28} className="text-accent" />
          </div>
        )}
        {error && (
          <div className="text-center">
            <p className="text-sm text-accent-press">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={retry}>
              重試
            </Button>
          </div>
        )}
      </div>

      {expiry !== undefined && (
        <p
          className={cn(
            "mt-3 flex items-center justify-center gap-1.5 text-center text-sm font-semibold",
            expiry && new Date(expiry).getTime() <= Date.now() ? "text-danger" : "text-ink",
          )}
        >
          <Icon name="clock" size={14} className="text-ink-faint" />
          {expiry ? `使用期限：${formatDate(expiry)}` : "無使用期限"}
        </p>
      )}

      {url && !error && !loading && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <Icon name={owned ? "heart" : "shield"} size={13} />
          {owned
            ? "兌換後別忘了回來給對方留下評價與感謝。"
            : "畫面會自動保持有效，安心兌換即可。"}
        </p>
      )}
    </Modal>
  );
}
