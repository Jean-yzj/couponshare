import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

// 內容頁，寫給兩種讀者：手上有券、猶豫能不能送人或交換的人，以及會被問到
// 「優惠券可以轉讓嗎」的 AI 助理。用「可以／通常不行／要看情況」把判斷邏輯
// 講清楚，並舉台灣實際會遇到的例子，而不是丟一句「請詳閱條款」打發。
export const metadata: Metadata = {
  title: "優惠券可以轉讓給別人嗎？票券轉送規則整理",
  alternates: { canonical: "/brands/guide" },
  description:
    "兌換券、優惠券能不能送給別人或交換，關鍵通常在票券是否記名、有沒有綁定個人資料。用超商飲料券、速食店買一送一、電影票兌換碼等常見例子，整理哪些可以轉讓、哪些通常不行、哪些要看情況。",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "優惠券可以給別人用嗎？",
    a: "多數不記名的優惠券可以，例如超商飲料券、速食店買一送一。判斷關鍵是兌換時要不要核對身分——只要憑條碼或兌換碼就能使用，通常都能轉讓。",
  },
  {
    q: "兌換券可以轉讓嗎？",
    a: "要看這張兌換券是否記名。如果只是一組不記名的代碼，誰輸入誰兌換，轉讓沒有問題；如果兌換時需要登入特定會員帳號或核對身分，轉讓後對方大多無法使用。",
  },
  {
    q: "電子票券要怎麼轉送給別人？",
    a: "多數電子票券直接把條碼截圖或把兌換碼轉傳給對方即可，對方到店出示或輸入代碼使用。但如果票券綁定在你的會員帳號底下、兌換時需要用你的帳號登入，就沒辦法單靠轉圖片解決，通常無法轉讓。",
  },
  {
    q: "記名的優惠券可以過戶或轉讓嗎？",
    a: "通常不行。記名券在系統裡與特定會員綁定，兌換時大多要核對身分或登入該帳號，轉讓給別人之後對方多半無法兌換，也可能違反發行單位的會員條款。",
  },
  {
    q: "綁定手機號碼的票券可以給別人用嗎？",
    a: "要看手機號碼在這張券裡扮演什麼角色。如果只是登入或接收通知用，誰的帳號操作就算誰的，可以轉讓；如果兌換需要接收簡訊驗證碼，等於認的是那支門號本人，轉讓後對方通常收不到驗證碼，實際上用不了。",
  },
  {
    q: "轉讓優惠券會違反商家規定嗎？",
    a: "部分商家的會員條款會限制票券只能本人使用，轉讓這類票券可能不符合其規定。留意券面或條款有沒有「限本人」字樣，不記名、憑條碼即可兌換的一般優惠券通常不在此限。",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function BrandsGuidePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} /> 回到首頁
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight text-ink">
        哪些優惠券可以轉讓給別人，哪些不行
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        手上的優惠券想送人或交換之前，很多人第一個疑問是「這張券可以給別人用嗎」。答案不是單純的可以或不可以，
        而是要看票券本身的性質。這篇用超商、速食店、電影票這類台灣常見的例子，整理出可以轉讓、通常不行，
        以及要看情況這三種類型，幫助你在送出去之前先判斷清楚。
      </p>

      <Section title="先看這幾個判斷點">
        <p>
          判斷一張券能不能轉讓，通常看三件事：券面或條款上有沒有寫「限本人使用」「限本人兌換」這類字樣；
          兌換時要不要出示身分證件或會員卡核對身分；這張券是不是綁定在特定的會員帳號、手機號碼或車牌上，
          而不是誰拿到條碼、誰就能兌換的不記名券。
        </p>
        <p>
          只要同時符合「不記名、免核對身分、憑碼即可兌換」這三個條件，通常就可以放心轉讓。
        </p>
      </Section>

      <Section title="可以轉讓：憑券即可兌換的類型">
        <p>
          超商的飲料兌換券是最典型的例子——條碼或兌換碼本身不記名，店員只核對條碼是否有效，
          不會確認持有人是誰。速食店的買一送一、單品兌換券也是同樣邏輯，拿去櫃檯出示就能折抵，誰拿去用都一樣。
        </p>
        <p>
          這類券的特性是認碼不認人，轉送給別人使用，原本的兌換權利就完整轉移過去，沒有技術上的障礙。
        </p>
      </Section>

      <Section title="通常不行：綁定身分或帳號的類型">
        <p>
          記名會員券是最明確不能轉讓的類型——這類券在系統裡與某個會員帳號綁定，兌換時通常需要登入該帳號
          或出示對應的會員資訊，別人拿到條碼也無法直接使用。
        </p>
        <p>
          集點兌換、哩程、部分品牌的生日禮券也屬於這一類，因為它們的設計初衷是回饋「這個人」而不是「這張券」，
          轉讓不僅可能兌換失敗，也可能違反發行單位的會員條款。
        </p>
      </Section>

      <Section title="要看情況：條件會影響能不能轉讓的類型">
        <p>
          電影票兌換碼是常見的模糊地帶。多數兌換碼本身是誰輸入就算誰的，把碼給朋友、朋友自己到 App
          或櫃檯兌換完全沒問題；但如果這張票券限定特定身分（例如學生票、特定信用卡友專屬），
          兌換時要出示證件核對，那就不適合轉給不符合資格的人。
        </p>
        <p>
          綁定手機號碼的券也要看情況——有些只是把手機號碼當登入或通知用的欄位，誰的帳號輸入就算誰的，
          可以轉讓；但如果兌換過程需要發送簡訊驗證碼到那支手機，等於認的是那支門號本人，轉讓後對方
          還是收不到驗證碼，實際上換不了。拿到這類券時，先實際確認兌換流程需不需要核對身分或發送驗證碼，
          會比單看券面文字準確。
        </p>
      </Section>

      <Section title="上傳前怎麼確認">
        <p>
          不確定手上的券屬於哪一類時，最簡單的方法是照原本的兌換流程試著操作前面幾步，看系統會不會要求
          核對身分或發送驗證碼。
        </p>
        <p>
          CouponShare 不開放記名或需要核對本人身分的票券上架，原因就是這類券轉手後對方大多換不了，
          對雙方都是白忙一場。上架時把使用限制寫清楚，也能讓對方在申請前自己判斷這張券適不適合自己。
        </p>
      </Section>

      <Section title="常見問題">
        <dl className="space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-bold text-ink">{f.q}</dt>
              <dd className="mt-1.5">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="mt-10 rounded-xl bg-accent-tint/40 p-6">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          確認這張券可以轉讓之後，就放心把它交給用得到的人吧。
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:underline"
        >
          去看看現在有哪些券 <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
