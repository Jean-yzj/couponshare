"use client";

import { useRef, useState } from "react";
import { fileToDataUri } from "@/lib/client-image";
import { Icon } from "@/components/icons";

// File → downscaled JPEG data-URI, with preview + remove. Used for brand logo and
// coupon images. Square-ish preview; the caller decides display shape elsewhere.
export function ImagePicker({
  value,
  onChange,
  hint,
  maxSide = 960,
}: {
  value: string | null;
  onChange: (dataUri: string | null) => void;
  hint?: string;
  maxSide?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToDataUri(file, maxSide));
    } catch {
      /* ignore decode errors */
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line bg-canvas text-ink-faint">
            <Icon name="image" size={20} />
          </div>
        )}
        <div className="flex flex-col items-start gap-1.5">
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-accent/40 hover:text-ink disabled:opacity-50"
          >
            {busy ? "處理中…" : value ? "更換圖片" : "上傳圖片"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="text-xs text-ink-faint hover:text-danger">
              移除圖片
            </button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
