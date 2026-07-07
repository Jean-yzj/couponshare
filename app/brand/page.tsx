"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Field, Input, Textarea, Skeleton, EmptyState, NeedLogin, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ImagePicker } from "@/components/ImagePicker";
import { cn, relativeTime } from "@/lib/display";

type Coupon = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  redeem_info: string | null;
  image_url: string | null;
  application_mode: string;
  task_instruction: string | null;
  task_url: string | null;
  status: string;
  max_applications: number;
  application_count: number;
  view_count: number;
  total_applications: number;
  claimed_count: number;
  cta_text: string | null;
  cta_url: string | null;
};
type BrandBrief = { id: string; name: string; logo_text: string | null; category: string | null };
type Brand = {
  id: string;
  name: string;
  logo_text: string | null;
  logo_url: string | null;
  category: string | null;
  description: string | null;
  plan: string;
};
type OwnerData = { brands: BrandBrief[]; brand: Brand | null; coupons: Coupon[] };
type Application = { id: string; display_name: string; message: string | null; status: string; created_at: string };

const STATUS_LABEL: Record<string, string> = { DRAFT: "草稿", ACTIVE: "進行中", PAUSED: "已暫停", ENDED: "已結束" };
const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-pine-tint text-pine",
  PAUSED: "bg-gold-tint text-gold",
  ENDED: "bg-sand text-ink-faint",
  DRAFT: "bg-sand text-ink-faint",
};
const APP_LABEL: Record<string, string> = { PENDING: "審核中", CLAIMED: "已領取", APPROVED: "已通過", REJECTED: "未通過" };
const MODE_LABEL: Record<string, string> = { DIRECT_CLAIM: "直接領取", MESSAGE_APPLICATION: "留言申請", TASK_UNLOCK: "任務解鎖" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-canvas px-2 py-2 text-center">
      <p className="font-display text-lg font-extrabold tabular-nums text-ink">{value.toLocaleString("en-US")}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}

// Shared create / edit coupon form.
function CouponForm({
  brandId,
  plan,
  coupon,
  onDone,
  onCancel,
}: {
  brandId: string;
  plan: string;
  coupon: Coupon | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(coupon?.title ?? "");
  const [image, setImage] = useState<string | null>(coupon?.image_url ?? null);
  const [mode, setMode] = useState(coupon?.application_mode ?? "DIRECT_CLAIM");
  const [taskText, setTaskText] = useState(coupon?.task_instruction ?? "");
  const [taskUrl, setTaskUrl] = useState(coupon?.task_url ?? "");
  const [max, setMax] = useState(String(coupon?.max_applications ?? 100));
  const [redeem, setRedeem] = useState(coupon?.redeem_info ?? "");
  const [ctaText, setCtaText] = useState(coupon?.cta_text ?? "");
  const [ctaUrl, setCtaUrl] = useState(coupon?.cta_url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (title.trim().length < 2) {
      setErr("請填券標題");
      return;
    }
    setBusy(true);
    setErr(null);
    const payload = {
      title: title.trim(),
      image_url: image || undefined,
      application_mode: mode,
      task_instruction: mode === "TASK_UNLOCK" ? taskText.trim() || undefined : undefined,
      task_url: mode === "TASK_UNLOCK" ? taskUrl.trim() || undefined : undefined,
      max_applications: Math.max(1, parseInt(max, 10) || 100),
      max_per_user: 1,
      redeem_info: redeem.trim() || undefined,
      cta_text: ctaText.trim() || undefined,
      cta_url: ctaUrl.trim() || undefined,
    };
    try {
      const url = coupon ? `/api/v1/brand/coupons/${coupon.id}` : `/api/v1/brand/${brandId}/coupons`;
      await apiFetch(url, { method: "POST", body: JSON.stringify(payload) });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-3 space-y-4 p-4">
      <Field label="券圖片" hint="會顯示在券卡與詳情頁；建議正方形或 4:3">
        <ImagePicker value={image} onChange={setImage} />
      </Field>
      <Field label="券標題" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：中杯拿鐵買一送一" maxLength={60} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="領取方式">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
          >
            <option value="DIRECT_CLAIM">直接領取</option>
            <option value="MESSAGE_APPLICATION">留言申請（你審核）</option>
            {plan === "MAX" && <option value="TASK_UNLOCK">任務解鎖（Max）</option>}
          </select>
        </Field>
        <Field label="總名額">
          <Input type="number" value={max} onChange={(e) => setMax(e.target.value)} min={1} />
        </Field>
      </div>

      {mode === "TASK_UNLOCK" && (
        <div className="space-y-3 rounded-xl border border-accent/20 bg-accent-tint/30 p-3">
          <p className="text-xs font-medium text-accent">任務解鎖：使用者要先完成任務才能領（榮譽制）</p>
          <Field label="任務說明">
            <Textarea value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="例如：追蹤我們的 IG @yourbrand，或填寫這份問卷" maxLength={300} />
          </Field>
          <Field label="任務連結（選填）">
            <Input value={taskUrl} onChange={(e) => setTaskUrl(e.target.value)} placeholder="https://…（問卷 / 社群頁）" />
          </Field>
        </div>
      )}

      <Field label="兌換方式說明" hint="使用者領到後才會看到">
        <Textarea value={redeem} onChange={(e) => setRedeem(e.target.value)} placeholder="例如：出示此頁面至指定門市，或輸入折扣碼 XXXX" maxLength={300} />
      </Field>

      <div className="rounded-xl border border-line bg-canvas/60 p-3">
        <p className="text-xs font-medium text-ink">領到券後的按鈕（選填）</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">
          使用者領到券後會看到一顆按鈕，用來把他導去「實際使用」的地方——例如「線上訂購」連到你的點餐頁、「立即預約」連到訂位頁。若你的券是到店出示這一頁，留空即可。
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="按鈕文字">
            <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="例如：線上訂購" maxLength={20} />
          </Field>
          <Field label="按鈕連結">
            <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </div>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2">
        <Button icon="check" loading={busy} onClick={submit}>{coupon ? "儲存變更" : "建立並上架"}</Button>
        <Button variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </Card>
  );
}

function CouponRow({ coupon, brandId, plan, onChanged }: { coupon: Coupon; brandId: string; plan: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: apps, loading, refetch } = useApi<{ data: Application[] }>(
    open ? `/api/v1/brand/coupons/${coupon.id}/applications` : null,
  );

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/brand/coupons/${coupon.id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      onChanged();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }
  async function decide(appId: string, decision: "APPROVE" | "REJECT") {
    try {
      await apiFetch(`/api/v1/brand/applications/${appId}`, { method: "POST", body: JSON.stringify({ decision }) });
      await refetch();
      onChanged();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    }
  }

  if (editing) {
    return <CouponForm brandId={brandId} plan={plan} coupon={coupon} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />;
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {coupon.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coupon.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{coupon.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">{MODE_LABEL[coupon.application_mode] ?? coupon.application_mode} · 每人限領 1 張</p>
        </div>
        <Pill className={STATUS_STYLE[coupon.status]}>{STATUS_LABEL[coupon.status] ?? coupon.status}</Pill>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Stat label="瀏覽" value={coupon.view_count} />
        <Stat label="申請" value={coupon.total_applications} />
        <Stat label="已領取" value={coupon.claimed_count} />
        <Stat label="剩餘名額" value={Math.max(0, coupon.max_applications - coupon.application_count)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" icon="edit" onClick={() => setEditing(true)}>編輯</Button>
        {coupon.status !== "ACTIVE" && <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus("ACTIVE")}>設為進行中</Button>}
        {coupon.status === "ACTIVE" && <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus("PAUSED")}>暫停</Button>}
        {coupon.status !== "ENDED" && <Button size="sm" variant="ghost" loading={busy} onClick={() => setStatus("ENDED")}>結束</Button>}
        <button onClick={() => setOpen((o) => !o)} className="ml-auto text-sm font-medium text-accent hover:text-accent-press">
          {open ? "收合申請名單" : `查看申請名單 (${coupon.total_applications})`}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {loading ? (
            <Skeleton className="h-12 rounded-xl" />
          ) : !apps || apps.data.length === 0 ? (
            <p className="py-2 text-center text-sm text-ink-faint">還沒有人申請這張券。</p>
          ) : (
            apps.data.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{a.display_name}</p>
                  {a.message && <p className="truncate text-xs text-ink-soft">「{a.message}」</p>}
                  <p className="text-[11px] text-ink-faint">{relativeTime(a.created_at)} · {APP_LABEL[a.status] ?? a.status}</p>
                </div>
                {a.status === "PENDING" && coupon.application_mode === "MESSAGE_APPLICATION" && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" onClick={() => decide(a.id, "APPROVE")}>通過</Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(a.id, "REJECT")}>婉拒</Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

function BrandEditForm({ brand, onDone, onCancel }: { brand: Brand; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(brand.name);
  const [category, setCategory] = useState(brand.category ?? "");
  const [logo, setLogo] = useState<string | null>(brand.logo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!name.trim()) { setErr("請填品牌名稱"); return; }
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/v1/brand/${brand.id}`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), category: category.trim() || undefined, logo_url: logo || undefined }),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-3 space-y-3 p-4">
      <Field label="品牌 Logo" hint="沒有就顯示名稱第一個字">
        <ImagePicker value={logo} onChange={setLogo} maxSide={400} />
      </Field>
      <Field label="品牌名稱" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </Field>
      <Field label="分類">
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="咖啡 / 甜點 / 超商…" maxLength={20} />
      </Field>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2">
        <Button icon="check" loading={busy} onClick={save}>儲存</Button>
        <Button variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </Card>
  );
}

export default function BrandOwnerPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<OwnerData>(me ? "/api/v1/brand/me" : null);
  const [newBrand, setNewBrand] = useState({ name: "", category: "" });
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (meLoading) return <div className="flex justify-center py-20"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  if (!me) return <NeedLogin message="登入後即可使用企業後台。" />;
  if (loading) return <div className="mx-auto max-w-2xl space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;

  if (!data || !data.brand) {
    async function createBrand() {
      if (!newBrand.name.trim()) { setErr("請填品牌名稱"); return; }
      setCreatingBrand(true);
      setErr(null);
      try {
        await apiFetch("/api/v1/brand", { method: "POST", body: JSON.stringify({ name: newBrand.name.trim(), category: newBrand.category.trim() || undefined }) });
        await refetch();
      } catch (e) {
        setErr(e instanceof ApiErr ? e.message : "建立失敗");
      } finally {
        setCreatingBrand(false);
      }
    }
    return (
      <div className="mx-auto max-w-md py-6">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-tint text-accent"><Icon name="ticket" size={26} /></span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">建立你的品牌後台</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">建立品牌後，你就能上架官方福利券、設定申請名額，並看到每張券的瀏覽、申請與領取數據。</p>
        </div>
        <Card className="mt-6 space-y-3 p-5">
          <Field label="品牌名稱" required>
            <Input value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} placeholder="例如：某某咖啡" maxLength={40} />
          </Field>
          <Field label="分類">
            <Input value={newBrand.category} onChange={(e) => setNewBrand({ ...newBrand, category: e.target.value })} placeholder="咖啡 / 甜點 / 超商…" maxLength={20} />
          </Field>
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button full size="lg" icon="plus" loading={creatingBrand} onClick={createBrand}>建立品牌後台</Button>
        </Card>
      </div>
    );
  }

  const { brand, brands, coupons } = data;

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="flex items-center gap-4 p-5">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-line object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-tint text-xl font-extrabold text-accent">
            {brand.logo_text || brand.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{brand.name}</h1>
            <Pill className="bg-accent-tint text-accent">企業後台</Pill>
            <Pill className={brand.plan === "MAX" ? "bg-grape-tint text-grape" : "bg-sand text-ink-soft"}>{brand.plan} 方案</Pill>
          </div>
          <p className="text-xs text-ink-faint">{brand.category || "未分類"} · 你管理的品牌</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button size="sm" variant="outline" icon="edit" onClick={() => setEditingBrand((v) => !v)}>{editingBrand ? "取消" : "編輯品牌"}</Button>
          <Button href={`/brands/${brand.id}`} size="sm" variant="ghost" iconRight="arrowRight">使用者視角</Button>
        </div>
      </Card>

      {editingBrand && <BrandEditForm brand={brand} onDone={() => { setEditingBrand(false); refetch(); }} onCancel={() => setEditingBrand(false)} />}

      {brands.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {brands.map((b) => (
            <Link key={b.id} href={`/brand?brandId=${b.id}`} className={cn("rounded-full border px-3 py-1.5 text-sm", b.id === brand.id ? "border-accent bg-accent text-white" : "border-line bg-paper text-ink-soft")}>
              {b.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faint">官方福利券</h2>
        <Button size="sm" icon="plus" onClick={() => setShowForm((s) => !s)}>{showForm ? "取消" : "上架福利券"}</Button>
      </div>

      {showForm && <CouponForm brandId={brand.id} plan={brand.plan} coupon={null} onDone={() => { setShowForm(false); refetch(); }} onCancel={() => setShowForm(false)} />}

      <div className={cn("space-y-3", showForm ? "mt-4" : "mt-3")}>
        {coupons.length === 0 ? (
          <EmptyState icon="ticket" title="還沒有券" hint="按上方「上架福利券」建立第一張官方福利券。" />
        ) : (
          coupons.map((c) => <CouponRow key={c.id} coupon={c} brandId={brand.id} plan={brand.plan} onChanged={refetch} />)
        )}
      </div>
    </div>
  );
}
