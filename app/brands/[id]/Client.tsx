"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/lib/client";
import { Card, Skeleton, EmptyState } from "@/components/ui";
import { BrandCouponCard, type BrandCouponCardData } from "@/components/BrandCouponCard";

type BrandPage = {
  brand: {
    id: string;
    name: string;
    logo_text: string | null;
    logo_url: string | null;
    category: string | null;
    description: string | null;
    website_url: string | null;
  };
  coupons: BrandCouponCardData[];
};

export default function BrandPublicPage() {
  const params = useParams<{ id: string }>();
  const { data, loading, error } = useApi<BrandPage>(`/api/v1/brands/${params.id}`);

  if (loading)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  if (error || !data)
    return (
      <div className="py-10">
        <EmptyState icon="ban" title="找不到這個品牌" hint="這個品牌頁不存在，或目前尚未開放。" />
      </div>
    );

  const { brand, coupons } = data;
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="flex items-center gap-4 p-5 sm:p-6">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-line object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-tint text-xl font-extrabold text-accent">
            {brand.logo_text || brand.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{brand.name}</h1>
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">官方</span>
          </div>
          {brand.category && <p className="text-xs text-ink-faint">{brand.category}</p>}
          {brand.description && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{brand.description}</p>}
        </div>
      </Card>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink-faint">官方福利券</h2>
      {coupons.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon="ticket" title="目前沒有開放中的福利券" hint="這個品牌暫時沒有可申請的官方福利券。" />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {coupons.map((c) => (
            <BrandCouponCard key={c.id} coupon={c} brandName={brand.name} brandLogo={brand.logo_text} brandLogoUrl={brand.logo_url} />
          ))}
        </div>
      )}
    </div>
  );
}
