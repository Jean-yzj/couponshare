import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "刪除帳號 — CouponShare",
  description:
    "說明如何刪除 CouponShare 帳號、刪除後會移除哪些資料，以及依法令與爭議處理需要保留的資料與其期間。",
};

function Clause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-ink">
        {n}、{title}
      </h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function AccountDeletionPage() {
  return (
    <div className="mx-auto max-w-2xl pb-12">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} /> 回到首頁
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight text-ink">刪除帳號</h1>
      <p className="mt-1.5 text-sm text-ink-faint">最後更新：2026 年 7 月 26 日</p>

      <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
        您可以隨時刪除您的 CouponShare 帳號。本頁說明刪除的方式、刪除後立即發生的事，
        以及本平台依法令義務與爭議處理需要保留的資料範圍。您不需要安裝 App、也不需要登入即可閱讀本頁說明。
      </p>

      <div className="mt-7 space-y-6">
        <Clause n="一" title="如何刪除帳號">
          <p>1.1 在 App 或網站中自行刪除（建議）：</p>
          <p className="pl-4">
            前往「個人」頁面，捲動至頁面底部的「刪除帳號」區塊，於欄位中輸入「刪除帳號」四字以確認，
            再點選「永久刪除帳號」。系統會再次跳出確認提示，確認後即立即執行，無需等待審核。
          </p>
          <p>1.2 若您已無法登入或已移除 App：</p>
          <p className="pl-4">
            請以您註冊時使用的電子郵件地址，來信至{" "}
            <a
              href="mailto:iamlazybear2023@gmail.com?subject=%E5%88%AA%E9%99%A4%20CouponShare%20%E5%B8%B3%E8%99%9F"
              className="font-medium text-accent hover:text-accent-press"
            >
              iamlazybear2023@gmail.com
            </a>
            ，主旨註明「刪除 CouponShare 帳號」。本平台於核對身分後處理，一般於 7 個工作日內完成。
          </p>
        </Clause>

        <Clause n="二" title="刪除後立即移除的資料">
          <p>帳號刪除為不可復原之操作。執行後系統將立即：</p>
          <p className="pl-4">(a) 清除您的電子郵件地址、密碼、第三方登入識別碼及大頭貼影像；</p>
          <p className="pl-4">(b) 將您的顯示名稱一律改為「已刪除的使用者」，您的個人頁面不再顯示可識別您的資訊；</p>
          <p className="pl-4">(c) 將您尚在架上、未被領取的票券全部下架取消，其他使用者無法再申請；</p>
          <p className="pl-4">(d) 刪除您的推播通知裝置註冊資料，您將不再收到任何通知；</p>
          <p className="pl-4">(e) 刪除您追蹤的品牌清單，以及您與其他使用者之間的封鎖關係；</p>
          <p className="pl-4">(f) 登出您在所有裝置上的登入狀態。</p>
        </Clause>

        <Clause n="三" title="保留的資料與其原因">
          <p>
            3.1 為維護已完成交易之他方使用者的權益、處理可能的檢舉與爭議，並符合法令之紀錄保存義務，
            下列資料在您的帳號刪除後仍會保留，但均已與前條所述之個人識別資訊分離，無法用以識別您本人：
          </p>
          <p className="pl-4">(a) 已完成或進行中的交換紀錄、其訊息與評價；</p>
          <p className="pl-4">(b) 檢舉與申訴案件之處理紀錄；</p>
          <p className="pl-4">(c) 系統稽核日誌（記錄帳號曾執行刪除此一事實，供資安查核）。</p>
          <p>
            3.2 前述資料於達成上述目的所必要之期間內保存；法令另有更長保存期間之規定者，從其規定。
          </p>
          <p>
            3.3 若您希望本平台一併清除前述保留資料，請來信說明。本平台將在不牴觸法令義務及不侵害交易他方權益的前提下協助處理。
          </p>
        </Clause>

        <Clause n="四" title="刪除前的提醒">
          <p className="pl-4">(a) 帳號刪除後無法復原，您累積的貢獻值、等級與成就將一併失效，且無法轉移至新帳號；</p>
          <p className="pl-4">(b) 若您仍有進行中的交換，建議先完成或取消，以免造成他方使用者的困擾；</p>
          <p className="pl-4">(c) 您日後可以同一電子郵件地址重新註冊，但將視為全新帳號，不會回復先前的任何紀錄。</p>
        </Clause>

        <Clause n="五" title="聯絡方式">
          <p>
            如對帳號刪除或您的個人資料有任何疑問，請來信：{" "}
            <a
              href="mailto:iamlazybear2023@gmail.com"
              className="font-medium text-accent hover:text-accent-press"
            >
              iamlazybear2023@gmail.com
            </a>
          </p>
          <p className="text-sm text-ink-faint">
            另請一併參閱本平台之{" "}
            <Link href="/privacy" className="font-medium text-accent hover:text-accent-press">
              隱私權政策
            </Link>{" "}
            與{" "}
            <Link href="/terms" className="font-medium text-accent hover:text-accent-press">
              使用條款
            </Link>
            。
          </p>
        </Clause>
      </div>
    </div>
  );
}
