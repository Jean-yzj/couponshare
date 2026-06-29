"use client";

import { useEffect, useState } from "react";
import { apiFetch, useMe } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "@/components/CouponCard";
import { Button, Input, Skeleton, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";

const TYPES = [
  { value: "ALL", label: "全部" },
  { value: "GIFT", label: "免費贈送" },
  { value: "EXCHANGE", label: "交換" },
] as const;

const SORTS = [
  { value: "latest", label: "最新" },
  { value: "expiry_soon", label: "即將到期" },
  { value: "popular", label: "熱門" },
] as const;

const LIMIT = 12;

export default function FeedPage() {
  const { me } = useMe();
  const [brand, setBrand] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState<"ALL" | "GIFT" | "EXCHANGE">("ALL");
  const [sort, setSort] = useState<"latest" | "expiry_soon" | "popular">("latest");
  const [items, setItems] = useState<FeedCoupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(brand.trim()), 350);
    return () => clearTimeout(t);
  }, [brand]);

  useEffect(() => {
    setPage(1);
  }, [debounced, type, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ sort, page: String(page), limit: String(LIMIT) });
    if (debounced) qs.set("brand", debounced);
    if (type !== "ALL") qs.set("type", type);
    apiFetch<{ data: FeedCoupon[]; pagination: { total: number } }>(`/api/v1/coupons/feed?${qs}`)
      .then((r) => {
        if (cancelled) return;
        setTotal(r.pagination.total);
        setItems((prev) => (page === 1 ? r.data : [...prev, ...r.data]));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, type, sort, page]);

  const canLoadMore = items.length < total;
  const firstLoad = loading && page === 1;

  return (
    <div>
      <section className="mb-7">
        <p className="font-display text-sm font-semibold tracking-wide text-accent">CouponShare</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-[40px]">
          把用不到的優惠券
          <br className="hidden sm:block" />
          <span className="text-accent">送給</span>需要的人
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          瀏覽社群分享的閒置票券，留言申請，由持有者親手送出。每一次贈出，都累積你的貢獻值。
        </p>
        {me && (
          <p className="mt-3 text-sm text-ink-faint">
            歡迎回來，<span className="font-medium text-ink">{me.display_name}</span>
            　·　目前 <span className="font-medium text-accent">{me.contribution_score}</span> 貢獻分
          </p>
        )}
      </section>

      {/* Filters */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-y border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="relative">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="搜尋品牌，例如 星巴克、全家、麥當勞"
            className="pl-10"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <FilterRow label="類型" options={TYPES} value={type} onChange={setType} />
          <FilterRow label="排序" options={SORTS} value={sort} onChange={setSort} />
        </div>
      </div>

      {/* Grid */}
      {firstLoad ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="ticket"
          title="目前沒有符合條件的票券"
          hint="換個品牌或類型看看，或成為第一個分享的人。"
          action={
            <Button href="/new" icon="plus">
              分享一張票券
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => (
              <CouponCard key={c.id} c={c} />
            ))}
          </div>
          {canLoadMore && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" loading={loading} onClick={() => setPage((p) => p + 1)}>
                載入更多
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink-faint">{label}</span>
      <div className="flex items-center gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              value === o.value ? "bg-ink text-canvas" : "text-ink-soft hover:bg-sand/70",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
