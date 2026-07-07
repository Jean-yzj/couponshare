"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Eyebrow, Pill } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/display";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";

type Stats = { shared: number; sent: number; members: number };

const WHY: { icon: IconName; title: string; body: string }[] = [
  { icon: "search", title: "場景對了", body: "優惠出現在使用者瀏覽票券、搜尋品牌、管理錢包的時刻——他們正帶著「想領券」的意圖，而不是被廣告打斷。" },
  { icon: "eye", title: "每張券都有數據", body: "每張券的瀏覽、點擊、申請、成功領取次數都看得到。你會知道有多少人真的對優惠有興趣，而不是只有一個觸及數。" },
  { icon: "users", title: "年輕族群精準", body: "以學生與年輕上班族為主的社群，特別適合飲料咖啡甜點、超商零售、課程與 App 註冊等校園與青年市場推廣。" },
];

const CHECKS = [
  ["一張券、多人申請", "你設定名額（100、300、500 次），使用者主動申請領取。"],
  ["四種申請模式", "直接領取、留言申請（看得到申請理由）、品牌審核挑人發放、任務解鎖。"],
  ["每張券的數據都看得到", "瀏覽次數、點擊、申請、成功領取——每一張券、每個曝光位置都拆得出來。"],
  ["不只領取，還有額外曝光", "券被領走的次數以外，還在首頁、搜尋、錢包等版位持續露出，讓更多人看見你的品牌。"],
  ["月報看得懂", "每月一份成效報告：各券申請率、各曝光位成效、申請留言洞察。"],
];

const PLACEMENTS = ["首頁官方福利區", "熱門票券區", "搜尋結果優先", "分類頁推薦", "錢包底部推薦", "票券詳情頁推薦"];

type Plan = {
  name: string;
  who: string;
  summary: string;
  tag?: string;
  hot?: boolean;
  points: string[];
  cta: string;
};
const PLANS: Plan[] = [
  {
    name: "早鳥試用",
    who: "第一次合作、想先小規模驗證成效",
    summary: "低門檻起步，先看數據",
    tag: "名額有限",
    points: ["每月數張官方福利券", "首頁列表、搜尋結果、錢包推薦曝光", "月底提供成效數據"],
    cta: "取得方案與報價",
  },
  {
    name: "標準導流",
    who: "每月固定推廣優惠與活動的品牌",
    summary: "穩定曝光＋申請者洞察",
    hot: true,
    points: ["每月更多福利券與更高申請名額", "加上熱門票券區與詳情頁推薦、搜尋優先", "可看申請者留言與洞察", "每月成效摘要報告"],
    cta: "取得方案與報價",
  },
  {
    name: "精選品牌 / 品牌專案",
    who: "大檔期、新品上市、校園活動、品牌聯名",
    summary: "全站重點曝光＋活動客製",
    points: ["最高申請名額與全站重點曝光", "品牌審核、申請問題、專屬活動頁", "任務解鎖、抽選、問卷等活動機制", "可搭配社群內容曝光", "完整活動成效報告"],
    cta: "聊聊你的活動",
  },
];

const STEPS = [
  ["留下聯絡方式與需求", "填寫下方表單（公司、職稱、聯絡方式與行銷目標），一分鐘完成。"],
  ["收到專屬報價", "依你的目標與產業，把量身的方案與報價寄到你的信箱，也可 LINE 細聊。"],
  ["提供素材上架", "給我們品牌與優惠內容，第一批券由平台協助上架，你不用學後台。"],
  ["看數據調整", "每月成效報告：申請數、領取數、留言洞察，用數據決定下一步。"],
];

function MockCoupon() {
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-2xl border border-line bg-paper p-4 shadow-lift" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine-tint text-xs font-bold text-pine">咖</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">某咖啡品牌 · 咖啡</span>
        </div>
        <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-[11px] font-medium text-accent">官方福利</span>
      </div>
      <p className="mt-2.5 font-semibold text-ink">中杯拿鐵買一送一</p>
      <div className="my-3 border-t border-dashed border-line" />
      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span>剩餘名額 128 / 300</span>
        <span>7 天後截止</span>
      </div>
      <div className="mt-3 rounded-xl bg-accent py-2.5 text-center text-sm font-bold text-white">立即申請</div>
    </div>
  );
}

export function BusinessLanding() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    apiFetch<Stats>("/api/v1/stats/public")
      .then((d) => setS(d))
      .catch(() => {});
  }, []);

  const members = s && s.members > 0 ? s.members.toLocaleString("en-US") : null;
  const fmt = (n?: number) => (n ?? 0).toLocaleString("en-US");

  return (
    <div className="space-y-20 pb-4">
      {/* Hero */}
      <section className="pt-4 text-center md:pt-10">
        <Eyebrow>
          <Icon name="sparkle" size={13} /> Official Coupon Placement
        </Eyebrow>
        <h1 className="mx-auto mt-4 max-w-3xl text-[1.95rem] font-extrabold leading-[1.28] tracking-tight text-ink sm:text-[2.6rem]">
          把品牌優惠，<br />交到主動找券的人手上
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-[16px] leading-relaxed text-ink-soft">
          CouponShare 有 {members ? `${members} 名` : "上萬名"}進來就是為了找優惠的用戶。你的品牌優惠在這裡不是被滑掉的廣告，而是他們主動申請、實際使用的官方福利券——同時帶來導流與品牌曝光。
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button href="#apply" size="lg" icon="send">取得合作報價</Button>
          <Button href="#plans" size="lg" variant="outline">先看方案</Button>
        </div>
        {s && (
          <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-2.5">
            {[
              { label: "平台活躍用戶", value: s.members },
              { label: "已上架好券", value: s.shared },
              { label: "成功送出", value: s.sent },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl border border-line bg-paper px-2 py-3">
                <p className="font-display text-[22px] font-extrabold leading-none text-accent tabular-nums">{fmt(x.value)}</p>
                <p className="mt-1.5 text-xs text-ink-faint">{x.label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Why it works */}
      <section>
        <div className="text-center">
          <Eyebrow>Why it works</Eyebrow>
          <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">不是買曝光，是收「真的想要」的申請</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {WHY.map((w) => (
            <Card key={w.title} className="p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-tint text-accent">
                <Icon name={w.icon} size={18} />
              </span>
              <p className="mt-3 font-semibold text-ink">{w.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{w.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it looks */}
      <section>
        <div className="text-center">
          <Eyebrow>How it looks</Eyebrow>
          <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">長得像一張券，不像一則廣告</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            企業優惠以「官方福利券」卡片呈現，與平台原生票券同一種風格，只多一個合作標籤。沒有彈窗、不擋內容，企業內容比例控制在全站三成以內。
          </p>
        </div>
        <div className="mt-8 grid items-center gap-8 md:grid-cols-2">
          <MockCoupon />
          <ul className="space-y-3">
            {CHECKS.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine-tint text-pine">
                  <Icon name="check" size={12} />
                </span>
                <span className="text-[15px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">{t}</span>——{d}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Placements */}
      <section className="rounded-[28px] bg-accent-tint/40 px-6 py-10 text-center sm:py-12">
        <Eyebrow>Placements</Eyebrow>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">你買到的不只是「被領走的次數」</h2>
        <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-ink-soft">
          除了券被申請、領取的次數，每張券還會在平台的多個原生版位持續露出——等於同時買到「導流」和「額外品牌曝光」。
        </p>
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2.5">
          {PLACEMENTS.map((p) => (
            <span key={p} className="rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink-soft">
              {p}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-lg text-[13px] text-ink-faint">
          為了守住社群體驗，企業內容佔比全站上限 30%——這也是你的券不會被當廣告滑掉的原因。
        </p>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-20">
        <div className="text-center">
          <Eyebrow>Plans</Eyebrow>
          <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">合作方案</h2>
          <p className="mx-auto mt-2 max-w-xl text-balance text-sm leading-relaxed text-ink-soft">
            不論是連鎖品牌還是校園小店都適用。先從早鳥方案小規模驗證，成效好再升級；各方案的名額、曝光與報價，依你的需求量身提供。
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} className={cn("flex flex-col p-6", p.hot && "border-2 border-accent shadow-lift")}>
              <div className="flex items-center gap-2">
                <p className="text-lg font-extrabold text-ink">{p.name}</p>
                {p.hot && (
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-white">最受歡迎</span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">{p.who}</p>
              <p className="mt-3 text-[15px] font-semibold text-accent">{p.summary}</p>
              {p.tag && <Pill className="mt-2 w-fit bg-gold-tint text-gold">{p.tag}</Pill>}
              <ul className="mt-4 flex-1 space-y-2 border-t border-line pt-4">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2 text-sm text-ink-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {pt}
                  </li>
                ))}
              </ul>
              <Button href="#apply" full variant={p.hot ? "primary" : "outline"} className="mt-5">
                {p.cta}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Process */}
      <section>
        <div className="text-center">
          <Eyebrow>Process</Eyebrow>
          <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">合作流程，四步開始</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <Card key={t} className="p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-display text-sm font-extrabold text-white">
                {i + 1}
              </span>
              <p className="mt-3 font-semibold text-ink">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Lead form */}
      <section id="apply" className="scroll-mt-20 border-t border-line pt-14">
        <BusinessLeadForm
          title="留下聯絡方式，我把報價寄給你"
          subtitle="填寫後我會盡快將完整的合作方案與報價寄到你的信箱，也可能透過 LINE 與你聯繫。"
        />
      </section>
    </div>
  );
}
