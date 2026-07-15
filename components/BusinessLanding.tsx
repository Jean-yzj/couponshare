"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Eyebrow, Pill } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/display";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";

type Stats = { shared: number; sent: number; members: number };

const WHY: { icon: IconName; title: string; body: string }[] = [
  { icon: "search", title: "打在有意圖的時刻", body: "優惠出現在使用者瀏覽票券、搜尋品牌、管理錢包的時刻——他們正帶著「想領券」的意圖，而不是被廣告打斷。" },
  { icon: "eye", title: "每一步都可追蹤", body: "每張券的瀏覽、點擊、申請、成功領取都算得出來。你買到的不是一個觸及數，是一份可驗證的成效報表。" },
  { icon: "users", title: "年輕族群精準", body: "以學生與年輕上班族為主的社群，特別適合飲料咖啡甜點、超商零售、課程與 App 註冊等校園與青年市場。" },
];

const FITS: { tag: string; use: string; icon: IconName }[] = [
  { tag: "咖啡・手搖飲・甜點", use: "新品試飲、買一送一、到店導流", icon: "gift" },
  { tag: "課程・App・服務", use: "註冊試用、問卷名單、會員招募", icon: "sparkle" },
  { tag: "校園品牌・活動", use: "學生族群導流、活動報名", icon: "users" },
  { tag: "電商・零售", use: "折扣碼測試、新品曝光", icon: "ticket" },
];

const PLACEMENTS = ["首頁官方福利區", "品牌專頁", "票券詳情頁"];
const PLACEMENTS_UPCOMING = ["熱門票券區", "搜尋結果優先", "分類頁推薦", "錢包底部推薦"];

type Plan = { name: string; who: string; tag?: string; hot?: boolean; points: string[]; cta: string };
const PLANS: Plan[] = [
  {
    name: "早鳥試用",
    tag: "限前 10 家合作品牌",
    who: "第一次合作、想先小規模驗證成效",
    points: ["每月 5 張官方福利券", "每張最多 100 次申請（月上限 500）", "首頁官方福利區曝光", "月底提供成效數據"],
    cta: "選這個方案",
  },
  {
    name: "標準導流",
    hot: true,
    who: "每月固定推廣優惠與活動的品牌",
    points: ["每月 10 張官方福利券", "每張最多 200 次申請（月上限 2,000）", "首頁官方福利區＋品牌專頁曝光", "新曝光版位上線後自動納入", "可看申請者留言與洞察", "每月成效摘要報告"],
    cta: "選這個方案",
  },
  {
    name: "品牌專案",
    who: "大檔期、新品上市、校園活動、品牌聯名",
    points: ["專屬活動頁與全站重點曝光", "任務解鎖、抽選、問卷等機制", "可搭配社群內容曝光", "完整活動成效報告"],
    cta: "聊聊你的活動",
  },
];

const STEPS = [
  ["留 Email 與需求", "填下方表單（品牌、目標、聯絡方式），一分鐘完成。"],
  ["收到方案與範例報表", "依你的目標與產業，把方案、報價與範例報表寄到你的信箱。"],
  ["開通後台自助上架", "簽約後開通企業後台：品牌資料、券內容、圖片自己上，隨時上下架、即時生效，不必來回寄素材。"],
  ["看數據調整", "每月成效報告：申請數、領取數、留言洞察，用數據決定下一步。"],
];

function Bars() {
  return (
    <div className="flex h-8 items-end gap-1">
      {[5, 8, 6, 9, 7, 11, 9].map((h, i) => (
        <span key={i} className="w-2 rounded-sm bg-accent/70" style={{ height: `${h * 2 + 6}px` }} />
      ))}
    </div>
  );
}

// A small, clearly-labelled sample dashboard so brands see this is a trackable
// product, not a banner slot. Numbers are illustrative (示意).
function ReportPreview() {
  const rows: [string, string][] = [
    ["曝光", "3,200"],
    ["點擊", "540"],
    ["申請", "480"],
    ["成功領取", "390"],
  ];
  return (
    <div className="w-full rounded-2xl border border-line bg-paper p-4 shadow-lift" aria-hidden>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">本月成效報表</p>
        <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-ink-faint">示意</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-canvas px-3 py-2">
            <p className="font-display text-lg font-extrabold tabular-nums text-ink">{v}</p>
            <p className="text-[11px] text-ink-faint">{k}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <div>
          <p className="text-[11px] text-ink-faint">申請率</p>
          <p className="font-display text-lg font-extrabold text-accent">15.0%</p>
        </div>
        <Bars />
      </div>
    </div>
  );
}

function MockCoupon() {
  return (
    <div className="w-full rounded-2xl border border-line bg-paper p-4 shadow-lift" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pine-tint text-xs font-bold text-pine">咖</span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-faint">某咖啡品牌 · 咖啡</span>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-white">官方福利</span>
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
  const [plan, setPlan] = useState<string | null>(null);

  function pickPlan(name: string) {
    setPlan(name);
    document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" });
  }
  useEffect(() => {
    apiFetch<Stats>("/api/v1/stats/public")
      .then((d) => setS(d))
      .catch(() => {});
  }, []);

  const members = s && s.members > 0 ? s.members.toLocaleString("en-US") : null;
  const fmt = (n?: number) => (n ?? 0).toLocaleString("en-US");

  return (
    <div className="space-y-16 overflow-x-hidden pb-4 sm:space-y-20">
      {/* Hero */}
      <section className="pt-4 text-center md:pt-10">
        <Eyebrow>
          <Icon name="sparkle" size={13} /> 官方福利券投放
        </Eyebrow>
        <h1 className="mx-auto mt-4 max-w-3xl text-[1.9rem] font-extrabold leading-[1.28] tracking-tight text-ink sm:text-[2.6rem]">
          讓你的優惠，<br />被真正想領券的人看到
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-ink-soft sm:text-base">
          CouponShare 有 {members ? `${members} 名` : "上萬名"}用戶，進站就是為了瀏覽、申請、收藏優惠券。品牌用「官方福利券」投放優惠，就能拿到申請數、領取數與使用者留言洞察——不只是版位曝光，是一個可追蹤的投放產品。
        </p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <Button href="#apply" size="lg" icon="send">索取合作方案</Button>
          <Button href="#plans" size="lg" variant="outline">看合作方案</Button>
        </div>
        {s && (
          <p className="mt-5 text-sm text-ink-faint">
            <span className="font-semibold text-ink">{fmt(s.members)}</span> 用戶 ·{" "}
            <span className="font-semibold text-ink">{fmt(s.shared)}</span> 已上架好券 ·{" "}
            <span className="font-semibold text-ink">{fmt(s.sent)}</span> 成功送出
          </p>
        )}

        {/* Product preview: a real-looking coupon + its report */}
        <div className="mx-auto mt-10 grid max-w-lg gap-4 sm:grid-cols-2">
          <MockCoupon />
          <ReportPreview />
        </div>
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

      {/* Who it's for */}
      <section>
        <div className="text-center">
          <Eyebrow>Who it&apos;s for</Eyebrow>
          <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">哪些品牌適合投放？</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FITS.map((f) => (
            <Card key={f.tag} className="flex items-start gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent">
                <Icon name={f.icon} size={18} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">{f.tag}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{f.use}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Case — clearly labelled as a placement simulation (示意) */}
      <section className="mx-auto max-w-3xl">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-6 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">投放模擬</p>
            <span className="rounded-full bg-gold-tint px-2.5 py-0.5 text-[11px] font-medium text-gold">示意數字，非實際案例</span>
          </div>
          <div className="p-6">
            <p className="font-semibold text-ink">某咖啡品牌投放 300 份「中杯拿鐵買一送一」，7 天期間可能看到：</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["曝光", "1,240"],
                ["申請", "186"],
                ["申請率", "15.0%"],
                ["實際領取", "150"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-canvas px-3 py-3 text-center">
                  <p className="font-display text-xl font-extrabold tabular-nums text-accent">{v}</p>
                  <p className="mt-1 text-[11px] text-ink-faint">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              以上為投放情境模擬，用來說明可追蹤的成效欄位；實際數字依品牌、優惠與檔期而不同。正式合作會提供你自己的即時報表。
            </p>
          </div>
        </Card>
      </section>

      {/* Placements */}
      <section className="rounded-[28px] bg-accent-tint/40 px-5 py-10 text-center sm:px-6 sm:py-12">
        <Eyebrow>Placements</Eyebrow>
        <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">你買到的不只是「被領走的次數」</h2>
        <p className="mx-auto mt-2.5 max-w-xl text-balance text-sm leading-relaxed text-ink-soft">
          除了券被申請、領取的次數，每張券還會在平台的多個原生版位持續露出——等於同時買到「導流」和「額外品牌曝光」。
        </p>
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2.5">
          {PLACEMENTS.map((p) => (
            <span key={p} className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm text-ink-soft">
              {p}
            </span>
          ))}
          {PLACEMENTS_UPCOMING.map((p) => (
            <span key={p} className="rounded-full border border-dashed border-line bg-paper/60 px-3.5 py-1.5 text-sm text-ink-faint">
              {p}・建置中
            </span>
          ))}
        </div>
        <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-ink-faint">
          標示「建置中」的版位上線後，標準方案以上自動納入、不另收費；合約以簽約當時已可提供的版位為準。
        </p>
        <p className="mx-auto mt-5 max-w-lg text-[13px] leading-relaxed text-ink-faint">
          為了守住社群體驗，企業內容佔比全站上限 30%——這也是你的券不會被當廣告滑掉的原因。
        </p>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-20">
        <div className="text-center">
          <Eyebrow>Plans</Eyebrow>
          <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">合作方案</h2>
          <p className="mx-auto mt-2 max-w-xl text-balance text-sm leading-relaxed text-ink-soft">
            不論是連鎖品牌還是校園小店都適用。先從早鳥方案小規模驗證，成效好再升級。
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} className={cn("flex flex-col p-6", p.hot && "border-2 border-accent shadow-lift")}>
              <div className="flex items-center gap-2">
                <p className="text-lg font-extrabold text-ink">{p.name}</p>
                {p.hot && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-white">最推薦</span>}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">{p.who}</p>
              {p.tag && <Pill className="mt-3 w-fit bg-gold-tint text-gold">{p.tag}</Pill>}
              <ul className="mt-4 flex-1 space-y-2 border-t border-line pt-4">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2 text-sm text-ink-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {pt}
                  </li>
                ))}
              </ul>
              <Button full variant={p.hot ? "primary" : "outline"} className="mt-5" onClick={() => pickPlan(p.name)}>
                {p.cta}
              </Button>
            </Card>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-ink-faint">
          實際名額、檔期與合作方式（社群曝光、活動頁製作等）都可依你的需求一起討論。
        </p>
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
          title="留 Email，我寄你完整方案與範例報表"
          subtitle="填品牌與合作目標即可，一分鐘完成。我會依你的產業與目標，把量身的方案、報價與範例報表寄到你的信箱。"
          plan={plan}
          onPlanChange={setPlan}
          planOptions={PLANS.map((p) => p.name)}
        />
      </section>
    </div>
  );
}
