"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/display";
import { useMe, useApi, apiFetch } from "@/lib/client";
import { Icon, type IconName } from "./icons";
import { Avatar, Button } from "./ui";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-soft">
        <Icon name="ticket" size={20} />
      </span>
      <span className="font-display text-[19px] font-semibold tracking-tight text-ink">
        CouponShare
      </span>
    </Link>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
        active ? "bg-sand text-ink" : "text-ink-soft hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}

function Tab({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: IconName;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
        active ? "text-accent" : "text-ink-soft",
      )}
    >
      <Icon name={icon} size={22} strokeWidth={active ? 2.1 : 1.75} />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { me, refetch } = useMe();
  const { data: notif } = useApi<{ unread_count: number }>(me ? "/api/v1/notifications" : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = notif?.unread_count ?? 0;

  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    setMenuOpen(false);
    await refetch();
    window.location.href = "/";
  }

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo />

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink href="/" label="探索" active={isActive("/") && pathname === "/"} />
            <NavLink href="/wallet" label="我的錢包" active={isActive("/wallet")} />
            <NavLink href="/score" label="貢獻值" active={isActive("/score")} />
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {me ? (
              <>
                <Button
                  href="/new"
                  size="sm"
                  icon="plus"
                  className="hidden md:inline-flex"
                >
                  新增優惠券
                </Button>
                <Link
                  href="/notifications"
                  aria-label="通知"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand/70 hover:text-ink"
                >
                  <Icon name="bell" size={20} />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-sand/70"
                  >
                    <Avatar name={me.display_name} url={me.avatar_url} size={32} />
                    <span className="hidden text-sm font-medium text-ink sm:inline">
                      {me.contribution_score}
                      <span className="ml-0.5 text-ink-faint">分</span>
                    </span>
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-line bg-paper shadow-lift animate-pop">
                        <div className="border-b border-line px-4 py-3">
                          <p className="truncate font-medium text-ink">{me.display_name}</p>
                          <p className="truncate text-xs text-ink-faint">{me.email}</p>
                        </div>
                        <MenuItem href="/wallet" icon="wallet" label="我的錢包" onClick={() => setMenuOpen(false)} />
                        <MenuItem href="/score" icon="medal" label="貢獻值與等級" onClick={() => setMenuOpen(false)} />
                        <MenuItem href="/notifications" icon="bell" label="通知中心" onClick={() => setMenuOpen(false)} />
                        <button
                          onClick={logout}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-soft transition-colors hover:bg-sand/60"
                        >
                          <Icon name="logout" size={17} />
                          登出
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <Button href="/login" size="sm" icon="login" variant="primary">
                登入
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-12">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-stretch px-2">
          <Tab href="/" icon="compass" label="探索" active={pathname === "/"} />
          <Tab href="/wallet" icon="wallet" label="錢包" active={isActive("/wallet")} />
          <div className="flex flex-1 items-center justify-center">
            <Link
              href="/new"
              aria-label="新增優惠券"
              className="-mt-6 flex h-13 w-13 items-center justify-center rounded-2xl bg-accent text-white shadow-lift transition-transform active:scale-95"
              style={{ height: 52, width: 52 }}
            >
              <Icon name="plus" size={26} strokeWidth={2.2} />
            </Link>
          </div>
          <Tab href="/score" icon="medal" label="貢獻" active={isActive("/score")} />
          <Tab href="/notifications" icon="bell" label="通知" active={isActive("/notifications")} />
        </div>
      </nav>
    </div>
  );
}

function MenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition-colors hover:bg-sand/60"
    >
      <Icon name={icon} size={17} />
      {label}
    </Link>
  );
}
