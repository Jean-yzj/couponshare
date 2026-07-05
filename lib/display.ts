// Pure presentation helpers shared across client components.

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const LEVEL_META: Record<
  string,
  { name: string; en: string; cls: string; stars: number; emblem: string; emblemEdge: string }
> = {
  LEVEL_1: { name: "新手", en: "Newcomer", cls: "bg-sand text-ink-soft", stars: 1, emblem: "bg-accent", emblemEdge: "shadow-[0_4px_0_0_var(--color-accent-press)]" },
  LEVEL_2: { name: "達人", en: "Pro", cls: "bg-teal-tint text-teal", stars: 2, emblem: "bg-teal", emblemEdge: "shadow-[0_4px_0_0_#14697c]" },
  LEVEL_3: { name: "傳奇", en: "Legend", cls: "bg-gold-tint text-gold", stars: 3, emblem: "bg-gold", emblemEdge: "shadow-[0_4px_0_0_#9c7419]" },
};

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "草稿", cls: "bg-sand text-ink-soft" },
  AVAILABLE: { label: "可領取", cls: "bg-pine-tint text-pine" },
  PENDING: { label: "處理中", cls: "bg-gold-tint text-gold" },
  CLAIMED: { label: "已領取", cls: "bg-accent-tint text-accent-press" },
  EXPIRED: { label: "已過期", cls: "bg-sand text-ink-faint" },
  CANCELLED: { label: "已取消", cls: "bg-sand text-ink-faint" },
  REPORTED: { label: "檢舉中", cls: "bg-accent-tint text-accent-press" },
  SUSPENDED: { label: "已暫停", cls: "bg-sand text-ink-faint" },
};

export function typeMeta(type: string) {
  return type === "GIFT"
    ? { label: "免費贈送", icon: "gift" as const, cls: "bg-pine-tint text-pine" }
    : { label: "交換", icon: "swap" as const, cls: "bg-teal-tint text-teal" };
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
}

export function expiryText(d: string | Date | null | undefined): { text: string; urgent: boolean } {
  if (!d) return { text: "無使用期限", urgent: false };
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return { text: "已過期", urgent: true };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return { text: `${hours} 小時後到期`, urgent: true };
  const days = Math.floor(hours / 24);
  if (days <= 7) return { text: `${days} 天後到期`, urgent: days <= 2 };
  return { text: `${formatDate(date)} 到期`, urgent: false };
}

export function relativeTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} 天前`;
  return formatDate(date);
}

const AVATAR_BG = ["#E8552D", "#BD8F37", "#2F7D5B", "#2B7787", "#9A5B3F", "#7A6CA8"];

export function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}

export function initials(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

// Google account avatars (lh3.googleusercontent.com) default to a large image;
// the `=sN-c` directive asks their CDN for an N-px square crop instead. A feed
// full of avatars then downloads a few KB each rather than dozens of full-size
// photos — a real win on mobile data. Non-Google URLs pass through untouched.
export function sizedAvatar(
  url: string | null | undefined,
  px = 96,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes("googleusercontent.com")) return url;
  // The size directive is always a trailing `=...`; drop any existing one first.
  return `${url.split("=")[0]}=s${px}-c`;
}
