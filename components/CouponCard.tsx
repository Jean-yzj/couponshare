import Link from "next/link";
import { cn, expiryText } from "@/lib/display";
import { Avatar, TypePill } from "./ui";
import { Icon } from "./icons";

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
  type: string;
  expiry_date: string;
  status: string;
  claim_request_count: number;
  created_at: string;
  owner?: FeedOwner | null;
};

export function CouponCard({ c }: { c: FeedCoupon }) {
  const exp = expiryText(c.expiry_date);
  const rail = c.type === "GIFT" ? "bg-pine" : "bg-teal";

  return (
    <Link href={`/coupons/${c.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-sand-2 group-hover:shadow-lift">
        <span className={cn("absolute left-0 top-0 h-full w-1.5", rail)} />
        <div className="p-4 pl-5">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {c.brand}
            </span>
            <TypePill type={c.type} />
          </div>

          <h3 className="mt-2 line-clamp-2 min-h-[2.6em] text-[17px] font-semibold leading-snug text-ink">
            {c.title}
          </h3>

          <div className="my-3.5 border-t border-dashed border-line" />

          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {c.owner && <Avatar name={c.owner.display_name} url={c.owner.avatar_url} size={30} />}
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
                  exp.urgent ? "text-accent-press" : "text-ink-soft",
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
      </div>
    </Link>
  );
}
