"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, useMe, ApiErr } from "@/lib/client";
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Select,
  Banner,
  NeedLogin,
  Spinner,
  PageHeader,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";
import { CATEGORIES, REDEEM_KINDS } from "@/lib/categories";
import { brandsForCategory, ALL_BRAND_NAMES, normalizeBrand } from "@/lib/brands";

// YYYY-MM-DD in the user's zone, for <input type="date">.
function defaultExpiry(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function NewCouponPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [redeemKind, setRedeemKind] = useState("");
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [noExpiry, setNoExpiry] = useState(false);
  const [type, setType] = useState<"GIFT" | "EXCHANGE">("GIFT");
  const [giveToFirstApplicant, setGiveToFirstApplicant] = useState(false);
  const [exchangeTarget, setExchangeTarget] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [agreed, setAgreed] = useState(false);
  const [redeemMethod, setRedeemMethod] = useState<"image" | "code">("image");
  const [redeemCode, setRedeemCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const draftId = useRef<string | null>(null);
  const uploaded = useRef(false);
  const [busy, setBusy] = useState(false);
  const [stepText, setStepText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-ink-faint" />
      </div>
    );
  }
  if (!me) return <NeedLogin message="登入後即可上傳並分享你的優惠券。" />;

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    uploaded.current = false;
  }

  function validate(): string | null {
    if (redeemMethod === "image" && !file) return "請上傳條碼或 QR Code 圖片";
    if (redeemMethod === "code" && !redeemCode.trim()) return "請填寫兌換碼";
    if (!title.trim()) return "請填寫標題";
    if (!brand.trim()) return "請填寫品牌";
    if (!category) return "請選擇分類";
    if (!redeemKind) return "請選擇券內容（免費兌換或折價券）";
    if (!noExpiry && (!expiry || new Date(expiry + "T23:59:59").getTime() <= Date.now())) return "到期日必須晚於今天";
    if (type === "EXCHANGE" && !exchangeTarget.trim()) return "交換類型必須填寫想交換的目標";
    if (!agreed) return "請先勾選確認這是可直接兌換的票券";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!draftId.current) {
        setStepText("建立票券中…");
        const created = await apiFetch<{ id: string }>("/api/v1/coupons", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            brand: brand.trim(),
            category,
            redeem_kind: redeemKind,
            redeem_code: redeemMethod === "code" ? redeemCode.trim() : null,
            description: description.trim() || null,
            expiry_date: noExpiry ? null : new Date(expiry + "T23:59:59").toISOString(),
            type,
            exchange_target: type === "EXCHANGE" ? exchangeTarget.trim() : null,
            unlock_policy:
              type === "GIFT" && giveToFirstApplicant
                ? "AUTO_REVEAL_AFTER_MESSAGE"
                : "OWNER_APPROVAL",
            directly_redeemable: true,
            visibility_level: visibility,
          }),
        });
        draftId.current = created.id;
      }
      if (redeemMethod === "image" && file && !uploaded.current) {
        setStepText("加密上傳條碼中…");
        const fd = new FormData();
        fd.append("file", file);
        await apiFetch(`/api/v1/coupons/${draftId.current}/barcode`, { method: "POST", body: fd });
        uploaded.current = true;
      }
      setStepText("上架中…");
      await apiFetch(`/api/v1/coupons/${draftId.current}/publish`, { method: "POST" });
      router.push(`/coupons/${draftId.current}`);
    } catch (err) {
      setError(err instanceof ApiErr ? err.message : "發生錯誤，請稍後再試");
      setBusy(false);
      setStepText("");
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

      <PageHeader
        eyebrow="New coupon"
        title="新增優惠券"
        subtitle="條碼會經 AES-256 加密保存，只有你選定的領取者才看得到。"
      />

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-pine/25 bg-pine-tint/40 p-3.5">
        <Icon name="heart" size={18} className="mt-0.5 shrink-0 text-pine" />
        <p className="text-sm leading-relaxed text-ink-soft">
          每成功分享一張券，當天就能
          <span className="font-bold text-ink">多獲得 3 次申請機會</span>
          ；第一次分享還會解鎖依等級計算的每日申請額度。給予讓好康流動起來。
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-5">
        <Banner tone="info" icon="shieldCheck">
          請分享<span className="font-semibold">可以直接兌換</span>的實質票券，例如飲料兌換券、超商購物金。
          請勿上架需要加好友或完成任務才能用的券，以及人人都有的通用折扣碼，讓好券不被淹沒。
          折扣類請<span className="font-semibold">寫清楚金額或內容</span>（如「折 50 元」「買一送一」）——
          <span className="font-semibold text-danger">沒寫明折扣金額、或優惠內容不夠具體的券，平台會直接刪除</span>。
        </Banner>

        {/* Redeem content: barcode image OR text code */}
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-1 text-sm font-medium text-ink">
            兌換方式<span className="text-accent">*</span>
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(
              [
                ["image", "條碼 / QR 圖片"],
                ["code", "文字兌換碼"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setRedeemMethod(m)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  redeemMethod === m
                    ? "border-transparent bg-grad-brand text-white shadow-glow"
                    : "border-line bg-paper text-ink-soft hover:bg-canvas-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {redeemMethod === "image" ? (
            preview ? (
              <div className="flex items-center gap-4">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="條碼預覽" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm text-pine">
                    <Icon name="check" size={16} /> 已選擇圖片
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    更換圖片
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-canvas/50 py-9 text-ink-soft transition-colors hover:border-accent hover:bg-accent-tint/40 hover:text-accent"
              >
                <Icon name="image" size={28} />
                <span className="text-sm font-medium">點此上傳條碼圖片</span>
                <span className="text-xs text-ink-faint">支援 JPG / PNG，上限 5MB</span>
              </button>
            )
          ) : (
            <div>
              <Input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="例如：STAR-2026-8H3K"
              />
              <p className="mt-2 text-xs text-ink-faint">
                只有被你選中的領取者看得到這組兌換碼，一樣會 AES 加密保存。
              </p>
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <Field label="標題" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：星巴克買一送一" />
          </Field>
          <Field label="分類" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">請選擇</option>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="品牌"
            required
            hint={category ? "點下方常用品牌，或直接輸入" : "選分類後會出現該類常用品牌"}
          >
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onBlur={(e) => setBrand(normalizeBrand(e.target.value))}
              list="brand-suggestions"
              placeholder="例如：星巴克"
            />
            <datalist id="brand-suggestions">
              {(category ? brandsForCategory(category) : ALL_BRAND_NAMES).map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            {category && brandsForCategory(category).length > 0 && (
              <div className="no-scrollbar mt-2 flex flex-wrap gap-1.5">
                {brandsForCategory(category).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(b)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      brand === b
                        ? "border-transparent bg-accent text-white"
                        : "border-line bg-paper text-ink-soft hover:bg-sand",
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">
              券內容<span className="text-accent">*</span>
            </p>
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

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">分享類型</p>
            <div className="grid grid-cols-2 gap-2">
              {(["GIFT", "EXCHANGE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all",
                    type === t
                      ? "border-transparent bg-grad-brand text-white shadow-glow"
                      : "border-line bg-paper text-ink-soft hover:bg-canvas-2",
                  )}
                >
                  <Icon name={t === "GIFT" ? "gift" : "swap"} size={17} />
                  {t === "GIFT" ? "免費贈送" : "交換"}
                </button>
              ))}
            </div>
          </div>

          {type === "EXCHANGE" && (
            <Field label="想交換的目標" required>
              <Input
                value={exchangeTarget}
                onChange={(e) => setExchangeTarget(e.target.value)}
                placeholder="例如：想換一杯手搖飲折價券"
              />
            </Field>
          )}

          {type === "GIFT" && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-canvas/50 p-4">
              <input
                type="checkbox"
                checked={giveToFirstApplicant}
                onChange={(e) => setGiveToFirstApplicant(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="text-sm leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">送給第一個申請的人</span>
                ，有人送出申請後會自動取得票券，不需要你再手動挑選。
              </span>
            </label>
          )}

          <Field label="使用限制 / 備註">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：限本週使用、需內用、限指定門市…"
            />
          </Field>

          <Field label="可見範圍" hint="可限制較高等級的會員才能看到與申請">
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="PUBLIC">公開（所有人）</option>
              <option value="LEVEL_2_ONLY">達人以上</option>
              <option value="LEVEL_3_ONLY">傳奇限定</option>
            </Select>
          </Field>
        </Card>

        {/* Attestation */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper p-4 shadow-soft">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="text-sm leading-relaxed text-ink-soft">
            我確認這是<span className="font-semibold text-ink">可以直接兌換</span>的票券，
            不需要對方加好友或完成任何任務，且內容真實有效。
          </span>
        </label>

        {error && <Banner tone="warn" icon="info">{error}</Banner>}

        <div className="flex items-center justify-end gap-3">
          {busy && stepText && <span className="text-sm text-ink-soft">{stepText}</span>}
          <Button type="submit" size="lg" icon="ticket" loading={busy}>
            上架優惠券
          </Button>
        </div>
      </form>
    </div>
  );
}
