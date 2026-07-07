import Link from "next/link";
import { cn } from "@/lib/display";

export type BrandCouponCardData = {
  id: string;
  title: string;
  category?: string | null;
  remaining: number;
  max_applications: number;
  application_mode: string;
};

// A brand's official coupon as it appears to users — deliberately the same shape
// as a normal coupon card, plus a 官方福利 tag. Links to the detail/apply page.
export function BrandCouponCard({
  coupon,
  brandName,
  brandLogo,
}: {
  coupon: BrandCouponCardData;
  brandName: string;
  brandLogo?: string | null;
}) {
  const soldOut = coupon.remaining <= 0;
  const claimed = coupon.max_applications - coupon.remaining;
  const pct = coupon.max_applications > 0 ? Math.min(100, (claimed / coupon.max_applications) * 100) : 0;
  return (
    <Link
      href={`/brand-coupons/${coupon.id}`}
      className="block rounded-2xl border border-line bg-paper p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lift"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-xs font-bold text-accent">
            {brandLogo || brandName.slice(0, 1)}
          </span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {brandName}
            {coupon.category ? ` · ${coupon.category}` : ""}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">官方福利</span>
      </div>
      <p className="mt-2.5 font-semibold leading-snug text-ink">{coupon.title}</p>
      <div className="my-3 border-t border-dashed border-line" />
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", soldOut ? "text-ink-faint" : "text-ink")}>
          {soldOut ? "名額已領完" : `剩餘 ${coupon.remaining} / ${coupon.max_applications} 個名額`}
        </span>
        <span className="font-medium text-accent">{soldOut ? "" : "立即申請"}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}
