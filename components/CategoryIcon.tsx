import type { ReactNode } from "react";

// Hand-drawn monoline category glyphs for the coupon-card brand disc. Inline SVG
// (no emoji, no icon font) so they stay crisp at any size and inherit the disc's
// white via currentColor. viewBox is a shared 0 0 24 24; each entry is the inner
// paths only.
const GLYPHS: Record<string, ReactNode> = {
  // storefront: body + awning + door
  CONVENIENCE: (
    <>
      <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M3 10l1.8-4.5h14.4L21 10z" />
      <path d="M9.5 20v-4.6h5V20" />
    </>
  ),
  // coffee mug + steam
  COFFEE: (
    <>
      <path d="M5 8h10v5a5 5 0 0 1-10 0z" />
      <path d="M15 9h2.2a2.3 2.3 0 0 1 0 4.6H15" />
      <path d="M8 2.6v2.2M11.5 2.6v2.2" />
    </>
  ),
  // bubble-tea cup + straw + pearls
  DRINK: (
    <>
      <path d="M6.5 8h11l-1.2 11.2a1 1 0 0 1-1 .8H8.7a1 1 0 0 1-1-.8z" />
      <path d="M5.5 8h13" />
      <path d="M14.5 8l2.2-5" />
      <circle cx="10" cy="17.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="13.2" cy="17.6" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // burger: top bun, filling, bottom bun
  FASTFOOD: (
    <>
      <path d="M4 10a8 8 0 0 1 16 0z" />
      <path d="M4.5 13h15" />
      <path d="M5 16h14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
    </>
  ),
  // cupcake: frosting, wrapper, cherry
  DESSERT: (
    <>
      <path d="M6.5 11a5.5 5 0 0 1 11 0z" />
      <path d="M7.6 11h8.8l-1 8.2a1 1 0 0 1-1 .8H9.6a1 1 0 0 1-1-.8z" />
      <circle cx="12" cy="4.4" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 5.6v1" />
    </>
  ),
  // fork + knife
  RESTAURANT: (
    <>
      <path d="M7 3v4.5a2 2 0 0 0 4 0V3" />
      <path d="M9 7.5V21" />
      <path d="M16 3c1.8 1.5 1.8 6.2 0 8.2" />
      <path d="M16 11.2V21" />
    </>
  ),
  // shopping bag + handle
  SHOPPING: (
    <>
      <path d="M6 8h12l-1 11.6a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9z" />
      <path d="M9 8V6.2a3 3 0 0 1 6 0V8" />
    </>
  ),
  // media screen + play triangle
  ENTERTAINMENT: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="M10.4 9.1l4.4 2.9-4.4 2.9z" fill="currentColor" stroke="none" />
    </>
  ),
  // price tag + hole
  OTHER: (
    <>
      <path d="M12.6 3H5.5A2.5 2.5 0 0 0 3 5.5v7.1a2 2 0 0 0 .6 1.4l6.9 6.9a2 2 0 0 0 2.8 0l6.5-6.5a2 2 0 0 0 0-2.8l-6.9-6.9A2 2 0 0 0 12.6 3z" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
};

export function CategoryIcon({
  category,
  size = 20,
  className,
}: {
  category?: string | null;
  size?: number;
  className?: string;
}) {
  const glyph = GLYPHS[category && category in GLYPHS ? category : "OTHER"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
