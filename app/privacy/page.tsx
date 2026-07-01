import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = {
  title: "隱私條款 — CouponShare",
  description: "CouponShare 隱私條款：我們蒐集哪些資訊、用途，以及如何保護你的資料。",
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

function Item({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-paper p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-accent">
        <Icon name={icon} size={16} />
      </span>
      <div>
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} /> 回到首頁
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight text-ink">隱私條款</h1>
      <p className="mt-2 text-sm text-ink-faint">最後更新：2026 年 7 月</p>

      <div className="mt-5 rounded-2xl bg-accent-tint/60 p-4 text-[15px] leading-relaxed text-ink">
        CouponShare 是個人架設的小專案。我們只蒐集「提供服務所必要」的資訊，並盡力保護你的資料。
        這份說明會告訴你：我們蒐集什麼、用來做什麼、以及我們不會做什麼。
      </div>

      <Section n="1" title="我們蒐集哪些資訊">
        <p className="font-semibold text-ink">你主動提供的：</p>
        <div className="space-y-2">
          <Item icon="login" label="登入資訊">
            使用 Google 登入時，我們會取得你的{" "}
            <span className="font-medium text-ink">電子郵件、顯示名稱與頭像</span>；
            若以 Email 註冊，則是你的 Email 與密碼（密碼經雜湊處理，我們無法還原成明碼）。
          </Item>
          <Item icon="ticket" label="你上傳的票券">
            你分享的<span className="font-medium text-ink">票券圖片／條碼</span>（以 AES-256 加密儲存）、
            標題、品牌、有效期限與說明。
          </Item>
          <Item icon="send" label="你填寫的內容">
            申請留言、交換提案、評價、檢舉與申訴等你主動輸入的文字。
          </Item>
        </div>
        <p className="mt-3 font-semibold text-ink">系統自動蒐集的：</p>
        <div className="space-y-2">
          <Item icon="shield" label="IP 與裝置資訊">
            你的 IP 位址、瀏覽器與裝置類型，用於<span className="font-medium text-ink">防止濫用、洗票與資安防護</span>。
          </Item>
          <Item icon="clock" label="使用紀錄">
            你的瀏覽、申請、交易與登入時間等操作紀錄。
          </Item>
          <Item icon="lock" label="Cookie">
            僅用於維持你的<span className="font-medium text-ink">登入狀態</span>，沒有第三方廣告追蹤 Cookie。
          </Item>
        </div>
      </Section>

      <Section n="2" title="我們如何使用這些資訊">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>提供並維運服務：媒合票券、顯示你的分享、計算貢獻值與等級。</li>
          <li>建立與識別你的帳號、讓你登入。</li>
          <li>發送與服務相關的通知（例如有人申請你的票券、你被選中領取）。</li>
          <li>防止詐騙、濫用與洗票，維護社群安全。</li>
          <li>處理檢舉、申訴與使用者之間的爭議。</li>
        </ul>
      </Section>

      <Section n="3" title="我們不會做的事">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold text-ink">不販售、不出租</span>你的個人資料給任何第三方。
          </li>
          <li>除非法律要求，或為保護平台與使用者安全所必要，不會任意將你的資料提供給他人。</li>
          <li>票券條碼以加密方式儲存，只有你選定的領取者在兌換當下才看得到。</li>
        </ul>
      </Section>

      <Section n="4" title="第三方服務">
        <p>
          本平台使用 <span className="font-medium text-ink">Google 登入</span>（受 Google 隱私權政策規範）
          與雲端主機服務 <span className="font-medium text-ink">Zeabur</span> 來運作，你的資料會儲存在該雲端主機上。
        </p>
      </Section>

      <Section n="5" title="資料保存與你的權利">
        <p>
          你的資料會保存到你刪除帳號或我們停止營運為止。你可以隨時來信要求
          <span className="font-semibold text-ink">查詢或刪除</span>你的帳號與相關資料。
        </p>
      </Section>

      <div className="mt-8 rounded-2xl border border-line bg-paper p-5 text-[15px] text-ink-soft shadow-soft">
        <p className="font-semibold text-ink">聯絡我們</p>
        <p className="mt-1">
          有任何隱私相關的問題或要求，請來信：{" "}
          <a
            href="mailto:iamlazybear2023@gmail.com"
            className="font-semibold text-accent hover:text-accent-press"
          >
            iamlazybear2023@gmail.com
          </a>
        </p>
        <p className="mt-3 text-sm text-ink-faint">
          另請參閱我們的{" "}
          <Link href="/terms" className="font-medium text-accent hover:text-accent-press">
            使用條款
          </Link>
          。
        </p>
      </div>
    </div>
  );
}
