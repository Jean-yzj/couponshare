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

const BTN_VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent-press shadow-soft",
  secondary: "bg-sand text-ink hover:bg-sand-2",
  outline: "border border-line bg-paper text-ink hover:bg-canvas-2",
  ghost: "text-ink-soft hover:bg-sand/60",
  danger: "bg-danger-tint text-danger hover:brightness-95",
  gold: "bg-gold text-white hover:brightness-95 shadow-soft",
} as const;

const BTN_SIZES = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2",
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
    "inline-flex items-center justify-center rounded-full font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none",
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
