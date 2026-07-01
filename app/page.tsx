"use client";

import { useEffect, useState } from "react";
import { apiFetch, useApi, useMe } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "@/components/CouponCard";
import { Landing } from "@/components/Landing";
import { Button, Input, Skeleton, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";
import { CATEGORIES } from "@/lib/categories";

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

export default function HomePage() {
  const { me, loading } = useMe();
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!me) return <Landing />;
  return <FeedView />;
}

function FeedView() {
  const { me } = useMe();
  const [brand, setBrand] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [type, setType] = useState<"ALL" | "GIFT" | "EXCHANGE">("ALL");
  const [sort, setSort] = useState<"latest" | "expiry_soon" | "popular">("latest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [items, setItems] = useState<FeedCoupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { data: brandsData } = useApi<{ brands: string[] }>(me ? "/api/v1/me/brands" : null);
  const { data: expData } = useApi<{ data: FeedCoupon[] }>(
    "/api/v1/coupons/feed?within_hours=48&sort=expiry_soon&limit=4",
  );
  const noFilters = category === "ALL" && type === "ALL" && !debounced;
  const typeLabel = TYPES.find((t) => t.value === type)?.label ?? "全部";
  const sortLabel = SORTS.find((s) => s.value === sort)?.label ?? "最新";

  useEffect(() => {
    const t = setTimeout(() => setDebounced(brand.trim()), 350);
    return () => clearTimeout(t);
  }, [brand]);

  useEffect(() => {
    setPage(1);
  }, [debounced, type, sort, category]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ sort, page: String(page), limit: String(LIMIT) });
    if (debounced) qs.set("brand", debounced);
    if (type !== "ALL") qs.set("type", type);
    if (category !== "ALL") qs.set("category", category);
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
  }, [debounced, type, sort, category, page]);

  const canLoadMore = items.length < total;
  const firstLoad = loading && page === 1;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-ink">探索票券</h1>

      <div className="sticky top-16 z-30 -mx-4 mb-6 space-y-3 border-y border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
        <div className="relative">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="搜尋品牌，例如 星巴克、全家、摩斯"
            className="pl-10"
          />
        </div>

        {/* Category chips */}
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <Chip active={category === "ALL"} onClick={() => setCategory("ALL")}>
            全部分類
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
              {c.label}
            </Chip>
          ))}
        </div>

        {me && brandsData && brandsData.brands.length > 0 && (
          <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
            <span className="shrink-0 text-xs font-medium text-ink-faint">追蹤中</span>
            {brandsData.brands.map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-tint px-3 py-1.5 text-sm font-medium text-accent-press"
              >
                <Icon name="bell" size={12} />
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Type + sort — collapsed on mobile so cards sit higher; always open on desktop */}
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-full border border-line bg-paper px-3.5 py-2 text-sm sm:hidden"
        >
          <span className="flex items-center gap-1.5">
            <Icon name="filter" size={14} className="text-ink-faint" />
            <span className="font-semibold text-ink">篩選與排序</span>
            <span className="text-ink-faint">
              · {typeLabel} · {sortLabel}
            </span>
          </span>
          <Icon
            name="chevronDown"
            size={16}
            className={cn("text-ink-faint transition-transform", filtersOpen && "rotate-180")}
          />
        </button>
        <div
          className={cn(
            "flex-wrap items-center gap-x-5 gap-y-2 sm:flex",
            filtersOpen ? "flex" : "hidden",
          )}
        >
          <FilterRow label="類型" options={TYPES} value={type} onChange={setType} />
          <FilterRow label="排序" options={SORTS} value={sort} onChange={setSort} />
        </div>
      </div>

      {noFilters && expData && expData.data.length > 0 && (
        <section className="mb-6 rounded-2xl border border-danger/30 bg-danger-tint/40 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <Icon name="clock" size={18} className="text-danger" />
              快過期了，幫忙領走
            </span>
            <span className="text-xs text-ink-soft">這些券即將過期，別讓它浪費掉</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {expData.data.map((c) => (
              <CouponCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      {firstLoad ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        noFilters && total === 0 ? (
          <EmptyState
            icon="gift"
            title="這裡還空空的，等你來開張"
            hint="目前還沒有人分享票券。把你用不到的券放上來，成為第一個讓善意流動的人。"
            action={
              <Button href="/new" icon="plus">
                分享第一張票券
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="search"
            title="找不到符合條件的票券"
            hint="換個分類、品牌或排序看看，或自己分享一張。"
            action={
              <Button href="/new" icon="plus">
                分享一張票券
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "bg-grad-brand text-white shadow-glow"
          : "border border-line bg-paper text-ink-soft hover:bg-sand",
      )}
    >
      {children}
    </button>
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
              value === o.value ? "bg-ink text-canvas" : "text-ink-soft hover:bg-sand",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
