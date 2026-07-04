"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, useApi, ApiErr } from "@/lib/client";
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  Banner,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { CATEGORIES, REDEEM_KINDS } from "@/lib/categories";
import { cn } from "@/lib/display";

type Detail = {
  id: string;
  title: string;
  brand: string;
  category?: string | null;
  redeem_kind?: string | null;
  description: string | null;
  type: string;
  exchange_target: string | null;
  expiry_date: string | null;
  status: string;
  is_owner: boolean;
};

// ISO timestamp -> value for <input type="date"> in the user's zone.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function EditCouponPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: coupon, loading } = useApi<Detail>(`/api/v1/coupons/${id}`);

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [redeemKind, setRedeemKind] = useState("");
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [exchangeTarget, setExchangeTarget] = useState("");
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!coupon || seeded.current) return;
    seeded.current = true;
    setTitle(coupon.title);
    setBrand(coupon.brand);
    setCategory(coupon.category ?? "OTHER");
    setRedeemKind(coupon.redeem_kind ?? "");
    setDescription(coupon.description ?? "");
    setExpiry(coupon.expiry_date ? toLocalInput(coupon.expiry_date) : "");
    setNoExpiry(!coupon.expiry_date);
    setExchangeTarget(coupon.exchange_target ?? "");
  }, [coupon]);

  if (loading) return <Skeleton className="mx-auto h-72 max-w-2xl rounded-3xl" />;

  const editable = coupon?.is_owner && ["DRAFT", "AVAILABLE", "PENDING"].includes(coupon.status);
  if (!coupon || !editable) {
    return (
      <div className="py-10">
        <EmptyState
          icon="ticket"
          title={!coupon ? "找不到這張票券" : "這張票券無法編輯"}
          hint={coupon ? "只有還沒送出的票券可以由持有者編輯。" : undefined}
          action={
            <Button href={coupon ? `/coupons/${id}` : "/"} variant="outline">
              返回
            </Button>
          }
        />
      </div>
    );
  }

  async function save() {
    if (!title.trim() || !brand.trim()) {
      setError("標題和品牌不能空白");
      return;
    }
    if (!noExpiry && !expiry) {
      setError("請選擇到期日，或勾選「沒有使用期限」");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/coupons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          brand: brand.trim(),
          category,
          redeem_kind: redeemKind || undefined,
          description: description.trim() || null,
          expiry_date: noExpiry ? null : new Date(expiry + "T23:59:59").toISOString(),
          ...(coupon!.type === "EXCHANGE" && { exchange_target: exchangeTarget.trim() || null }),
        }),
      });
      if (barcodeFile) {
        const fd = new FormData();
        fd.append("file", barcodeFile);
        await apiFetch(`/api/v1/coupons/${id}/barcode`, { method: "POST", body: fd });
      }
      router.push(`/coupons/${id}`);
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "儲存失敗，請稍後再試");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} />
        返回
      </button>

      <h1 className="text-2xl font-extrabold tracking-tight text-ink">編輯票券資料</h1>
      <p className="mt-1 text-sm text-ink-soft">
        修正打錯的資訊。票券送出後就不能再編輯了。
      </p>

      <div className="mt-5 space-y-5">
        <Card className="space-y-4 p-5">
          <Field label="標題" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="品牌" required>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </Field>
            <Field label="分類" required>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">券內容</p>
            <div className="grid grid-cols-2 gap-2">
              {REDEEM_KINDS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRedeemKind(r.key)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                    redeemKind === r.key
                      ? "border-transparent bg-grad-brand text-white shadow-glow"
                      : "border-line bg-paper text-ink-soft hover:bg-canvas-2",
                  )}
                >
                  <span className="text-sm font-semibold">{r.label}</span>
                  <span
                    className={cn(
                      "text-[11px] leading-tight",
                      redeemKind === r.key ? "text-white/85" : "text-ink-faint",
                    )}
                  >
                    {r.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Field label="到期日">
            <Input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={noExpiry}
              className={cn(noExpiry && "opacity-50")}
            />
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={noExpiry}
                onChange={(e) => setNoExpiry(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              這張券沒有使用期限
            </label>
          </Field>
          {coupon.type === "EXCHANGE" && (
            <Field label="想交換什麼" hint="例如：全家中杯拿鐵、超商購物金">
              <Input value={exchangeTarget} onChange={(e) => setExchangeTarget(e.target.value)} />
            </Field>
          )}
          <Field label="說明（選填）">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="使用方式、注意事項…"
            />
          </Field>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-ink">更換條碼圖片（選填）</p>
          <p className="mt-1 text-xs text-ink-soft">
            上傳錯圖片才需要更換；不選就保留原本的條碼。
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setBarcodeFile(e.target.files?.[0] ?? null)}
            className="mt-3 block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-accent-tint file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-press"
          />
          {barcodeFile && (
            <p className="mt-2 text-xs font-medium text-pine">
              已選擇：{barcodeFile.name}（儲存後生效）
            </p>
          )}
        </Card>

        {error && (
          <Banner tone="warn" icon="info">
            {error}
          </Banner>
        )}

        <div className="flex gap-2">
          <Button full size="lg" icon="check" loading={busy} onClick={save}>
            儲存變更
          </Button>
          <Button variant="ghost" size="lg" disabled={busy} href={`/coupons/${id}`}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
