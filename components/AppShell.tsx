"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/display";
import { useMe, useApi, apiFetch } from "@/lib/client";
import { Icon, type IconName } from "./icons";
import { Avatar, Button } from "./ui";
import { UtmCapture } from "./UtmCapture";

function Logo() {
  return (
    <Link href="/" prefetch={true} className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-grad-brand text-white shadow-glow">
        <Icon name="ticket" size={20} />
      </span>
      <span className="font-display text-[22px] font-extrabold tracking-tight text-ink">
        CouponShare
      </span>
    </Link>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      prefetch={true}
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
      prefetch={true}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
        active ? "text-accent" : "text-ink-soft",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
          active && "bg-accent-tint",
        )}
      >
        <Icon name={icon} size={21} strokeWidth={active ? 2.2 : 1.75} />
      </span>
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { me, refetch } = useMe();
  const { data: notif } = useApi<{ unread_count: number }>(me ? "/api/v1/notifications" : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const unread = notif?.unread_count ?? 0;

  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  // Threads promo — nudge logged-in users toward the 發文換次數 reward. Starts
  // hidden (so SSR/hydration match), then reveals unless dismissed this session (X)
  // or forever (不要再顯示). Storage may throw in private mode — fail closed (stay hidden).
  useEffect(() => {
    if (!me || me.status === "SUSPENDED") return;
    try {
      if (localStorage.getItem("cs_threads_promo_off") || sessionStorage.getItem("cs_threads_promo_x")) {
        return;
      }
    } catch {
      return;
    }
    setPromoOpen(true);
  }, [me]);

  function closePromo(forever: boolean) {
    try {
      if (forever) localStorage.setItem("cs_threads_promo_off", "1");
      else sessionStorage.setItem("cs_threads_promo_x", "1");
    } catch {
      /* storage blocked — just hide for now */
    }
    setPromoOpen(false);
  }

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    setMenuOpen(false);
    await refetch();
    window.location.href = "/";
  }

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <UtmCapture />
      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo />

          {me && (
            <nav className="ml-4 hidden items-center gap-1 md:flex">
              <NavLink href="/" label="探索" active={isActive("/") && pathname === "/"} />
              <NavLink href="/wallet" label="我的錢包" active={isActive("/wallet")} />
              <NavLink href="/score" label="貢獻值" active={isActive("/score")} />
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {me ? (
              <>
                <span className="hidden md:inline-flex">
                  <Button href="/new" size="sm" icon="plus">
                    新增優惠券
                  </Button>
                </span>
                <Link
                  href="/notifications"
                  prefetch={true}
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
                        <MenuItem href="/settings" icon="cog" label="個人設定" onClick={() => setMenuOpen(false)} />
                        <MenuItem href="/notifications" icon="bell" label="通知中心" onClick={() => setMenuOpen(false)} />
                        <a
                          href="https://www.instagram.com/lazybearlife_"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition-colors hover:bg-sand/60"
                        >
                          <Icon name="instagram" size={17} />
                          聯絡創作者
                        </a>
                        {me.is_admin && (
                          <MenuItem
                            href="/admin"
                            icon="shield"
                            label="管理後台"
                            onClick={() => setMenuOpen(false)}
                          />
                        )}
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

      <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6", me ? "pb-24 md:pb-12" : "pb-12")}>
        {me?.status === "SUSPENDED" && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger-tint px-4 py-3">
            <Icon name="ban" size={18} className="shrink-0 text-danger" />
            <p className="flex-1 text-sm text-danger">
              你的帳號已被停權，目前無法上架或申請票券。
            </p>
            <Link
              href="/appeal"
              prefetch={true}
              className="shrink-0 rounded-full bg-danger px-3.5 py-1.5 text-sm font-medium text-white"
            >
              提出申訴
            </Link>
          </div>
        )}

        {promoOpen && pathname !== "/social-reward" && (
          <div className="relative mb-5 overflow-hidden rounded-2xl bg-grad-brand p-4 text-white shadow-glow sm:p-5">
            <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-14 right-20 h-28 w-28 rounded-full bg-white/10" />
            <button
              onClick={() => closePromo(false)}
              aria-label="關閉"
              className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-white/75 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Icon name="x" size={17} />
            </button>
            <div className="relative flex items-start gap-3.5 pr-8">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Icon name="sparkles" size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-extrabold sm:text-lg">
                  發一篇 Threads，換申請次數
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/85">
                  發文分享使用心得，審核通過送 10 次申請、破百讚送 20 次（每月限 500 名）。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link
                    href="/social-reward"
                    prefetch={true}
                    onClick={() => closePromo(false)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-accent-press shadow-soft transition-transform active:scale-[0.98]"
                  >
                    前往看看 <Icon name="chevronRight" size={14} />
                  </Link>
                  <button
                    onClick={() => closePromo(true)}
                    className="text-xs font-medium text-white/70 transition-colors hover:text-white"
                  >
                    不要再顯示
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {children}

        <footer className="mt-12 border-t border-line/70 pt-6 text-center text-xs text-ink-faint">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            <Link href="/terms" className="transition-colors hover:text-ink">
              使用條款
            </Link>
            <span className="text-line">·</span>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              隱私權政策
            </Link>
            <span className="text-line">·</span>
            <a href="mailto:iamlazybear2023@gmail.com" className="transition-colors hover:text-ink">
              聯絡我們
            </a>
            <span className="text-line">·</span>
            <a
              href="https://www.instagram.com/lazybearlife_"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-ink"
            >
              <Icon name="instagram" size={13} /> 聯絡創作者
            </a>
          </div>
          <p className="mt-2.5 text-ink-faint/80">© 2026 CouponShare · 歡迎品牌合作</p>
        </footer>
      </main>

      {/* Mobile bottom navigation — only when signed in */}
      {me && (
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper md:hidden">
        <div className="mx-auto flex max-w-md items-stretch px-2">
          <Tab href="/" icon="compass" label="探索" active={pathname === "/"} />
          <Tab href="/wallet" icon="wallet" label="錢包" active={isActive("/wallet")} />
          <div className="flex flex-1 items-center justify-center">
            <Link
              href="/new"
              prefetch={true}
              aria-label="新增優惠券"
              className="-mt-7 flex items-center justify-center rounded-2xl bg-grad-brand text-white shadow-glow transition-transform active:scale-95"
              style={{ height: 54, width: 54 }}
            >
              <Icon name="plus" size={26} strokeWidth={2.2} />
            </Link>
          </div>
          <Tab href="/score" icon="medal" label="貢獻" active={isActive("/score")} />
          <Tab href="/notifications" icon="bell" label="通知" active={isActive("/notifications")} />
        </div>
      </nav>
      )}
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
      prefetch={true}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition-colors hover:bg-sand/60"
    >
      <Icon name={icon} size={17} />
      {label}
    </Link>
  );
}
