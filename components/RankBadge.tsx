import { cn } from "@/lib/display";

// Gold / silver / bronze rank chip for the current top-3 contributors. Rendered
// next to their name wherever it appears, so a top rank is always visible.
const RANK_STYLE: Record<number, string> = {
  1: "text-white [background:linear-gradient(135deg,#ffd76a,#e0a400)]",
  2: "text-white [background:linear-gradient(135deg,#cdd6e2,#93a1b5)]",
  3: "text-white [background:linear-gradient(135deg,#e8b487,#b9793f)]",
};

export function RankBadge({
  rank,
  size = "sm",
  className,
}: {
  rank?: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!rank || !RANK_STYLE[rank]) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-bold shadow-soft",
        size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[9px]",
        RANK_STYLE[rank],
        className,
      )}
    >
      第 {rank} 名
    </span>
  );
}
