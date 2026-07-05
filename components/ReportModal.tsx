"use client";

import { useRef, useState } from "react";
import { apiFetch, ApiErr } from "@/lib/client";
import { fileToDataUri } from "@/lib/client-image";
import { Modal } from "./Modal";
import { Button, Field, Textarea, Select, Banner } from "./ui";
import { Icon } from "./icons";

const REASONS = [
  { value: "INVALID_COUPON", label: "無效券 / 無法使用" },
  { value: "EXPIRED_COUPON", label: "已過期" },
  { value: "ALREADY_USED", label: "已被使用" },
  { value: "UNREASONABLE_EXCHANGE", label: "不合理的交換要求" },
  { value: "NO_RESPONSE", label: "持有者無回應 / 放鳥" },
  { value: "ABUSIVE_MESSAGE", label: "不當訊息 / 騷擾" },
  { value: "SCAM", label: "詐騙" },
  { value: "OTHER", label: "其他" },
];

export function ReportModal({
  open,
  onClose,
  couponId,
  reportedUserId,
  onDone,
  title = "檢舉",
}: {
  open: boolean;
  onClose: () => void;
  couponId?: string;
  reportedUserId?: string;
  onDone: () => void;
  title?: string;
}) {
  const [reason, setReason] = useState(reportedUserId ? "NO_RESPONSE" : "INVALID_COUPON");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reporting a coupon needs proof — this is the abuse we're closing (reporting a
  // coupon "invalid" without ever having claimed it). User reports (no-show etc.)
  // can't always be screenshotted, so proof stays optional there.
  const requireImage = !!couponId;
  const canSubmit = acknowledged && (!requireImage || !!image);

  async function pickImage(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("請選擇圖片檔");
      return;
    }
    try {
      setImage(await fileToDataUri(f));
      setError(null);
    } catch {
      setError("圖片處理失敗，請換一張");
    }
  }

  async function submit() {
    if (requireImage && !image) {
      setError("檢舉票券請先附上證明截圖");
      return;
    }
    if (!acknowledged) {
      setError("請先勾選「我願意為這次檢舉負責」");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({
          coupon_id: couponId ?? null,
          reported_user_id: reportedUserId ?? null,
          reason,
          description: description.trim() || null,
          evidence_image_url: image,
          acknowledged: true,
        }),
      });
      setDone(true);
      setTimeout(onDone, 1400);
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "檢舉失敗");
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        !done && (
          <Button
            full
            variant="danger"
            loading={busy}
            icon="flag"
            onClick={submit}
            disabled={!canSubmit}
          >
            送出檢舉
          </Button>
        )
      }
    >
      {done ? (
        <div className="py-6 text-center">
          <Icon name="check" size={32} className="mx-auto text-pine" />
          <p className="mt-2 font-medium text-ink">已收到你的檢舉</p>
          <p className="text-sm text-ink-soft">我們會盡快處理，謝謝你維護社群。</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="檢舉原因" required>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="補充說明">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：到店顯示已被兌換 / 對方要求的交換很不合理 / 約好卻已讀不回"
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">
              證據截圖{requireImage ? "（必附）" : "（選填）"}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
            {image ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="證據截圖" className="max-h-44 rounded-xl border border-line" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  aria-label="移除圖片"
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shadow-soft"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-canvas/50 py-4 text-sm text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                <Icon name="image" size={18} /> 上傳截圖（例如：到店顯示已使用、對話紀錄）
              </button>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-canvas/50 p-3">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-danger"
            />
            <span className="text-sm leading-relaxed text-ink-soft">
              我確認以上內容屬實、願意為這次檢舉負責。我了解
              <span className="font-semibold text-ink">惡意或不實的檢舉一經查證，累積 3 次帳號將被停權</span>。
            </span>
          </label>
          <Banner tone="warn" icon="shield">
            檢舉會送平台人工複核。請據實檢舉，不要用來報復或干擾他人。
          </Banner>
          {error && <Banner tone="warn" icon="info">{error}</Banner>}
        </div>
      )}
    </Modal>
  );
}
