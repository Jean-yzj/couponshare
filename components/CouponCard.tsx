import Link from "next/link";
import { cn, expiryText } from "@/lib/display";
import { Avatar } from "./ui";
import { Icon, type IconName } from "./icons";
import { CATEGORY_LABEL, categoryStyle, REDEEM_KIND_LABEL, REDEEM_KIND_STYLE } from "@/lib/categories";

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
  redeem_kind?: string | null;
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
  const rk = c.redeem_kind ? REDEEM_KIND_STYLE[c.redeem_kind] : undefined;
  const rkLabel = c.redeem_kind ? REDEEM_KIND_LABEL[c.redeem_kind] : undefined;
  const applied = c.my_request_status ? APPLIED_META[c.my_request_status] : null;

  return (
    <Link href={`/coupons/${c.id}`} prefetch={false} className="group block">
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
        {/* Category-coloured brand header — full-saturation ticket top */}
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundImage: cs.grad }}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-extrabold shadow-soft ring-2 ring-white/70"
            style={{ color: cs.solid }}
          >
            {c.brand.trim()[0] ?? "?"}
          </span>
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-white"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,.18)" }}
          >
            {c.brand}
          </span>
          <span className="shrink-0 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-ink shadow-sm">
            {isGift ? "贈送" : "交換"}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
          {(category || rk) && (
            <div className="mb-1 flex items-center gap-1.5">
              {category && (
                <span
                  className="truncate text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: cs.text }}
                >
                  {category}
                </span>
              )}
              {rk && rkLabel && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold"
                  style={{ backgroundColor: rk.tint, color: rk.text }}
                >
                  {rkLabel}
                </span>
              )}
            </div>
          )}
          <h3 className="line-clamp-2 min-h-[2.5em] text-[13.5px] font-bold leading-snug text-ink">
            {c.title}
          </h3>

          <div className="my-2 border-t border-dashed border-line" />

          <div className="mt-auto flex items-end justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {c.owner && <Avatar name={c.owner.display_name} url={c.owner.avatar_url} size={18} />}
              <span className="truncate text-[11px] font-medium text-ink-soft">
                {c.owner?.display_name ?? "—"}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-bold",
                  c.claim_request_count > 0 ? "text-accent" : "text-ink-faint",
                )}
              >
                <Icon name="users" size={10} />
                {c.claim_request_count > 0 ? `${c.claim_request_count} 人申請` : "還沒人申請"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-medium",
                  exp.urgent ? "text-danger" : "text-ink-faint",
                )}
              >
                <Icon name="clock" size={10} />
                {exp.text}
              </span>
            </div>
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
