import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

// GenSenRounded 2 TW (源泉圓體, Bold) — a chunky, rounded Traditional-Chinese
// font, self-hosted so it works under the CSP (font-src 'self'). It gives headings
// and brand text their cute, bubbly feel.
//
// SUBSET to ~370KB (from 1.1MB): covers all static UI text + every current coupon
// title/brand, so headings and coupon names render round. User display names use
// the system font (--font-sans) — they're too diverse to subset. Regenerate the
// subset the original (kept in git history before this commit) with pyftsubset if
// show mixed rounded/system glyphs. The original 1.1MB font stays in git history.
const round = localFont({
  src: "./fonts/gensen-rounded-bold.woff2",
  variable: "--font-round",
  display: "optional",
  weight: "700",
  fallback: ["PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "system-ui"],
  adjustFontFallback: false,
  // Keep the 1MB CJK display font off the critical path; system Traditional
  // Chinese fonts render body text with steadier glyph metrics.
  preload: false,
});

const SITE_URL = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");
const SITE_TITLE = "CouponShare — 把用不到的優惠券，和需要的人分享";
const SITE_DESC =
  "分享、贈送、交換閒置的優惠券與票券。把「我用不到」交給「我需要」，不花一毛錢，也能讓世界溫暖一點。以互助與貢獻值為核心的票券共享社群。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · CouponShare" },
  description: SITE_DESC,
  applicationName: "CouponShare",
  keywords: [
    "優惠券", "票券", "兌換券", "折價券", "分享", "贈送", "交換",
    "超商優惠", "咖啡買一送一", "免費兌換", "CouponShare",
  ],
  // No global canonical here — that would point every page at the homepage.
  // Each page declares its own (app/page.tsx, /terms, /privacy, …).
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "CouponShare",
    locale: "zh_TW",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "CouponShare" }],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESC, images: ["/og-default.png"] },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className={`${round.variable} h-full antialiased`}>
      <head>
        {/* Most avatars are Google account photos — open the TLS connection to
            their CDN early so a feed of avatars doesn't each pay a cold handshake
            (worst on mobile, where a new connection can cost hundreds of ms). */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
