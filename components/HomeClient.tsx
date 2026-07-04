"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "@/components/CouponCard";
import { Landing } from "@/components/Landing";
import { Button, Input, Skeleton, EmptyState, LoadFailed, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/display";
import { CATEGORIES, REDEEM_KINDS } from "@/lib/categories";

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

// First-page feed results per filter combo — coming back to 探索 paints the
// last list instantly, then refreshes in the background.
const feedCache = new Map<string, { items: FeedCoupon[]; total: number }>();

type InitialFeed = {
  data: FeedCoupon[];
  pagination: { total: number; has_more?: boolean };
};

export type FeedFilters = {
  brand: string;
  category: string;
  redeemKind: string;
  type: "ALL" | "GIFT" | "EXCHANGE";
  sort: "latest" | "expiry_soon" | "popular";
};

export const DEFAULT_FEED_FILTERS: FeedFilters = {
  brand: "",
  category: "ALL",
  redeemKind: "ALL",
  type: "ALL",
  sort: "latest",
};

// Session-scoped filter memory. The URL is updated via raw history.replaceState
// below (nice for copy/share), but Next.js's App Router does not reliably keep
// that in sync with its own soft-navigation history for a client-side back
// navigation (verified: after searching, then visiting a coupon and returning,
// the address bar reverts to no filters even though nothing was typed again) —
// so the URL can't be trusted as the source of truth for "what was I looking
// at." sessionStorage survives that unaffected and is what actually drives
// restoring the list when you come back from a coupon's detail page.
const FILTERS_STORAGE_KEY = "cs-explore-filters-v1";

function isDefaultFilters(f: FeedFilters): boolean {
  return (
    f.brand === "" &&
    f.category === "ALL" &&
    f.redeemKind === "ALL" &&
    f.type === "ALL" &&
    f.sort === "latest"
  );
}

function loadStoredFilters(): FeedFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.brand !== "string") return null;
    return {
      brand: parsed.brand,
      category: typeof parsed.category === "string" ? parsed.category : "ALL",
      redeemKind: typeof parsed.redeemKind === "string" ? parsed.redeemKind : "ALL",
      type: parsed.type === "GIFT" || parsed.type === "EXCHANGE" ? parsed.type : "ALL",
      sort:
        parsed.sort === "expiry_soon" || parsed.sort === "popular" ? parsed.sort : "latest",
    };
  } catch {
    return null;
  }
}

// A non-default server-derived filter (e.g. a shared /?brand=X link, or a hard
// refresh) always wins — it's an explicit signal from the URL. Only when the
// URL carries nothing do we fall back to "what was I last looking at."
function resolveInitialFilters(serverFilters: FeedFilters): FeedFilters {
  if (!isDefaultFilters(serverFilters)) return serverFilters;
  return loadStoredFilters() ?? serverFilters;
}

function feedQueryKey(filters: FeedFilters, page: number) {
  const qs = new URLSearchParams({ sort: filters.sort, page: String(page), limit: String(LIMIT) });
  if (filters.brand) qs.set("brand", filters.brand);
  if (filters.type !== "ALL") qs.set("type", filters.type);
  if (filters.category !== "ALL") qs.set("category", filters.category);
  if (filters.redeemKind !== "ALL") qs.set("redeem_kind", filters.redeemKind);
  return qs.toString();
}

export function HomeClient({
  signedIn,
  initialFeed,
  initialExpiring,
  initialBrands,
  initialFilters = DEFAULT_FEED_FILTERS,
}: {
  signedIn: boolean;
  initialFeed: InitialFeed;
  initialExpiring: FeedCoupon[];
  initialBrands: string[];
  initialFilters?: FeedFilters;
}) {
  if (!signedIn) return <Landing />;
  return (
    <FeedView
      signedIn={signedIn}
      initialFeed={initialFeed}
      initialExpiring={initialExpiring}
      initialBrands={initialBrands}
      initialFilters={initialFilters}
    />
  );
}

function FeedView({
  signedIn,
  initialFeed,
  initialExpiring,
  initialBrands,
  initialFilters,
}: {
  signedIn: boolean;
  initialFeed: InitialFeed;
  initialExpiring: FeedCoupon[];
  initialBrands: string[];
  initialFilters: FeedFilters;
}) {
  // Computed once on mount: prefers a stored search over the (possibly stale)
  // server-derived default — see resolveInitialFilters above.
  const [resolved] = useState(() => resolveInitialFilters(initialFilters));
  const [brand, setBrand] = useState(resolved.brand);
  const [debounced, setDebounced] = useState(resolved.brand);
  const [category, setCategory] = useState<string>(resolved.category);
  const [redeemKind, setRedeemKind] = useState<string>(resolved.redeemKind);
  const [type, setType] = useState<"ALL" | "GIFT" | "EXCHANGE">(resolved.type);
  const [sort, setSort] = useState<"latest" | "expiry_soon" | "popular">(resolved.sort);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [items, setItems] = useState<FeedCoupon[]>(initialFeed.data);
  const [total, setTotal] = useState(initialFeed.pagination.total);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const skippedInitialFeedRequest = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const autoLoadLocked = useRef(false);
  const brandsData = { brands: initialBrands };
  const expData = { data: initialExpiring };
  const noFilters = category === "ALL" && redeemKind === "ALL" && type === "ALL" && !debounced;
  const typeLabel = TYPES.find((t) => t.value === type)?.label ?? "全部";
  const sortLabel = SORTS.find((s) => s.value === sort)?.label ?? "最新";

  useEffect(() => {
    const t = setTimeout(() => setDebounced(brand.trim()), 350);
    return () => clearTimeout(t);
  }, [brand]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current: FeedFilters = { brand: debounced, category, redeemKind, type, sort };

    // The reliable mechanism (see FILTERS_STORAGE_KEY comment above) — this is
    // what actually restores your search when you come back from a coupon.
    try {
      if (isDefaultFilters(current)) sessionStorage.removeItem(FILTERS_STORAGE_KEY);
      else sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(current));
    } catch {
      /* storage unavailable (private mode, quota) — degrade silently */
    }

    // Best-effort address-bar sync for copy/share; not load-bearing for restore.
    const qs = new URLSearchParams();
    if (debounced) qs.set("brand", debounced);
    if (category !== "ALL") qs.set("category", category);
    if (redeemKind !== "ALL") qs.set("redeem_kind", redeemKind);
    if (type !== "ALL") qs.set("type", type);
    if (sort !== "latest") qs.set("sort", sort);
    const nextUrl = qs.toString() ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [debounced, category, type, sort]);

  useEffect(() => {
    autoLoadLocked.current = false;
    setPage(1);
  }, [debounced, type, sort, category, redeemKind]);

  useEffect(() => {
    let cancelled = false;
    setLoadErr(false);
    const key = feedQueryKey({ brand: debounced, category, redeemKind, type, sort }, page);
    const initialKey = feedQueryKey(initialFilters, 1);

    if (!skippedInitialFeedRequest.current && page === 1 && key === initialKey) {
      skippedInitialFeedRequest.current = true;
      feedCache.set(key, { items: initialFeed.data, total: initialFeed.pagination.total });
      return;
    }

    // Paint cached first page immediately; the network refresh below replaces it.
    const cached = page === 1 ? feedCache.get(key) : undefined;
    if (cached) {
      setItems(cached.items);
      setTotal(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
    }

    apiFetch<{ data: FeedCoupon[]; pagination: { total: number } }>(`/api/v1/coupons/feed?${key}`)
      .then((r) => {
        if (page === 1) feedCache.set(key, { items: r.data, total: r.pagination.total });
        if (cancelled) return;
        setTotal(r.pagination.total);
        setItems((prev) => (page === 1 ? r.data : [...prev, ...r.data]));
      })
      .catch(() => {
        if (!cancelled && !cached) setLoadErr(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          autoLoadLocked.current = false;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, type, sort, category, redeemKind, page, retryNonce, initialFeed, initialFilters]);

  const canLoadMore = items.length < total;
  const firstLoad = loading && page === 1;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !canLoadMore || firstLoad || loadErr) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || loading || autoLoadLocked.current) return;
        autoLoadLocked.current = true;
        setPage((p) => p + 1);
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [canLoadMore, firstLoad, loadErr, loading]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-ink">探索票券</h1>

      <div className="sticky top-16 z-30 -mx-4 mb-6 space-y-3 border-y border-line/70 bg-canvas px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
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

        {/* Redeem-kind chips (免費兌換 vs 折價券) */}
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <Chip active={redeemKind === "ALL"} onClick={() => setRedeemKind("ALL")}>
            全部內容
          </Chip>
          {REDEEM_KINDS.map((r) => (
            <Chip key={r.key} active={redeemKind === r.key} onClick={() => setRedeemKind(r.key)}>
              {r.label}
            </Chip>
          ))}
        </div>

        {signedIn && brandsData && brandsData.brands.length > 0 && (
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
      ) : loadErr && items.length === 0 ? (
        <LoadFailed onRetry={() => setRetryNonce((n) => n + 1)} />
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
            <div ref={loadMoreRef} className="mt-8 flex justify-center py-2">
              {loading && <Spinner className="text-ink-faint" />}
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
