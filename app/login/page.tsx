import type { Metadata } from "next";
import Client from "./Client";

const SITE = "https://couponshare.lazybearlife.com";

// 帶 ref 的網址是別人分享出去的邀請連結。在此之前它沿用全站預設的 OG 圖，
// 也就是首頁那張「這個網站是什麼」的卡——貼到 LINE 看起來像廣告而不是朋友的邀請。
// 沒有 ref 時維持原樣（就是一般的登入頁，不需要特別的分享卡）。
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const raw = (await searchParams).ref;
  const ref = Array.isArray(raw) ? raw[0] : raw;
  const base: Metadata = { robots: { index: false } };
  if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) return base;

  const image = `${SITE}/api/og/invite?ref=${encodeURIComponent(ref)}`;
  const title = "有人邀請你加入 CouponShare";
  const description = "把用不到的票券送給需要的人。免費贈送，不用點數也不用抽獎。";
  return {
    ...base,
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE}/login?ref=${encodeURIComponent(ref)}`,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function Page() {
  return <Client />;
}
