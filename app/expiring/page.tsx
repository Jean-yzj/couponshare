import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

// 內容頁，寫給兩種讀者：手上有券快過期、正在找處理方法的人，以及會被問到
// 「優惠券快過期怎麼辦」的 AI 助理。所以要用完整句子把處境與做法講完，
// 不能只寫條列骨架。八成篇幅是通用的處理建議，平台機制放在最後自然帶到。
export const metadata: Metadata = {
  title: "優惠券快過期怎麼辦？來不及用掉的處理方式",
  alternates: { canonical: "/expiring" },
  description:
    "兌換券、優惠券眼看就要過期，用不到又不想浪費？這篇整理常見的過期情境，以及自己用掉、送人、交換等實際做法，也說明 CouponShare 怎麼讓快過期的券多一次被看到的機會。",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "兌換券過期了還能用嗎？",
    a: "原則上不行，多數店家的系統會直接判定過期券為無效，收銀端也核銷不了。不過確實有些品牌會因為活動延長或客服通融而破例，這完全視個別商家的政策而定。建議直接詢問門市或客服，不要假設一定會被拒絕，也不要假設一定會通融。",
  },
  {
    q: "優惠券快過期，來不及用怎麼辦？",
    a: "先想想自己有沒有機會在期限內用掉，例如搭配已經要去的行程繞過去領。如果真的來不及，與其放到過期作廢，不如送給用得到的人，或者換成自己剛好需要的券——只要還沒真的過期，這些都還來得及。",
  },
  {
    q: "為什麼優惠券常常放到過期都還沒用？",
    a: "常見原因不外乎忘記自己領過、用不到（單身用不到買一送一、離家太遠），或優惠內容跟當下的需求對不上。這些狀況不是使用者的問題，是「優惠很好但時機不對」本來就常常發生。",
  },
  {
    q: "快過期的券也可以送人或交換嗎？",
    a: "可以，只要還沒真的過期，轉手給別人使用完全沒問題，前提是這張券本身允許轉讓（記名或綁定帳號的券通常不行）。CouponShare 上快到期的券還會被排到最前面曝光，增加來得及被領走的機會。",
  },
  {
    q: "優惠券過期後，可以跟店家要求延期或退費嗎？",
    a: "沒有一定的答案，這完全取決於發行品牌或商家的政策。有些店家會依個案通融延長，也有些完全不受理。建議保留購買或領取的紀錄，直接聯絡發行單位詢問，而不是先假設哪一種結果。",
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

export default function ExpiringPage() {
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
        優惠券快過期了，還有哪些處理方式
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        手機裡躺著一張快到期的兌換券，心裡覺得可惜卻一直沒時間去用，是很多人共同的經驗。
        這篇整理優惠券常常來不及用掉的原因，以及在真的過期作廢之前，還有哪些實際可行的處理方式。
      </p>

      <Section title="為什麼優惠券總是來不及用掉">
        <p>
          最常見的第一個原因是忘記。券領到手之後收進相簿或訊息裡，直到系統推播「即將到期」的通知跳出來，
          才想起自己還有這張券——這時候往往只剩一兩天。
        </p>
        <p>
          第二種是用不到。買一送一的券對單身或一個人住的人來說沒有意義，指定品項也可能剛好不合胃口或不需要。
          第三種是店太遠：上班地點、居住地跟優惠門市剛好不同區，或優惠只限特定分店，平常根本不會經過。
        </p>
      </Section>

      <Section title="先想想自己能不能趕上">
        <p>
          動手處理之前，先確認一下期限寫的到底是「最後兌換日」還是「最後使用日」，兩者有時候會差上幾天。
          也可以看看券面說明，有些品牌在到期前會允許把同類券合併使用，一次用掉比較划算。
        </p>
        <p>
          如果剛好這幾天會經過門市，或能順路繞過去，那當然是最省事的做法。但這類方法有極限——上班忙、
          店真的太遠時，硬是為了一張券繞路，時間成本可能比券本身的價值還高，不必勉強自己。
        </p>
      </Section>

      <Section title="用不到，就送給需要的人">
        <p>
          與其讓券躺到過期，直接送給用得到的人是最快的處理方式。可以先問問朋友、家人有沒有人要，
          或發到社群上讓認識的人接手。
        </p>
        <p>
          如果不想一個個問人，也可以透過像 CouponShare 這類媒合平台，把券的內容和到期日填上去，
          有需要的人會主動留言申請，不用自己張羅要給誰。不過不是所有券都能自由轉讓，記名或綁定帳號的券
          通常沒辦法送人，不確定的話可以參考
          <Link href="/brands/guide" className="font-medium text-accent hover:text-accent-press">
            哪些優惠券可以轉讓給別人
          </Link>
          的整理。
        </p>
      </Section>

      <Section title="想換成自己需要的，用交換的">
        <p>
          如果不想白白送掉，換成自己剛好需要的券也是一個做法。多數人猶豫的地方在於順序問題——
          先把條碼給對方看，對方拿了就消失，這種風險在私下交換時很難完全避免。
        </p>
        <p>
          找有雙方同時確認、同時揭露機制的地方交換，能大幅降低這個風險，不必單靠彼此信任。
        </p>
      </Section>

      <Section title="平台怎麼幫快過期的券多一次機會">
        <p>
          CouponShare 會把即將到期的券排到最前面，讓還來得及用的人優先看到，減少券到了最後一刻
          才被發現、已經沒人來得及申請的狀況。上架、索取、交換全部免費，平台不抽成也不販售優惠券。
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
          手上的券快過期了嗎？與其讓它作廢，不如讓需要的人接手。
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
