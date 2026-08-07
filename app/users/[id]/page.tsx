import type { Metadata } from "next";
import Client from "./Client";

// 個人檔案頁刻意 **不進搜尋索引**。
//
// 這頁公開得到的東西是真人的暱稱、分享過哪些券、收到什麼評價、加入多久。
// 這些資訊在站內看得到是合理的（要判斷交易對象可不可信），但被 Google 收錄
// 是另一回事——使用者註冊時沒有同意「你的暱稱和分享紀錄會出現在搜尋結果」。
//
// SEO 那一面也不划算：沒有人會搜別人的暱稱。索引個人頁換不到流量，卻讓
// 真實使用者暴露在搜尋結果裡；而且一旦被收錄，之後要撤下來得等快取過期，
// 遠比一開始就不收錄麻煩。
//
// 如果之後決定要開放（例如做成公開的貢獻者排行），把 robots 那行拿掉即可，
// 但那應該是產品決策，不是 SEO 的順手改動。
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Page() {
  return <Client />;
}
