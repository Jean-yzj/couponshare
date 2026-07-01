import Link from "next/link";
import { cn, expiryText } from "@/lib/display";
import { Avatar } from "./ui";
import { Icon, type IconName } from "./icons";
import { CATEGORY_LABEL, categoryStyle } from "@/lib/categories";

export type FeedOwner = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_level: string;
  level_name: string;
  contribution_score: number;
};

export type FeedCoupon = {
  id: string;
  title: string;
  brand: string;
  category?: string;
  type: string;
  expiry_date: string | null;
  status: string;
  claim_request_count: number;
  my_request_status?: string | null;
  created_at: string;
  owner?: FeedOwner | null;
};

const APPLIED_META: Record<string, { label: string; cls: string; icon: IconName }> = {
  PENDING: { label: "已申請", cls: "bg-gold-tint text-gold-ink", icon: "hourglass" },
  APPROVED: { label: "已獲得", cls: "bg-pine-tint text-pine", icon: "checkCircle" },
};

// Compact branded-coupon card. Colour theme follows the CATEGORY
// (速食紅 / 咖啡棕 / 飲料黃 / 超商綠 …) so cards are scannable at a glance.
export function CouponCard({ c }: { c: FeedCoupon }) {
  const exp = expiryText(c.expiry_date);
  const isGift = c.type === "GIFT";
  const cs = categoryStyle(c.category);
  const category = c.category ? CATEGORY_LABEL[c.category] : undefined;
  const applied = c.my_request_status ? APPLIED_META[c.my_request_status] : null;

  return (
    <Link href={`/coupons/${c.id}`} className="group block">
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-paper shadow-soft transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lift",
          applied === APPLIED_META.PENDING
            ? "border-transparent ring-2 ring-gold/40"
            : applied === APPLIED_META.APPROVED
              ? "border-transparent ring-2 ring-pine/40"
              : "border-line group-hover:border-accent/40",
        )}
      >
        {/* Category-tinted brand header */}
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: cs.tint }}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-soft ring-2 ring-white/60"
            style={{ backgroundImage: cs.grad, textShadow: "0 1px 1px rgba(0,0,0,.22)" }}
          >
            {c.brand.trim()[0] ?? "?"}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">{c.brand}</span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: cs.solid }}
          >
            {isGift ? "贈送" : "交換"}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
          {category && (
            <p
              className="mb-1 truncate text-[10px] font-bold uppercase tracking-wide"
              style={{ color: cs.text }}
            >
              {category}
            </p>
          )}
          <h3 className="line-clamp-2 min-h-[2.5em] text-[13.5px] font-bold leading-snug text-ink">
            {c.title}
          </h3>

          <div className="my-2 border-t border-dashed border-line" />

          <div className="mt-auto flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {c.owner && <Avatar name={c.owner.display_name} url={c.owner.avatar_url} size={18} />}
              <span className="truncate text-[11px] font-medium text-ink-soft">
                {c.owner?.display_name ?? "—"}
              </span>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium",
                exp.urgent ? "text-danger" : "text-ink-faint",
              )}
            >
              <Icon name="clock" size={10} />
              {exp.text}
            </span>
          </div>
        </div>

        {applied && (
          <div
            className={cn(
              "flex items-center justify-center gap-1 py-1 text-[10px] font-bold",
              applied.cls,
            )}
          >
            <Icon name={applied.icon} size={11} /> {applied.label}
          </div>
        )}
      </div>
    </Link>
  );
}
