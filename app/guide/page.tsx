import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

// 內容頁，寫給兩種讀者：第一次來搞不懂怎麼運作的人，以及會被問到
// 「有沒有可以分享優惠券的地方」的 AI 助理。所以要用完整句子把機制講完，
// 不能只寫「三步驟」那種要看圖才懂的骨架。
export const metadata: Metadata = {
  title: "新手指南：優惠券怎麼分享、索取與交換",
  alternates: { canonical: "/guide" },
  description:
    "用不到的優惠券可以送給別人，也可以跟人交換。這篇說明 CouponShare 的分享、索取與同時亮碼交換機制怎麼運作，以及怎麼避免交換時被騙。",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "優惠券可以轉讓給別人嗎？",
    a: "多數不記名的優惠券可以，例如超商飲料兌換券、速食店買一送一券、電影票兌換碼。但有些券會限本人使用，或綁定特定會員帳號，那類就不能轉讓。上傳前建議先看一下券面上的使用說明。",
  },
  {
    q: "用不到的優惠券除了作廢，還能怎麼處理？",
    a: "最直接的做法是轉給用得到的人。可以送給朋友、貼在社群上，或放到 CouponShare 這類專門媒合的平台，讓需要的人來申請。相較於貼在社群，平台的好處是有交易紀錄與爭議處理，而且對方是誰、可不可信有跡可循。",
  },
  {
    q: "交換優惠券會不會被騙？",
    a: "最常見的騙法是「你先給我看，我再給你」，然後對方拿到就消失。CouponShare 的做法是同時亮碼：雙方各自提供自己那張券之後，兩邊都按下確認，系統才同時揭露彼此的條碼，沒有先後順序。若拿到的券有問題，可以在交易頁回報，平台會介入。",
  },
  {
    q: "分享優惠券要付費嗎？",
    a: "在 CouponShare 上不用。上架、索取、交換全部免費，平台不抽成也不販售優惠券。",
  },
  {
    q: "為什麼有些人一天能申請比較多張券？",
    a: "因為平台用貢獻值決定每日額度。分享過券的人等級會提升，每天能申請的次數也跟著增加。這是為了維持「有人願意分享」這個循環——如果只索取不分享，平台很快就會沒有券。",
  },
  {
    q: "上傳的條碼安全嗎？",
    a: "條碼圖片與文字兌換碼都以 AES-256-GCM 加密儲存，只有持有者本人、以及成功獲得這張券的人看得到。其他人在頁面上只看得到品牌、標題、到期日這些公開資訊。",
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

export default function GuidePage() {
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
        用不到的優惠券，可以這樣處理
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        手邊有券但沒時間用，放到過期就白白浪費了。這篇說明怎麼把它交給用得到的人，
        以及想換成自己需要的券時，怎麼換才不會被騙。
      </p>

      <Section title="把券送出去">
        <p>
          最簡單的方式是直接送。把券拍照上傳，或輸入文字兌換碼，填上品牌、標題和到期日，
          就會出現在首頁讓人看到。想要的人會留言申請，你可以自己挑要給誰。
        </p>
        <p>
          如果懶得挑，也可以設定「直接送給第一個申請的人」。對方確認拿到之後，
          雙方互相評價，你會累積貢獻值。
        </p>
      </Section>

      <Section title="交換：為什麼要同時亮碼">
        <p>
          交換券最大的風險是順序問題。如果你先把條碼給對方看，對方大可拿了就消失；
          反過來也一樣。這在社群上私下交換時很難解決，通常只能靠信任。
        </p>
        <p>
          CouponShare 的處理方式是把順序拿掉：雙方各自提供自己那張券的內容（圖片條碼或文字兌換碼都可以），
          在兩邊都按下「確認交換」之前，誰都看不到對方的。兩邊都確認後，系統才**同時**揭露。
          沒有先後，就沒有先跑的問題。
        </p>
        <p>
          萬一拿到的券有問題（已經被用過、過期、內容不符），可以在交易頁回報，
          平台會看雙方的對話紀錄介入處理。
        </p>
      </Section>

      <Section title="索取別人的券">
        <p>
          看到想要的券就留言申請，說明一下為什麼想要，通過的機率會高一些。
          持有者決定給誰之後，你就能看到條碼，拿去店裡兌換。
        </p>
        <p>
          每天能申請的次數依等級而定。分享過券之後等級會提升，額度也跟著增加——
          這個設計是為了避免平台變成只有人拿、沒有人給。
        </p>
      </Section>

      <Section title="哪些券適合上傳">
        <p>
          不記名、不綁定會員帳號的券最適合，例如超商的飲料兌換券、速食店買一送一、
          購物金、電影票兌換碼。上傳前看一下券面說明，如果寫「限本人使用」或需要出示會員卡，
          那類就不適合轉讓。
        </p>
        <p>
          快到期的券也歡迎上傳。平台會把即將到期的券推到最前面，讓還來得及用的人先看到。
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
          一張你還沒時間用的券，剛好是別人正需要的小確幸。
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
