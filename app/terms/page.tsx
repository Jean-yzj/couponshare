import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "使用條款 — CouponShare",
  description: "CouponShare 使用條款：本平台非品牌官方合作平台，票券由使用者自行上傳。",
};

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-xs font-bold text-accent">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-2 space-y-2 pl-8 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} /> 回到首頁
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight text-ink">使用條款</h1>
      <p className="mt-2 text-sm text-ink-faint">最後更新：2026 年 7 月</p>

      <div className="mt-5 rounded-2xl bg-accent-tint/60 p-4 text-[15px] leading-relaxed text-ink">
        歡迎使用 CouponShare。這是一個由個人架設、非營利的興趣專案，讓大家把自己用不到的優惠券、票券
        分享、贈送或交換出去。使用本平台前，請先閱讀並同意以下條款。
      </div>

      <Section n="1" title="關於本平台">
        <p>
          CouponShare <span className="font-semibold text-ink">並非任何品牌或商家的官方、授權或合作平台</span>，
          與票券上所示之任何品牌均無合作、授權或背書關係。所有品牌名稱、標誌僅為識別票券內容之用。
        </p>
      </Section>

      <Section n="2" title="票券由使用者自行上傳">
        <p>
          平台上所有票券的資訊、圖片與條碼，皆由使用者
          <span className="font-semibold text-ink">自行上傳</span>，其真實性、有效性與可用性由上傳者本人負責。
        </p>
        <p>
          你在上傳前必須確認自己
          <span className="font-semibold text-ink">對該內容擁有合法的使用與分享權利</span>，
          不得上傳未經授權、他人記名專屬、或依規定禁止轉讓的票券。
        </p>
      </Section>

      <Section n="3" title="平台不負責、不擔保">
        <p>
          本平台僅提供使用者之間媒合的空間，
          <span className="font-semibold text-ink">對使用者上傳的任何內容不做審查、不負責任、也不提供任何擔保</span>。
        </p>
        <p>
          票券有可能已過期、已被使用、無效或與描述不符。
          <span className="font-semibold text-ink">兌換前請自行評估對方與票券的可信度</span>，
          相關風險由你自行承擔。
        </p>
      </Section>

      <Section n="4" title="交易與爭議自行解決">
        <p>
          使用者之間的贈送、交換與兌換，屬雙方自行往來的行為。
          <span className="font-semibold text-ink">任何糾紛、損失或爭議，請由雙方自行協商解決</span>，
          本平台不介入、不承擔任何賠償或連帶責任。
        </p>
      </Section>

      <Section n="5" title="內容下架與帳號處置">
        <p>
          若內容涉及侵權、詐騙、違法或其他不當使用，本平台有權
          <span className="font-semibold text-ink">隨時將該內容下架，並暫停或終止相關帳號</span>，
          必要時無須事先通知。
        </p>
      </Section>

      <Section n="6" title="檢舉與聯絡">
        <p>
          若你發現有侵權或不當內容，或認為有內容侵害你的權利，歡迎透過平台的檢舉功能，
          或來信告知，我們會盡快處理。
        </p>
      </Section>

      <Section n="7" title="條款變更">
        <p>
          本條款可能隨時更新，並以平台上公告的最新版本為準。你在更新後繼續使用本平台，
          即視為同意更新後的條款。
        </p>
      </Section>

      <div className="mt-8 rounded-2xl border border-line bg-paper p-5 text-[15px] text-ink-soft shadow-soft">
        <p className="font-semibold text-ink">聯絡我們</p>
        <p className="mt-1">
          有任何問題、檢舉或建議，請來信：{" "}
          <a
            href="mailto:iamlazybear2023@gmail.com"
            className="font-semibold text-accent hover:text-accent-press"
          >
            iamlazybear2023@gmail.com
          </a>
        </p>
        <p className="mt-3 text-sm text-ink-faint">
          另請參閱我們的{" "}
          <Link href="/privacy" className="font-medium text-accent hover:text-accent-press">
            隱私條款
          </Link>
          。
        </p>
      </div>
    </div>
  );
}
