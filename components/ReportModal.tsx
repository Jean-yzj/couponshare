"use client";

import { useState } from "react";
import { apiFetch, ApiErr } from "@/lib/client";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
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
          <Button full variant="danger" loading={busy} icon="flag" onClick={submit}>
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
          <Banner tone="warn" icon="shield">
            同一帳號被 3 位以上使用者檢舉，將自動停權並下架其票券。請據實檢舉。
          </Banner>
          {error && <Banner tone="warn" icon="info">{error}</Banner>}
        </div>
      )}
    </Modal>
  );
}
