import Link from "next/link";
import { cn, expiryText } from "@/lib/display";
import { Avatar, TypePill } from "./ui";
import { Icon } from "./icons";
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
  expiry_date: string;
  status: string;
  claim_request_count: number;
  created_at: string;
  owner?: FeedOwner | null;
};

export function CouponCard({ c }: { c: FeedCoupon }) {
  const exp = expiryText(c.expiry_date);
  const chip =
    c.type === "GIFT" ? "bg-pine-tint text-pine" : "bg-teal-tint text-teal";

  return (
    <Link href={`/coupons/${c.id}`} className="group block">
      <div className="flex h-full flex-col rounded-2xl border border-line bg-paper p-4 shadow-soft transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/40 group-hover:shadow-lift">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                chip,
              )}
            >
              {c.brand.trim()[0] ?? "?"}
            </span>
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-faint">
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

        <div className="my-3 border-t border-dashed border-line" />

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
                "inline-flex items-center gap-1 text-xs font-medium",
                exp.urgent ? "text-danger" : "text-ink-soft",
              )}
            >
              <Icon name="clock" size={13} />
              {exp.text}
            </span>
            {c.claim_request_count > 0 && (
              <span className="text-[11px] text-ink-faint">{c.claim_request_count} 人已申請</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
