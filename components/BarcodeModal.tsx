"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiErr } from "@/lib/client";
import { Modal } from "./Modal";
import { Button, Spinner, Banner } from "./ui";

export function BarcodeModal({
  couponId,
  open,
  onClose,
}: {
  couponId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUrl(null);
    try {
      const r = await apiFetch<{ barcode_url: string; expires_in_seconds: number }>(
        `/api/v1/coupons/${couponId}/barcode`,
      );
      setUrl(r.barcode_url);
      setExpiresIn(r.expires_in_seconds);
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "無法取得條碼");
    } finally {
      setLoading(false);
    }
  }, [couponId]);

  useEffect(() => {
    if (open) load();
    else {
      setUrl(null);
      setExpiresIn(0);
    }
  }, [open, load]);

  useEffect(() => {
    if (!open || !url) return;
    const t = setInterval(() => setExpiresIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [open, url]);

  const expired = !!url && expiresIn <= 0;

  return (
    <Modal open={open} onClose={onClose} title="票券條碼" size="sm">
      <Banner tone="warn" icon="shield">
        此條碼僅供你本次兌換使用，請勿截圖或轉傳給他人。
      </Banner>

      <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl border border-line bg-white p-4">
        {loading ? (
          <Spinner size={28} className="text-accent" />
        ) : error ? (
          <div className="text-center">
            <p className="text-sm text-accent-press">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={load}>
              重試
            </Button>
          </div>
        ) : url && !expired ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="票券條碼" className="max-h-64 w-auto" />
        ) : expired ? (
          <div className="text-center">
            <p className="text-sm text-ink-soft">安全連結已過期</p>
            <Button size="sm" variant="outline" className="mt-3" icon="lock" onClick={load}>
              重新取得
            </Button>
          </div>
        ) : null}
      </div>

      {url && !expired && (
        <p className="mt-3 text-center text-xs text-ink-faint">
          安全連結將在 <span className="font-semibold text-ink-soft">{expiresIn}s</span> 後失效
        </p>
      )}
    </Modal>
  );
}
