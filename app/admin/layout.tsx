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
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const pathname = usePathname() || "";

  return (
    <div className="mx-auto max-w-5xl">
      {me?.is_admin && (
        <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-line">
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
