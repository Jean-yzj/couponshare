import Link from "next/link";
import { cn, expiryText } from "@/lib/display";
import { Avatar, TypePill } from "./ui";
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
  PENDING: { label: "已申請 · 等待選擇", cls: "bg-gold-tint text-gold-ink", icon: "hourglass" },
  APPROVED: { label: "已獲得這張券", cls: "bg-pine-tint text-pine", icon: "checkCircle" },
};

export function CouponCard({ c }: { c: FeedCoupon }) {
  const exp = expiryText(c.expiry_date);
  const isGift = c.type === "GIFT";
  const brandGrad = isGift ? "bg-[image:var(--grad-pine)]" : "bg-[image:var(--grad-teal)]";
  const applied = c.my_request_status ? APPLIED_META[c.my_request_status] : null;

  return (
    <Link href={`/coupons/${c.id}`} className="group block">
      <div
        className={cn(
          "relative flex h-full flex-col rounded-[22px] border bg-paper p-4 shadow-soft transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lift",
          applied === APPLIED_META.PENDING
            ? "border-transparent ring-2 ring-gold/40"
            : applied === APPLIED_META.APPROVED
              ? "border-transparent ring-2 ring-pine/40"
              : "border-line group-hover:border-accent/40",
        )}
      >
        {/* Brand row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-soft",
                brandGrad,
              )}
            >
              {c.brand.trim()[0] ?? "?"}
            </span>
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {c.brand}
              {c.category && CATEGORY_LABEL[c.category] ? (
                <span className="font-medium normal-case"> · {CATEGORY_LABEL[c.category]}</span>
              ) : null}
            </span>
          </div>
          <TypePill type={c.type} />
        </div>

        <h3 className="mt-3 line-clamp-2 min-h-[2.6em] text-[17px] font-semibold leading-snug text-ink">
          {c.title}
        </h3>

        {/* Ticket perforation with punched notches at each edge */}
        <div className="relative my-3 -mx-4 flex items-center">
          <span className="h-3 w-3 shrink-0 -translate-x-1/2 rounded-full bg-canvas" />
          <span className="flex-1 border-t border-dashed border-line" />
          <span className="h-3 w-3 shrink-0 translate-x-1/2 rounded-full bg-canvas" />
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {c.owner && <Avatar name={c.owner.display_name} url={c.owner.avatar_url} size={28} />}
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium text-ink">
                {c.owner?.display_name ?? "—"}
              </span>
              {c.owner && (
                <span className="truncate text-[11px] text-ink-faint">
                  {c.owner.level_name} · {c.owner.contribution_score} 分
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                exp.urgent ? "bg-danger-tint text-danger" : "bg-sand text-ink-soft",
              )}
            >
              <Icon name="clock" size={12} />
              {exp.text}
            </span>
            {c.claim_request_count > 0 && (
              <span className="text-[11px] text-ink-faint">{c.claim_request_count} 人想要</span>
            )}
          </div>
        </div>

        {applied && (
          <div
            className={cn(
              "mt-3 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold",
              applied.cls,
            )}
          >
            <Icon name={applied.icon} size={13} /> {applied.label}
          </div>
        )}
      </div>
    </Link>
  );
}
