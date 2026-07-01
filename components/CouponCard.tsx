import Link from "next/link";
import { cn, expiryText } from "@/lib/display";
import { Avatar } from "./ui";
import { Icon, type IconName } from "./icons";
import { CATEGORY_LABEL } from "@/lib/categories";

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

// Compact trading-card style — small so many fit on screen at once.
export function CouponCard({ c }: { c: FeedCoupon }) {
  const exp = expiryText(c.expiry_date);
  const isGift = c.type === "GIFT";
  const brandGrad = isGift ? "bg-[image:var(--grad-pine)]" : "bg-[image:var(--grad-teal)]";
  const applied = c.my_request_status ? APPLIED_META[c.my_request_status] : null;

  return (
    <Link href={`/coupons/${c.id}`} className="group block">
      <div
        className={cn(
          "relative flex h-full flex-col rounded-2xl border bg-paper p-3 shadow-soft transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lift",
          applied === APPLIED_META.PENDING
            ? "border-transparent ring-2 ring-gold/40"
            : applied === APPLIED_META.APPROVED
              ? "border-transparent ring-2 ring-pine/40"
              : "border-line group-hover:border-accent/40",
        )}
      >
        <div className="flex items-start justify-between gap-1.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-soft",
              brandGrad,
            )}
          >
            {c.brand.trim()[0] ?? "?"}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
              isGift ? "bg-pine-tint text-pine" : "bg-teal-tint text-teal",
            )}
          >
            {isGift ? "免費" : "交換"}
          </span>
        </div>

        <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          {c.brand}
          {c.category && CATEGORY_LABEL[c.category] ? ` · ${CATEGORY_LABEL[c.category]}` : ""}
        </p>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.5em] text-[13.5px] font-bold leading-snug text-ink">
          {c.title}
        </h3>

        <div className="relative my-2 -mx-3 flex items-center">
          <span className="h-2.5 w-2.5 shrink-0 -translate-x-1/2 rounded-full bg-canvas" />
          <span className="flex-1 border-t border-dashed border-line" />
          <span className="h-2.5 w-2.5 shrink-0 translate-x-1/2 rounded-full bg-canvas" />
        </div>

        <div className="mt-auto flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {c.owner && <Avatar name={c.owner.display_name} url={c.owner.avatar_url} size={18} />}
            <span className="truncate text-[11px] font-medium text-ink">
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

        {applied && (
          <div
            className={cn(
              "mt-2 flex items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-bold",
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
