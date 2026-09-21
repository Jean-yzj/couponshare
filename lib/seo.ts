import type { Metadata } from "next";

export const SITE_URL = (process.env.APP_ORIGIN || "https://couponshare.lazybearlife.com").replace(/\/+$/, "");
export const SITE_NAME = "CouponShare";
export const SITE_TITLE = "CouponShare — 把用不到的優惠券，和需要的人分享";
export const SITE_DESCRIPTION =
  "分享、贈送、交換閒置的優惠券與票券。把「我用不到」交給「我需要」，不花一毛錢，也能讓世界溫暖一點。以互助與貢獻值為核心的票券共享社群。";
export const DEFAULT_OG_IMAGE = "/og-default.png";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  robots?: Metadata["robots"];
};

/** Keep public-page metadata consistent instead of inheriting the homepage card. */
export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  robots,
}: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(robots ? { robots } : {}),
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "zh_TW",
      type,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
