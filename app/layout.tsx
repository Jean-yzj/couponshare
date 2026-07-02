import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

// GenSenRounded 2 TW (源泉圓體, Bold) — a chunky, rounded Traditional-Chinese
// font, self-hosted so it works under the CSP (font-src 'self'). The bold weight
// is declared across a 400–800 range so every UI weight uses these round, heavy
// glyphs with no thin fallback — that's what gives the whole UI its cute, bubbly feel.
const round = localFont({
  src: "./fonts/gensen-rounded-bold.woff2",
  variable: "--font-round",
  display: "swap",
  weight: "400 800",
  // Don't block/compete on first paint: text shows instantly in the system
  // fallback (PingFang) via swap, then upgrades to the rounded font once loaded.
  preload: false,
});

export const metadata: Metadata = {
  title: "CouponShare — 把用不到的優惠券，和需要的人分享",
  description:
    "分享、贈送、交換閒置的優惠券與票券。以互助與貢獻值為核心的票券共享社群。",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className={`${round.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
