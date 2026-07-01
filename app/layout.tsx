import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

// jf open 粉圓 (open-huninn 2.0) — a rounded, friendly Traditional-Chinese font,
// self-hosted so it works under the CSP (font-src 'self'). This is what gives the
// whole UI its cute / game-like character.
const huninn = localFont({
  src: "./fonts/jf-openhuninn.woff2",
  variable: "--font-round",
  display: "swap",
  weight: "400",
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
    <html lang="zh-Hant" className={`${huninn.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
