"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "./CouponCard";
import { LiveStats } from "./LiveStats";
import { Button, Card, Eyebrow } from "./ui";
import { Icon, type IconName } from "./icons";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/display";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "ticket", title: "上架你用不到的券", body: "把還沒時間兌換的飲料券、超商購物金拍照上傳，幾秒就能分享出去。" },
  { icon: "send", title: "讓需要的人留言申請", body: "你可以親手挑選分享給誰，也可以設定直接送給第一個申請的人。" },
  { icon: "heart", title: "完成，並讓善意流動", body: "送出或交換完成後互道感謝，你也累積貢獻值，成為社群裡更被信任的人。" },
];

type FeatureKind = "explore" | "share" | "exchange" | "level" | "expiring" | "wallet";
const FEATURES: { kind: FeatureKind; icon: IconName; title: string; body: string }[] = [
  { kind: "explore", icon: "compass", title: "探索票券", body: "依分類、品牌、即將到期快速找券；追蹤喜歡的品牌，有新券馬上通知你。" },
  { kind: "share", icon: "heart", title: "彈性分享，不被秒搶", body: "想要的人留言申請，你可自己決定給誰，也可快速送給第一位申請者。" },
  { kind: "exchange", icon: "swap", title: "安全交換，雙方亮碼", body: "想交換？雙方都確認後系統才同時亮出條碼，沒人能拿了就跑。" },
  { kind: "level", icon: "medal", title: "貢獻值與等級", body: "每次成功分享都累積貢獻值，等級越高越被信任，也解鎖更多每日額度。" },
  { kind: "expiring", icon: "clock", title: "快過期？幫忙領走", body: "即將到期的券會被推到最前面，別讓任何好康白白浪費掉。" },
  { kind: "wallet", icon: "wallet", title: "你的票券錢包", body: "分享出去的、領到的券，全部收進錢包，一目了然好管理。" },
];

const SAMPLE_COUPONS: {
  brand: string; cat: string; title: string; owner: string; meta: string; type: "GIFT" | "EXCHANGE";
}[] = [
  { brand: "星巴克", cat: "咖啡", title: "星巴克 大杯飲料買一送一", owner: "Jean · 傳奇", meta: "4 天後到期", type: "GIFT" },
  { brand: "全家", cat: "超商", title: "全家 任選飲料第二件 6 折", owner: "Nina · 傳奇", meta: "11 小時後到期", type: "GIFT" },
  { brand: "摩斯", cat: "速食", title: "摩斯漢堡 經典漢堡買一送一", owner: "Ken · 達人", meta: "3 天後到期", type: "GIFT" },
  { brand: "星巴克", cat: "咖啡", title: "星巴克 指定飲品折 30 元", owner: "Amy · 達人", meta: "想換超商購物金", type: "EXCHANGE" },
  { brand: "7-ELEVEN", cat: "超商", title: "7-ELEVEN 中杯熱美式兌換券", owner: "Mia · 新手", meta: "5 天後到期", type: "GIFT" },
  { brand: "摩斯", cat: "速食", title: "摩斯漢堡 黃金薯條兌換券", owner: "Leo · 新手", meta: "2 天後到期", type: "GIFT" },
];

function SampleCard({
  brand, cat, title, owner, meta, type, wide, className, style,
}: {
  brand: string; cat: string; title: string; owner: string; meta: string;
  type: "GIFT" | "EXCHANGE"; wide?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const chip = type === "GIFT" ? "bg-pine-tint text-pine" : "bg-teal-tint text-teal";
  return (
    <div className={cn("rounded-2xl border border-line bg-paper p-4 shadow-lift", wide && "w-full", className)} style={style}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", chip)}>{brand[0]}</span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{brand} · {cat}</span>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", chip)}>{type === "GIFT" ? "免費贈送" : "交換"}</span>
      </div>
      <p className="mt-2.5 font-semibold leading-snug text-ink">{title}</p>
      <div className="my-3 border-t border-dashed border-line" />
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink">{owner}</span>
        <span className="text-ink-faint">{meta}</span>
      </div>
    </div>
  );
}

export function Landing() {
  const [featured, setFeatured] = useState<FeedCoupon[]>([]);
  useEffect(() => {
    apiFetch<{ data: FeedCoupon[] }>("/api/v1/coupons/feed?limit=3&sort=popular")
      .then((r) => setFeatured(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-24 pb-12">
      {/* Hero */}
      <section className="pt-6 md:pt-14">
        <div className="grid items-center gap-6 md:grid-cols-[1.05fr_0.95fr] md:gap-14">
          <div className="text-center md:text-left">
            <Eyebrow>
              <Icon name="heart" size={13} /> Share what you don&apos;t use
            </Eyebrow>
            <h1 className="mt-4 text-[2.15rem] font-extrabold leading-[1.16] tracking-tight text-ink sm:text-[2.7rem] md:text-[3.3rem]">
              把用不到的優惠券，
              <br />
              和需要的人
              <span className="relative whitespace-nowrap text-accent">
                分享
                <svg aria-hidden viewBox="0 0 120 8" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-2.5 w-full text-accent/30">
                  <path d="M1 5.5 C 34 1, 88 1, 119 4.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-ink-soft md:mx-0 md:text-base">
              你用不到的那一張，也許正是別人今天需要的。
              <br className="hidden sm:block" />
              送出去不花一毛錢，也讓生活多一點善意。
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center md:justify-start">
              <Button href="/login" size="lg" icon="heart">加入，開始分享</Button>
              <Button href="/login" size="lg" variant="outline">我已經有帳號</Button>
            </div>
            <div className="mt-8 flex justify-center md:justify-start">
              <LiveStats />
            </div>
          </div>

          {/* Product peek — a tidy little stack of shared coupons */}
          <div className="relative mx-auto h-[264px] w-full max-w-[300px] md:h-[344px] md:max-w-[380px]">
            <SampleCard brand="全家" cat="超商" title="全家 任選飲料第二件 6 折" owner="Nina · 傳奇" meta="11 小時後到期" type="GIFT"
              className="absolute right-0 top-0 w-[178px] rotate-[5deg] sm:w-[206px]" />
            <SampleCard brand="摩斯" cat="速食" title="摩斯漢堡 經典漢堡買一送一" owner="Amy · 達人" meta="想換超商券" type="EXCHANGE"
              className="absolute left-0 top-6 w-[178px] -rotate-[6deg] sm:w-[206px]" />
            <SampleCard brand="星巴克" cat="咖啡" title="星巴克 大杯飲料買一送一" owner="Jean · 傳奇" meta="4 天後到期" type="GIFT"
              className="absolute bottom-0 left-1/2 z-10 w-[216px] -translate-x-1/2 sm:w-[236px]" />
          </div>
        </div>
      </section>

      {/* Origin story */}
      <section className="mx-auto max-w-2xl">
        <Card className="relative overflow-hidden bg-accent-tint/50 p-7 sm:p-9">
          <span aria-hidden className="pointer-events-none absolute -right-1 -top-8 select-none font-display text-[130px] leading-none text-accent/10">”</span>
          <Eyebrow>
            <Icon name="sparkle" size={14} /> Our story · 為什麼做這個
          </Eyebrow>
          <div className="relative mt-4 space-y-4 text-[16px] leading-loose text-ink-soft">
            <p>我常在社群上看到，很多人手邊有用不到的兌換券，也很樂意分享出去<span className="text-ink">——只是一直沒有一個好地方可以分享。</span></p>
            <p>於是我做了 CouponShare，想讓「我剛好用不到」可以遇上「我剛好需要」。每一張被好好使用的券，都是一次小小的互助；不用花一毛錢，也能讓彼此的生活、讓這個世界，變得溫暖一點點。</p>
          </div>
          <p className="mt-5 text-sm font-medium text-ink-faint">— CouponShare，一個關於分享的小小實驗</p>
        </Card>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl">
        <div className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">三步驟，開始互助</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">分享一張券，從來沒這麼簡單。</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white"><Icon name={s.icon} size={20} /></span>
                <span className="font-display text-lg font-extrabold text-ink-faint">0{i + 1}</span>
              </div>
              <p className="mt-3 font-semibold text-ink">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-tint/40 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-grad-brand text-white shadow-glow">
            <Icon name="gift" size={18} />
          </span>
          <p className="text-sm leading-relaxed text-ink-soft">
            <span className="font-bold text-ink">給予，才能一直拿到好康。</span>{" "}
            新加入可先申請 3 次；分享一張自己用不到的券後，就能依等級每天申請（新手每日 5 張）。之後每多分享一張，當天就再 +3 次——讓好康在社群裡一直流動下去。
          </p>
        </div>
      </section>

      {/* Platform features — tinted zone, each card with a mini demo */}
      <section className="mx-auto max-w-5xl">
        <div className="rounded-[28px] bg-accent-tint/35 p-6 sm:p-10">
          <div className="text-center">
            <Eyebrow>The platform · 平台特色</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">為了讓善意一直循環下去</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">從找券、分享、交換到累積信任，每個環節都幫你想好了。</p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.kind} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift">
                <div className="flex h-32 items-center justify-center border-b border-line bg-canvas px-5">
                  <FeatureVisual kind={f.kind} />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <Icon name={f.icon} size={18} className="text-accent" />
                    <p className="font-semibold text-ink">{f.title}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real featured coupons once they exist, otherwise a labelled preview */}
      {featured.length >= 3 ? (
        <section className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">現在有人正在分享</h2>
            <Link href="/login" className="text-sm font-medium text-accent hover:text-accent-press">全部票券</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {featured.map((c) => <CouponCard key={c.id} c={c} />)}
          </div>
        </section>
      ) : (
        <DemoPreview />
      )}

      {/* Closing CTA — solid blue band (plain div so the colour actually renders) */}
      <section className="mx-auto max-w-3xl">
        <div className="relative flex flex-col items-center overflow-hidden rounded-[28px] bg-grad-brand-deep px-6 py-12 text-center shadow-glow">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-14 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          </div>
          <span className="relative eyebrow text-white/80">Join us</span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">讓世界溫暖一點，從一張券開始</h2>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-white/85">你用不到的，也許正是別人今天需要的。加入我們，把好康傳下去。</p>
          <Button href="/login" size="lg" variant="secondary" icon="heart" className="mt-6">加入 CouponShare</Button>
        </div>
      </section>
    </div>
  );
}

/* ── Mini demo visuals for each feature ── */
function Stripe() {
  return (
    <div className="flex h-5 items-end gap-[2px]">
      {[3, 5, 2, 4, 6, 2, 5, 3, 4, 2, 5].map((h, i) => (
        <span key={i} className="w-[2px] rounded-sm bg-ink/70" style={{ height: `${h * 3 + 4}px` }} />
      ))}
    </div>
  );
}

function FeatureVisual({ kind }: { kind: FeatureKind }) {
  if (kind === "explore") {
    return (
      <div className="w-full max-w-[230px] space-y-2">
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1.5 shadow-soft">
          <Icon name="search" size={12} className="text-ink-faint" />
          <span className="text-[11px] text-ink-faint">星巴克</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">全部</span>
          {["超商", "咖啡", "速食"].map((c) => (
            <span key={c} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] text-ink-soft">{c}</span>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "share") {
    return (
      <div className="w-full max-w-[230px] space-y-1.5">
        {[{ m: "我超需要這張！", pick: true }, { m: "可以分我嗎～", pick: false }].map((r, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2 py-1.5 shadow-soft">
            <span className="h-5 w-5 shrink-0 rounded-full bg-accent-tint" />
            <span className="flex-1 truncate text-[10px] text-ink-soft">{r.m}</span>
            {r.pick && <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-medium text-white">選他</span>}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "exchange") {
    return (
      <div className="flex w-full items-center justify-center gap-2">
        <div className="h-16 w-[64px] rounded-lg border border-line bg-paper p-2 shadow-soft">
          <span className="block h-1.5 w-7 rounded bg-teal-tint" />
          <div className="mt-2"><Stripe /></div>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-soft"><Icon name="lock" size={13} /></span>
        <div className="h-16 w-[64px] rounded-lg border border-line bg-paper p-2 shadow-soft">
          <span className="block h-1.5 w-7 rounded bg-pine-tint" />
          <div className="mt-2"><Stripe /></div>
        </div>
      </div>
    );
  }
  if (kind === "level") {
    return (
      <div className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-gold-tint px-2.5 py-0.5 text-[10px] font-bold text-gold"><Icon name="medal" size={11} /> 傳奇</span>
        <p className="mt-1.5 font-display text-3xl font-extrabold leading-none text-ink">152<span className="ml-0.5 align-top text-[10px] font-medium text-ink-faint">分</span></p>
        <div className="mx-auto mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-sand"><div className="h-full w-[82%] rounded-full bg-accent" /></div>
      </div>
    );
  }
  if (kind === "expiring") {
    return (
      <div className="w-[160px] rounded-xl border border-danger/30 bg-paper p-2.5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">星巴克</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-tint px-1.5 py-0.5 text-[9px] font-medium text-danger"><Icon name="clock" size={9} /> 11 小時</span>
        </div>
        <p className="mt-1.5 text-[11px] font-semibold text-ink">大杯飲料買一送一</p>
        <div className="mt-2 w-full rounded-full bg-accent py-1 text-center text-[9px] font-medium text-white">幫忙領走</div>
      </div>
    );
  }
  // wallet
  return (
    <div className="w-full max-w-[210px]">
      <div className="mb-2 flex w-fit gap-0.5 rounded-full bg-sand p-0.5 text-[9px]">
        <span className="rounded-full bg-paper px-2.5 py-0.5 font-medium text-ink shadow-soft">分享出去</span>
        <span className="px-2.5 py-0.5 text-ink-soft">領到的</span>
      </div>
      <div className="space-y-1.5">
        {[{ b: "星巴克", t: "大杯買一送一", c: "bg-pine-tint" }, { b: "全家", t: "飲料第二件 6 折", c: "bg-teal-tint" }].map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-paper px-2 py-1.5 shadow-soft">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-ink/70", r.c)}>{r.b[0]}</span>
            <span className="flex-1 truncate text-[10px] font-medium text-ink">{r.t}</span>
            <Icon name="chevronRight" size={12} className="text-ink-faint" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoPreview() {
  const previewCats = CATEGORIES.filter((c) => c.key !== "OTHER").slice(0, 6);
  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-6 text-center">
        <Eyebrow>
          <Icon name="eye" size={13} /> Preview · 平台預覽
        </Eyebrow>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">登入後，票券牆會長這樣</h2>
        <p className="mt-2 text-sm text-ink-soft">以下為示意內容，實際票券由社群即時分享、隨時更新。</p>
      </div>
      <div className="rounded-3xl border border-line bg-canvas p-3 shadow-lift sm:p-5">
        <div className="mb-4 space-y-3 rounded-2xl border border-line bg-paper/70 p-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2 text-sm text-ink-faint">
            <Icon name="search" size={16} /> 搜尋品牌，例如 星巴克、全家、摩斯
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">全部分類</span>
            {previewCats.map((c) => (
              <span key={c.key} className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink-soft">{c.label}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_COUPONS.map((c) => <SampleCard key={c.title} wide {...c} />)}
        </div>
      </div>
    </section>
  );
}
