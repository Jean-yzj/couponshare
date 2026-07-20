import { cn } from "@/lib/display";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

/**
 * CouponShare brand mark: one coupon moving from blue to slate, with the
 * forward arrow expressing "把用不到的券，交給需要的人".
 */
export function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 128 80"
      fill="none"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 8H64V72H16C11.6 72 8 68.4 8 64V52C16 52 22 47 22 40C22 33 16 28 8 28V16C8 11.6 11.6 8 16 8Z"
        fill="#2867E0"
      />
      <path
        d="M64 8H112C116.4 8 120 11.6 120 16V28C112 28 106 33 106 40C106 47 112 52 120 52V64C120 68.4 116.4 72 112 72H64V8Z"
        fill="#7B8492"
      />
      <path d="M46 28H64V20L86 40L64 60V52H46V28Z" fill="white" />
    </svg>
  );
}

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
};

export function BrandLogo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* cn 是純拼接（無 tailwind-merge），預設與覆寫並存時由樣式表順序決定，
          所以尺寸類別採「有覆寫就不帶預設」而不是疊加。 */}
      <BrandMark className={cn("w-auto", markClassName ?? "h-6")} />
      {showWordmark && (
        <span
          className={cn(
            "font-display font-extrabold tracking-tight text-ink",
            wordmarkClassName ?? "text-[19px]",
          )}
        >
          CouponShare
        </span>
      )}
    </span>
  );
}
