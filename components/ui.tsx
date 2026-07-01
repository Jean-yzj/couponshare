import Link from "next/link";
import type { ReactNode } from "react";
import { cn, LEVEL_META, STATUS_META, typeMeta, avatarColor, initials } from "@/lib/display";
import { Icon, type IconName } from "./icons";

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("animate-spin", className)}
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("eyebrow inline-flex items-center gap-1.5 text-accent", className)}>
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// Glossy gradient pills with a soft coloured glow (premium "cute fintech" look).
const BTN_VARIANTS = {
  primary:
    "bg-grad-brand text-white shadow-glow hover:brightness-[1.05] active:brightness-95",
  secondary:
    "bg-white text-ink ring-1 ring-line shadow-soft hover:bg-sand/60",
  outline:
    "border border-line bg-white/70 text-ink hover:border-accent/40 hover:bg-white",
  ghost: "text-ink-soft hover:bg-sand/70",
  danger: "bg-danger-tint text-danger hover:brightness-95",
  gold: "bg-grad-gold text-white shadow-glow-gold hover:brightness-[1.05] active:brightness-95",
} as const;

const BTN_SIZES = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-13 px-7 text-base gap-2",
} as const;

type ButtonProps = {
  variant?: keyof typeof BTN_VARIANTS;
  size?: keyof typeof BTN_SIZES;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  full?: boolean;
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  full,
  href,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = cn(
    "inline-flex select-none items-center justify-center rounded-full font-semibold transition-[transform,box-shadow,background-color,filter] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    BTN_VARIANTS[variant],
    BTN_SIZES[size],
    full && "w-full",
    className,
  );
  const inner = (
    <>
      {loading ? (
        <Spinner size={size === "sm" ? 15 : 17} />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 16 : 18} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={16} /> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {inner}
    </button>
  );
}

export function IconButton({
  name,
  size = 20,
  className,
  label,
  ...rest
}: { name: IconName; size?: number; label?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand/70 hover:text-ink",
        className,
      )}
      {...rest}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-paper shadow-soft", className)} {...rest}>
      {children}
    </div>
  );
}

export function Pill({
  className,
  children,
  icon,
}: {
  className?: string;
  children: ReactNode;
  icon?: IconName;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function LevelBadge({ level }: { level: string }) {
  const m = LEVEL_META[level] ?? LEVEL_META.LEVEL_1;
  return (
    <Pill className={m.cls} icon="medal">
      {m.name}
      <span className="ml-0.5 text-[10px] leading-none tracking-tight">{"★".repeat(m.stars)}</span>
    </Pill>
  );
}

export function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-sand text-ink-soft" };
  return <Pill className={m.cls}>{m.label}</Pill>;
}

export function TypePill({ type }: { type: string }) {
  const m = typeMeta(type);
  return (
    <Pill className={m.cls} icon={m.icon}>
      {m.label}
    </Pill>
  );
}

export function Avatar({
  name,
  url,
  size = 40,
  className,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: url ? undefined : avatarColor(name),
        fontSize: size * 0.4,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

export function EmptyState({
  icon = "sparkle",
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper/60 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sand text-ink-soft">
        <Icon name={icon} size={26} />
      </span>
      <p className="mt-4 font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {required && <span className="text-accent">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-accent-press">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_CLS =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(INPUT_CLS, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(INPUT_CLS, "min-h-24 resize-y leading-relaxed", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(INPUT_CLS, "appearance-none pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

export function NeedLogin({ message = "登入後即可使用此功能" }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md py-10">
      <EmptyState
        icon="lock"
        title="請先登入"
        hint={message}
        action={
          <Button href="/login" icon="login">
            前往登入
          </Button>
        }
      />
    </div>
  );
}

export function Banner({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "warn" | "success";
  icon?: IconName;
  children: ReactNode;
}) {
  const tones = {
    info: "bg-accent-tint text-accent-press",
    warn: "bg-danger-tint text-danger",
    success: "bg-pine-tint text-pine",
  } as const;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm", tones[tone])}>
      {icon && <Icon name={icon} size={18} className="mt-0.5 shrink-0" />}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

// ── Gradient hero panel: azure (default) or gold, rounded with a soft glow. ──
export function GradientPanel({
  tone = "brand",
  className,
  children,
  ...rest
}: { tone?: "brand" | "gold"; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[26px] text-white",
        tone === "gold" ? "bg-grad-gold shadow-glow-gold" : "bg-grad-brand-deep shadow-glow",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ── Progress bar. onDark sits on a gradient hero (white fill, translucent track). ──
export function ProgressBar({
  value,
  onDark,
  className,
}: {
  value: number;
  onDark?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(
        "h-3 w-full overflow-hidden rounded-full",
        onDark ? "bg-white/25" : "bg-sand",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700", onDark ? "bg-white" : "bg-grad-brand")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Gamified achievement disc. Locked = muted with a lock badge. ──
const BADGE_TONE: Record<string, string> = {
  blue: "bg-grad-brand",
  gold: "bg-grad-gold",
  pine: "bg-[image:var(--grad-pine)]",
  teal: "bg-[image:var(--grad-teal)]",
  grape: "bg-[image:var(--grad-grape)]",
  rose: "bg-[image:var(--grad-rose)]",
};

export function AchievementBadge({
  icon,
  label,
  tone = "blue",
  unlocked = true,
}: {
  icon: IconName;
  label: string;
  tone?: keyof typeof BADGE_TONE;
  unlocked?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-[20px] text-white transition-transform",
            unlocked ? cn(BADGE_TONE[tone], "shadow-soft") : "bg-sand text-ink-faint",
          )}
        >
          <Icon name={icon} size={28} strokeWidth={2} />
        </div>
        {!unlocked && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-ink-faint text-white">
            <Icon name="lock" size={11} />
          </span>
        )}
      </div>
      <span className={cn("text-xs font-medium leading-tight", unlocked ? "text-ink" : "text-ink-faint")}>
        {label}
      </span>
    </div>
  );
}

// ── Compact stat tile for dashboards. ──
export function StatTile({
  icon,
  label,
  value,
  tone = "accent",
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  tone?: "accent" | "gold" | "pine" | "teal";
}) {
  const tones = {
    accent: "bg-accent-tint text-accent",
    gold: "bg-gold-tint text-gold-ink",
    pine: "bg-pine-tint text-pine",
    teal: "bg-teal-tint text-teal",
  } as const;
  return (
    <div className="rounded-2xl border border-line bg-paper p-4 shadow-soft">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
        <Icon name={icon} size={18} />
      </span>
      <p className="mt-3 font-display text-2xl font-extrabold leading-none text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
    </div>
  );
}
