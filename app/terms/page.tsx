import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "使用條款 — CouponShare",
  description:
    "CouponShare 使用條款。本平台為使用者間之票券媒合服務，票券由使用者自行上傳，並歡迎品牌洽談合作。",
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

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl pb-12">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} /> 回到首頁
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight text-ink">使用條款</h1>
      <p className="mt-1.5 text-sm text-ink-faint">生效日期：2026 年 7 月 1 日</p>

      <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
        本使用條款（下稱「本條款」）係您（下稱「使用者」）與 CouponShare（下稱「本平台」）就使用本平台所提供之服務
        （下稱「本服務」）所訂立之協議。當您註冊、存取或使用本服務時，即表示您已詳細閱讀、瞭解並同意接受本條款之全部內容。
        若您不同意本條款之任何部分，請立即停止使用本服務。
      </p>

      <div className="mt-7 space-y-6">
        <Clause n="一" title="服務性質">
          <p>
            1.1 本平台為提供使用者間分享、贈與及交換閒置優惠券、票券等權益憑證（下稱「票券」）之網路媒合平台。
            本平台僅提供資訊揭露與媒合之技術服務，並非任何票券交易之當事人、居間人或保證人。
          </p>
          <p>
            1.2 本平台與票券上所顯示之任何品牌、商家或發行機構均無隸屬、代理、授權或合作關係，亦未經其審核或背書。
            票券上所載之品牌名稱及商標，其權利均歸各該權利人所有，於本平台僅供識別票券內容之用。
          </p>
          <p>
            1.3 本平台歡迎各品牌、商家洽談正式合作。如有合作意願，敬請來信{" "}
            <a
              href="mailto:iamlazybear2023@gmail.com"
              className="font-medium text-accent hover:text-accent-press"
            >
              iamlazybear2023@gmail.com
            </a>{" "}
            與本平台聯繫。
          </p>
        </Clause>

        <Clause n="二" title="使用者內容與保證">
          <p>
            2.1 本服務所刊登之一切票券資訊、圖像、條碼及相關文字（下稱「使用者內容」），均由使用者自行提供並上傳，
            本平台不主動審查其內容。
          </p>
          <p>2.2 使用者就其上傳之使用者內容，向本平台聲明並保證：</p>
          <p className="pl-4">(a) 其對該內容擁有完整、合法之權利，或已取得權利人之合法授權，得予以分享、贈與或交換；</p>
          <p className="pl-4">(b) 該內容未侵害任何第三人之智慧財產權、財產權或其他權利；</p>
          <p className="pl-4">
            (c) 該內容未違反任何法令，且非屬記名、專屬或依其發行條款禁止移轉之票券。
          </p>
          <p>
            2.3 使用者應就其上傳之使用者內容自負全部法律責任。因使用者內容所生之任何爭議、損害或第三人求償，
            概由該使用者自行負責，與本平台無涉。
          </p>
        </Clause>

        <Clause n="三" title="免責聲明與擔保之排除">
          <p>
            3.1 本服務係以「現狀」（AS IS）及「現有」（AS AVAILABLE）之基礎提供。於法令允許之最大範圍內，
            本平台不就使用者內容之真實性、正確性、有效性、可用性、合法性或品質作任何明示或默示之擔保。
          </p>
          <p>
            3.2 使用者知悉並同意，票券可能存在已逾使用期限、業經使用、無效、遭偽造或與說明不符等情形。
            使用者於兌換或交易前，應自行審慎評估交易對象及票券之可信度，並自行承擔一切風險。
          </p>
          <p>
            3.3 於法令允許之最大範圍內，本平台就使用者使用或無法使用本服務所生之任何直接、間接、附帶或衍生之損害，
            均不負賠償責任。
          </p>
        </Clause>

        <Clause n="四" title="使用者間之交易與爭議">
          <p>
            4.1 使用者間之贈與、交換及兌換行為，均屬使用者相互間之獨立法律關係，本平台非該等交易之當事人、
            居間人或保證人。
          </p>
          <p>
            4.2 使用者間因交易所生之任何爭議、糾紛或損失，應由當事人自行協商解決。本平台無介入、調解或賠償之義務，
            惟得依本條款採取必要之管理措施。
          </p>
        </Clause>

        <Clause n="五" title="內容移除與帳號管理">
          <p>
            5.1 使用者內容如經本平台認定有涉及侵權、詐欺、違法或其他不當使用之虞者，本平台有權不經事先通知，
            逕行移除該內容，並得暫停或終止相關使用者之帳號及服務。
          </p>
          <p>
            5.2 權利人如認為本平台上之內容侵害其權利，得檢具相關事證來信通知，本平台將於合理期間內處理。
          </p>
        </Clause>

        <Clause n="六" title="智慧財產權">
          <p>
            6.1 本平台之網站介面、程式、設計、標誌及其他內容之智慧財產權，除使用者內容外，均屬本平台或其授權人所有，
            非經事前書面同意，不得擅自重製、散布或為其他利用。
          </p>
        </Clause>

        <Clause n="七" title="條款之修訂">
          <p>
            7.1 本平台得隨時修訂本條款，並於本平台公告修訂後之版本。修訂後之條款於公告時生效。
            使用者於條款修訂後繼續使用本服務者，視為已同意修訂後之條款。
          </p>
        </Clause>

        <Clause n="八" title="準據法與管轄">
          <p>
            8.1 本條款之解釋與適用，以及與本條款有關之一切爭議，均以中華民國法律為準據法，
            並以臺灣臺北地方法院為第一審管轄法院。
          </p>
        </Clause>

        <Clause n="九" title="聯絡方式">
          <p>
            如對本條款有任何疑問，或需檢舉不當內容、洽談品牌合作，請來信：{" "}
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
            </Link>
            。
          </p>
        </Clause>
      </div>
    </div>
  );
}
