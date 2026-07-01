import { useId } from "react";
import { cn } from "@/lib/display";

/**
 * "Coupy" — the CouponShare mascot. A friendly azure buddy with a % belly badge.
 * Pure SVG so it renders crisply on any background (gradient hero or white card)
 * and needs no raster asset. Gradient ids are scoped via useId to stay unique
 * when several mascots render on one page.
 */
export function Mascot({
  size = 96,
  className,
  float,
}: {
  size?: number;
  className?: string;
  float?: boolean;
}) {
  const uid = useId().replace(/[:]/g, "");
  const body = `body-${uid}`;
  const star = `star-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      className={cn(float && "animate-float", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={body} x1="24" y1="30" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#57a6ff" />
          <stop offset="1" stopColor="#0d5ce0" />
        </linearGradient>
        <linearGradient id={star} x1="56" y1="2" x2="72" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe08a" />
          <stop offset="1" stopColor="#e6a325" />
        </linearGradient>
      </defs>

      {/* antenna + sparkle */}
      <path d="M64 32V20" stroke="#0d5ce0" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M64 3l2.6 6.1 6.1 2.6-6.1 2.6L64 20.4l-2.6-6.1-6.1-2.6 6.1-2.6L64 3z"
        fill={`url(#${star})`}
      />

      {/* side "ears" */}
      <circle cx="22" cy="68" r="7.5" fill="#0f61e6" />
      <circle cx="106" cy="68" r="7.5" fill="#0f61e6" />

      {/* body */}
      <rect x="22" y="32" width="84" height="76" rx="28" fill={`url(#${body})`} />
      <ellipse cx="52" cy="52" rx="23" ry="14" fill="#ffffff" opacity="0.18" />

      {/* eyes */}
      <ellipse cx="50" cy="60" rx="9.5" ry="11.5" fill="#ffffff" />
      <ellipse cx="78" cy="60" rx="9.5" ry="11.5" fill="#ffffff" />
      <circle cx="51.5" cy="62" r="5.2" fill="#14213d" />
      <circle cx="79.5" cy="62" r="5.2" fill="#14213d" />
      <circle cx="53.6" cy="59.4" r="1.9" fill="#ffffff" />
      <circle cx="81.6" cy="59.4" r="1.9" fill="#ffffff" />

      {/* blush */}
      <ellipse cx="39" cy="72" rx="6" ry="3.4" fill="#ff8aa8" opacity="0.55" />
      <ellipse cx="89" cy="72" rx="6" ry="3.4" fill="#ff8aa8" opacity="0.55" />

      {/* smile */}
      <path
        d="M55 75c3.4 4 14.6 4 18 0"
        stroke="#14213d"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* % belly badge */}
      <circle cx="64" cy="95" r="13" fill="#ffffff" />
      <circle cx="64" cy="95" r="13" stroke="#ffd166" strokeWidth="2.6" />
      <text
        x="64"
        y="100.5"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill="#0d5ce0"
        fontFamily="var(--font-display)"
      >
        %
      </text>
    </svg>
  );
}

/** A single 4-point sparkle star. */
export function Sparkle({
  size = 16,
  className,
  color = "currentColor",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2c.5 4.4 3.1 7 7.5 7.5C15.1 10 12.5 12.6 12 17c-.5-4.4-3.1-7-7.5-7.5C8.9 9 11.5 6.4 12 2z"
        fill={color}
      />
    </svg>
  );
}

/** A stack of twinkling stars + soft orbs to decorate a gradient hero. Absolute-
 *  positioned; drop inside a `relative overflow-hidden` container. */
export function HeroSparkles({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <span className="absolute right-6 top-5 text-white/80 animate-twinkle">
        <Sparkle size={18} />
      </span>
      <span className="absolute right-16 top-14 text-white/60 animate-twinkle" style={{ animationDelay: "0.6s" }}>
        <Sparkle size={11} />
      </span>
      <span className="absolute left-6 bottom-6 text-white/50 animate-twinkle" style={{ animationDelay: "1.1s" }}>
        <Sparkle size={13} />
      </span>
      <span className="absolute -right-6 -bottom-8 h-28 w-28 rounded-full bg-white/10" />
      <span className="absolute -left-8 -top-10 h-24 w-24 rounded-full bg-white/10" />
    </div>
  );
}
