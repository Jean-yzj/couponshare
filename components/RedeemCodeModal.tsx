"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiErr } from "@/lib/client";
import { Modal } from "./Modal";
import { Button, Spinner, Banner } from "./ui";

// Shows the decrypted text redeem code to an authorized viewer (owner or the
// chosen claimant). Fetches on open; the code is never in the feed payload.
export function RedeemCodeModal({
  couponId,
  owned = false,
  open,
  onClose,
}: {
  couponId: string;
  // The viewer owns this code outright (their own coupon, or a received gift).
  owned?: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCode(null);
    setCopied(false);
    setLoading(true);
    apiFetch<{ code: string }>(`/api/v1/coupons/${couponId}/redeem-code`)
      .then((r) => setCode(r.code))
      .catch((e) => setError(e instanceof ApiErr ? e.message : "無法取得兌換碼"))
      .finally(() => setLoading(false));
  }, [open, couponId]);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable (insecure context / permission) — user can long-press */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="兌換碼" size="sm">
      {owned ? (
        <Banner tone="success" icon="checkCircle">
          這組兌換碼已經是你的了，結帳時輸入或出示給店員即可。
        </Banner>
      ) : (
        <Banner tone="warn" icon="shield">
          此兌換碼僅供你本次兌換使用，請勿轉傳給他人。
        </Banner>
      )}

      <div className="mt-4 flex min-h-32 items-center justify-center rounded-2xl border border-accent/15 bg-white p-5 ring-4 ring-accent/5">
        {loading && <Spinner size={28} className="text-accent" />}
        {error && !loading && <p className="text-center text-sm text-accent-press">{error}</p>}
        {code && !loading && !error && (
          <p className="select-all break-all text-center text-2xl font-extrabold tracking-wide text-ink">
            {code}
          </p>
        )}
      </div>

      {code && !loading && !error && (
        <Button full className="mt-3" icon={copied ? "check" : "ticket"} onClick={copy}>
          {copied ? "已複製" : "複製兌換碼"}
        </Button>
      )}
    </Modal>
  );
}
