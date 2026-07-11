import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "隱私權政策",
  alternates: { canonical: "/privacy" },
  description:
    "CouponShare 隱私權政策。說明本平台如何蒐集、處理、利用及保護您的個人資料，並依個人資料保護法辦理。",
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

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl pb-12">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} /> 回到首頁
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight text-ink">隱私權政策</h1>
      <p className="mt-1.5 text-sm text-ink-faint">生效日期：2026 年 7 月 1 日</p>

      <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
        本隱私權政策（下稱「本政策」）說明 CouponShare（下稱「本平台」）於您使用本平台服務（下稱「本服務」）時，
        如何蒐集、處理、利用及保護您的個人資料。本平台重視您的隱私，並依中華民國個人資料保護法及相關法令辦理。
        當您使用本服務，即表示您已閱讀並同意本政策之內容。
      </p>

      <div className="mt-7 space-y-6">
        <Clause n="一" title="蒐集之個人資料類別">
          <p>1.1 您主動提供之資料：</p>
          <p className="pl-4">
            (a) 帳戶資料：當您以第三方帳號（如 Google）登入時，本平台將取得您的電子郵件地址、顯示名稱及大頭貼影像；
            當您以電子郵件註冊時，將取得您的電子郵件及密碼（密碼經雜湊處理儲存，本平台無從還原為明文）。
          </p>
          <p className="pl-4">
            (b) 內容資料：您上傳之票券圖像及條碼（以 AES-256 加密儲存）、票券標題、品牌、有效期限、說明，
            以及您於申請、交換、評價、檢舉或申訴時所填寫之文字。
          </p>
          <p className="pl-4">
            (c) 選填資料：您於註冊時可自願提供出生年份，僅用於彙總性的年齡分布統計；此為非必填欄位，不提供不影響您使用本服務。
          </p>
          <p>1.2 系統自動蒐集之資料：</p>
          <p className="pl-4">(a) 技術與連線資料：您的 IP 位址、瀏覽器類型、裝置資訊及作業系統。</p>
          <p className="pl-4">(b) 使用紀錄：您於本服務之瀏覽、申請、交易及登入等操作紀錄與時間。</p>
          <p className="pl-4">
            (c) Cookie：本平台使用必要性 Cookie 以維持您的登入狀態；本平台不使用第三方廣告追蹤 Cookie。
          </p>
          <p className="pl-4">
            (d) 行銷歸因資料：當您透過帶有活動參數（UTM）的連結進入本服務時，本平台會記錄該活動來源（如來源、媒介、活動名稱、貼文識別碼）
            及您的到達頁面「路徑」（不含網址中的其他查詢參數），以了解使用者從何管道得知本服務。此資料透過您瀏覽器的 sessionStorage
            及一個名為 <code>cs_utm</code> 的第一方短期 Cookie 暫存，僅用於完成註冊來源歸因，均非第三方廣告追蹤。
          </p>
        </Clause>

        <Clause n="二" title="蒐集目的與利用方式">
          <p>本平台基於下列目的蒐集及利用您的個人資料：</p>
          <p className="pl-4">(a) 提供、維運及改善本服務，包括票券媒合、內容顯示及貢獻值與等級之計算；</p>
          <p className="pl-4">(b) 建立、驗證及管理您的帳戶並提供登入功能；</p>
          <p className="pl-4">(c) 傳送與本服務相關之通知；</p>
          <p className="pl-4">(d) 偵測、預防及處理詐欺、濫用、洗票及其他違規或資安事件；</p>
          <p className="pl-4">(e) 處理檢舉、申訴及使用者間之爭議；</p>
          <p className="pl-4">(f) 履行法令所要求之義務。</p>
        </Clause>

        <Clause n="三" title="個人資料之提供與揭露">
          <p>3.1 本平台不會販售或出租您的個人資料。</p>
          <p>3.2 除下列情形外，本平台不會將您的個人資料揭露予第三人：</p>
          <p className="pl-4">(a) 經您同意；</p>
          <p className="pl-4">(b) 為提供本服務所必要（例如委由雲端服務業者代為儲存及處理）；</p>
          <p className="pl-4">(c) 為配合司法機關或主管機關依法所為之要求；</p>
          <p className="pl-4">(d) 為保護本平台、使用者或公眾之權利、財產或安全所必要。</p>
          <p>
            3.3 部分票券資訊（如票券標題、品牌，及分享者之顯示名稱與信譽資訊）將於本服務中公開顯示，以達媒合之目的；
            票券條碼則以加密方式儲存，僅於兌換之必要範圍內，向您所選定之領取者揭露。
          </p>
        </Clause>

        <Clause n="四" title="第三方服務">
          <p>
            本服務使用 Google 帳號登入服務及 Zeabur 雲端主機服務。您的個人資料於前述服務範圍內之處理，
            另受各該服務提供者之隱私權政策規範。
          </p>
        </Clause>

        <Clause n="五" title="個人資料之保存期間">
          <p>
            本平台於達成蒐集目的所必要之期間內保存您的個人資料，或至您刪除帳戶為止；法令另有規定者，從其規定。
          </p>
        </Clause>

        <Clause n="六" title="您的權利">
          <p>
            依個人資料保護法，您就本平台保有之個人資料，得行使查詢、請求閱覽、請求製給複本、請求補充或更正、
            請求停止蒐集處理利用及請求刪除等權利。如欲行使前述權利，請來信{" "}
            <a
              href="mailto:iamlazybear2023@gmail.com"
              className="font-medium text-accent hover:text-accent-press"
            >
              iamlazybear2023@gmail.com
            </a>
            。
          </p>
        </Clause>

        <Clause n="七" title="資料安全">
          <p>
            本平台採取合理之技術與管理措施保護您的個人資料，包括票券條碼之加密儲存及密碼之雜湊處理。
            惟網際網路之傳輸與儲存無法保證絕對安全，本平台無法就此為絕對之擔保。
          </p>
        </Clause>

        <Clause n="八" title="本政策之修訂">
          <p>
            本平台得隨時修訂本政策，並於本平台公告修訂後之版本；修訂後之政策於公告時生效。
          </p>
        </Clause>

        <Clause n="九" title="聯絡方式">
          <p>
            如對本政策或您的個人資料有任何疑問或請求，請來信：{" "}
            <a
              href="mailto:iamlazybear2023@gmail.com"
              className="font-medium text-accent hover:text-accent-press"
            >
              iamlazybear2023@gmail.com
            </a>
          </p>
          <p className="text-sm text-ink-faint">
            另請一併參閱本平台之{" "}
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
