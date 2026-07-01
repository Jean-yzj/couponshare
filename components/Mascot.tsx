import { useId } from "react";
import { cn } from "@/lib/display";

/**
 * "Coupy" — the CouponShare mascot. A round, big-eyed azure buddy hugging a
 * little gold coupon, with a tiny sprout on top (sharing = growing kindness).
 * Pure SVG so it renders crisply on any background and needs no raster asset.
 * Gradient ids are scoped via useId to stay unique across multiple mascots.
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
  const body = `b-${uid}`;
  const coup = `c-${uid}`;
  const leaf = `l-${uid}`;
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
        <linearGradient id={body} x1="30" y1="24" x2="100" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5fa8ff" />
          <stop offset="1" stopColor="#0d5ce0" />
        </linearGradient>
        <linearGradient id={coup} x1="42" y1="84" x2="86" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe08a" />
          <stop offset="1" stopColor="#eaa61f" />
        </linearGradient>
        <linearGradient id={leaf} x1="56" y1="6" x2="72" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4fd58c" />
          <stop offset="1" stopColor="#12a05e" />
        </linearGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="64" cy="117" rx="29" ry="4.5" fill="#0d5ce0" opacity="0.12" />

      {/* sprout */}
      <path d="M64 28c-1-6-3-9-4-13" stroke="#12a05e" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 15c-5-2-9-1-11 2 3 3 8 3 11-2z" fill={`url(#${leaf})`} />
      <path d="M61 13c1-5 4-8 8-8-0 4-3 8-8 8z" fill={`url(#${leaf})`} />

      {/* body */}
      <rect x="26" y="26" width="76" height="72" rx="34" fill={`url(#${body})`} />
      <ellipse cx="52" cy="45" rx="18" ry="11" fill="#ffffff" opacity="0.22" />

      {/* big glossy eyes */}
      <ellipse cx="51" cy="57" rx="8" ry="10" fill="#12203c" />
      <ellipse cx="77" cy="57" rx="8" ry="10" fill="#12203c" />
      <circle cx="54" cy="53" r="3.1" fill="#ffffff" />
      <circle cx="80" cy="53" r="3.1" fill="#ffffff" />
      <circle cx="49" cy="60" r="1.5" fill="#ffffff" />
      <circle cx="75" cy="60" r="1.5" fill="#ffffff" />

      {/* blush */}
      <ellipse cx="38" cy="68" rx="6" ry="3.6" fill="#ff8fac" opacity="0.6" />
      <ellipse cx="90" cy="68" rx="6" ry="3.6" fill="#ff8fac" opacity="0.6" />

      {/* happy mouth */}
      <path d="M57 69c3 5.5 11 5.5 14 0" stroke="#12203c" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* little coupon hugged in front */}
      <g transform="rotate(-7 64 98)">
        <rect x="42" y="86" width="44" height="26" rx="7" fill={`url(#${coup})`} />
        <circle cx="42" cy="99" r="3.2" fill={`url(#${body})`} />
        <circle cx="86" cy="99" r="3.2" fill={`url(#${body})`} />
        <path
          d="M55 91l1.6 3.4 3.7.5-2.7 2.6.6 3.7L55 104l-3.3 1.7.6-3.7-2.7-2.6 3.7-.5z"
          fill="#ffffff"
        />
        <rect x="63" y="94" width="16" height="2.6" rx="1.3" fill="#ffffff" opacity="0.85" />
        <rect x="63" y="100" width="11" height="2.6" rx="1.3" fill="#ffffff" opacity="0.7" />
      </g>

      {/* hands gripping the coupon */}
      <circle cx="41" cy="94" r="6.5" fill={`url(#${body})`} />
      <circle cx="87" cy="92" r="6.5" fill={`url(#${body})`} />

      {/* sparkle */}
      <path
        d="M104 28l1.5 3.6 3.6 1.5-3.6 1.5L104 40l-1.5-3.6-3.6-1.5 3.6-1.5z"
        fill="#ffd166"
      />
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
