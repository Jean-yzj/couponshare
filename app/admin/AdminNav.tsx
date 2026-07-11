"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMe } from "@/lib/client";
import { cn } from "@/lib/display";

const TABS = [
  { href: "/admin", label: "數據總覽" },
  { href: "/admin/reports", label: "檢舉複核" },
  { href: "/admin/appeals", label: "申訴複核" },
  { href: "/admin/social-posts", label: "發文審核" },
  { href: "/admin/business-leads", label: "企業合作" },
  { href: "/admin/brands", label: "企業票券" },
  { href: "/admin/suspended", label: "被停權帳號" },
  { href: "/admin/removed-coupons", label: "被下架票券" },
];

export function AdminNav({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const pathname = usePathname() || "";

  return (
    <div className="mx-auto max-w-5xl">
      {me?.is_admin && (
        <div className="no-scrollbar sticky top-16 z-30 -mx-4 mb-6 flex items-center gap-1 overflow-x-auto overscroll-x-contain border-b border-line bg-canvas px-4 sm:-mx-6 sm:px-6">
          {TABS.map((t) => {
            const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-soft hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
}
