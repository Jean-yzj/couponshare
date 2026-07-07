"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import { Button, Card, Field, Input, Skeleton, EmptyState, NeedLogin, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";

type Brand = { id: string; name: string; logo_text: string | null; category: string | null; coupon_count: number; created_at: string };

export default function AdminBrandsPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading, refetch } = useApi<{ data: Brand[] }>(me?.is_admin ? "/api/v1/admin/brands" : null);
  const { data: flags, refetch: refetchFlags } = useApi<{ flags: Record<string, boolean> }>(
    me?.is_admin ? "/api/v1/admin/settings" : null,
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (meLoading) return <div className="flex justify-center py-20"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  if (!me) return <NeedLogin message="登入後即可使用管理功能。" />;
  if (!me.is_admin)
    return <div className="py-10"><EmptyState icon="lock" title="沒有權限" hint="這是管理員專用頁面。" /></div>;

  const enabled = flags?.flags?.brand_coupons_enabled ?? false;

  async function toggleFlag() {
    setFlagBusy(true);
    try {
      await apiFetch("/api/v1/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key: "brand_coupons_enabled", value: !enabled }),
      });
      await refetchFlags();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setFlagBusy(false);
    }
  }

  async function createBrand() {
    if (!name.trim()) {
      setErr("請填品牌名稱");
      return;
    }
    setCreating(true);
    setErr(null);
    try {
      await apiFetch("/api/v1/admin/brands", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), category: category.trim() || undefined }),
      });
      setName("");
      setCategory("");
      await refetch();
    } catch (e) {
      setErr(e instanceof ApiErr ? e.message : "建立失敗");
    } finally {
      setCreating(false);
    }
  }

  const brands = data?.data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">企業票券</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        管理合作品牌的官方福利券。目前為「暗發布」——一般使用者看不到，只有管理員能預覽整套流程。
      </p>

      {/* Master flag */}
      <Card className="mt-5 flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            對所有使用者開放 {enabled ? <Pill className="ml-1 bg-pine-tint text-pine">已開放</Pill> : <Pill className="ml-1 bg-sand text-ink-faint">未開放（僅你可見）</Pill>}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            開啟後，官方福利券才會出現在一般使用者的品牌頁與券頁；關閉時只有你（管理員）看得到。
          </p>
        </div>
        <Button size="sm" variant={enabled ? "outline" : "primary"} loading={flagBusy} onClick={toggleFlag}>
          {enabled ? "關閉" : "開放"}
        </Button>
      </Card>

      {/* Create brand */}
      <Card className="mt-4 space-y-3 p-4">
        <p className="font-semibold text-ink">新增合作品牌</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="品牌名稱" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：某某咖啡" maxLength={40} />
          </Field>
          <Field label="分類">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="咖啡 / 甜點 / 超商…" maxLength={20} />
          </Field>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button icon="plus" loading={creating} onClick={createBrand}>建立品牌</Button>
      </Card>

      {/* Brand list */}
      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
        ) : brands.length === 0 ? (
          <EmptyState icon="ticket" title="還沒有合作品牌" hint="在上方新增第一個品牌，就能開始建立官方福利券。" />
        ) : (
          brands.map((b) => (
            <Link key={b.id} href={`/admin/brands/${b.id}`} className="block">
              <Card className="flex items-center gap-3 p-4 transition-colors hover:border-accent/30">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-lg font-extrabold text-accent">
                  {b.logo_text || b.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{b.name}</p>
                  <p className="text-xs text-ink-faint">{b.category || "未分類"} · {b.coupon_count} 張券</p>
                </div>
                <Icon name="chevronRight" size={18} className="text-ink-faint" />
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
