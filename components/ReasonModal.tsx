"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Button, Textarea } from "./ui";

// Reusable admin reason picker: quick-pick preset chips fill an editable textarea, so
// common dismiss / reject reasons are one tap but still customisable. Used by every
// admin action that attaches a reason (reports, social posts, appeals).
export function ReasonModal({
  open,
  title,
  hint,
  presets,
  confirmLabel = "送出",
  confirmVariant = "primary",
  busy = false,
  requireReason = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  hint?: string;
  presets: string[];
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger" | "outline";
  busy?: boolean;
  requireReason?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" full onClick={onCancel}>
            取消
          </Button>
          <Button
            variant={confirmVariant}
            full
            loading={busy}
            disabled={requireReason && !text.trim()}
            onClick={() => onConfirm(text.trim())}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {hint && <p className="mb-3 text-sm text-ink-soft">{hint}</p>}
      {presets.length > 0 && (
        <>
          <p className="mb-1.5 text-xs font-medium text-ink-faint">快速選擇常見理由</p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setText(p)}
                className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mt-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={requireReason ? "點上方常見理由帶入，或自行輸入…" : "點上方常見理由帶入，或自行輸入…（可留空）"}
        />
      </div>
    </Modal>
  );
}
