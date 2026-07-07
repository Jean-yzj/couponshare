"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Field, Input, Textarea, Skeleton, EmptyState, NeedLogin, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Coupon = {
  id: string;
  title: string;
  category: string | null;
  application_mode: string;
  status: string;
  max_applications: number;
  application_count: number;
  view_count: number;
  total_applications: number;
  claimed_count: number;
};
type BrandBrief = { id: string; name: string; logo_text: string | null; category: string | null };
type OwnerData = {
  brands: BrandBrief[];
  brand: { id: string; name: string; logo_text: string | null; category: string | null } | null;
  coupons: Coupon[];
};
type Application = { id: string; display_name: string; message: string | null; status: string; created_at: string };

const STATUS_LABEL: Record<string, string> = { DRAFT: "草稿", ACTIVE: "進行中", PAUSED: "已暫停", ENDED: "已結束" };
const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-pine-tint text-pine",
  PAUSED: "bg-gold-tint text-gold",
  ENDED: "bg-sand text-ink-faint",
  DRAFT: "bg-sand text-ink-faint",
};
const APP_LABEL: Record<string, string> = { PENDING: "審核中", CLAIMED: "已領取", APPROVED: "已通過", REJECTED: "未通過" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-canvas px-2 py-2 text-center">
      <p className="font-display text-lg font-extrabold tabular-nums text-ink">{value.toLocaleString("en-US")}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}

function CouponRow({ coupon, onChanged }: { coupon: Coupon; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
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

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{coupon.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {coupon.application_mode === "DIRECT_CLAIM" ? "直接領取" : "留言申請"} · 每人限領 1 張
          </p>
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
        {coupon.status !== "ACTIVE" && (
          <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus("ACTIVE")}>設為進行中</Button>
        )}
        {coupon.status === "ACTIVE" && (
          <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus("PAUSED")}>暫停</Button>
        )}
        {coupon.status !== "ENDED" && (
          <Button size="sm" variant="ghost" loading={busy} onClick={() => setStatus("ENDED")}>結束</Button>
        )}
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

export default function BrandOwnerPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<OwnerData>(me ? "/api/v1/brand/me" : null);
  const [newBrand, setNewBrand] = useState({ name: "", category: "" });
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", mode: "DIRECT_CLAIM", max: "100", redeem: "", cta_text: "", cta_url: "" });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (meLoading) return <div className="flex justify-center py-20"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  if (!me) return <NeedLogin message="登入後即可使用企業後台。" />;
  if (loading) return <div className="mx-auto max-w-2xl space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;

  // Onboarding — no brand yet.
  if (!data || !data.brand) {
    async function createBrand() {
      if (!newBrand.name.trim()) { setErr("請填品牌名稱"); return; }
      setCreatingBrand(true);
      setErr(null);
      try {
        await apiFetch("/api/v1/brand", {
          method: "POST",
          body: JSON.stringify({ name: newBrand.name.trim(), category: newBrand.category.trim() || undefined }),
        });
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
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-tint text-accent">
            <Icon name="ticket" size={26} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">建立你的品牌後台</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            建立品牌後，你就能上架官方福利券、設定申請名額，並看到每張券的瀏覽、申請與領取數據。
          </p>
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

  async function createCoupon() {
    if (form.title.trim().length < 2) { setErr("請填券標題"); return; }
    setCreating(true);
    setErr(null);
    try {
      await apiFetch(`/api/v1/brand/${brand!.id}/coupons`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          application_mode: form.mode,
          max_applications: Math.max(1, parseInt(form.max, 10) || 100),
          max_per_user: 1,
          redeem_info: form.redeem.trim() || undefined,
          cta_text: form.cta_text.trim() || undefined,
          cta_url: form.cta_url.trim() || undefined,
        }),
      });
      setForm({ title: "", mode: "DIRECT_CLAIM", max: "100", redeem: "", cta_text: "", cta_url: "" });
      setShowForm(false);
      await refetch();
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "建立失敗");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="flex items-center gap-4 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-tint text-xl font-extrabold text-accent">
          {brand.logo_text || brand.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{brand.name}</h1>
            <Pill className="bg-accent-tint text-accent">企業後台</Pill>
          </div>
          <p className="text-xs text-ink-faint">{brand.category || "未分類"} · 你管理的品牌</p>
        </div>
        <Button href={`/brands/${brand.id}`} size="sm" variant="outline" iconRight="arrowRight">使用者視角</Button>
      </Card>

      {brands.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/brand?brandId=${b.id}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                b.id === brand.id ? "border-accent bg-accent text-white" : "border-line bg-paper text-ink-soft",
              )}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faint">官方福利券</h2>
        <Button size="sm" icon="plus" onClick={() => setShowForm((s) => !s)}>{showForm ? "取消" : "上架福利券"}</Button>
      </div>

      {showForm && (
        <Card className="mt-3 space-y-3 p-4">
          <Field label="券標題" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：中杯拿鐵買一送一" maxLength={60} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="領取方式">
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
              >
                <option value="DIRECT_CLAIM">直接領取</option>
                <option value="MESSAGE_APPLICATION">留言申請（你審核）</option>
              </select>
            </Field>
            <Field label="總名額">
              <Input type="number" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} min={1} />
            </Field>
          </div>
          <Field label="兌換方式說明" hint="使用者領到後才會看到">
            <Textarea value={form.redeem} onChange={(e) => setForm({ ...form, redeem: e.target.value })} placeholder="例如：出示此頁面至指定門市，或輸入折扣碼 XXXX" maxLength={300} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="按鈕文字（選填）">
              <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="前往使用" maxLength={20} />
            </Field>
            <Field label="按鈕連結（選填）">
              <Input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button icon="check" loading={creating} onClick={createCoupon}>建立並上架</Button>
        </Card>
      )}

      <div className={cn("space-y-3", showForm ? "mt-4" : "mt-3")}>
        {coupons.length === 0 ? (
          <EmptyState icon="ticket" title="還沒有券" hint="按上方「上架福利券」建立第一張官方福利券。" />
        ) : (
          coupons.map((c) => <CouponRow key={c.id} coupon={c} onChanged={refetch} />)
        )}
      </div>
    </div>
  );
}
