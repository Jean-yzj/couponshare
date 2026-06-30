"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "./CouponCard";
import { Button, Card } from "./ui";
import { Icon, type IconName } from "./icons";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/display";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "ticket",
    title: "上架你用不到的券",
    body: "把還沒時間兌換的飲料券、超商購物金拍照上傳，幾秒就能分享出去。",
  },
  {
    icon: "send",
    title: "讓需要的人留言申請",
    body: "想領取的人會留下一段話，由你親手挑選要送給誰，而不是被秒搶。",
  },
  {
    icon: "heart",
    title: "送出，並讓善意流動",
    body: "完成後雙方互道感謝，你也累積貢獻值，成為社群裡更被信任的人。",
  },
];

function SampleCard({
  brand,
  cat,
  title,
  owner,
  meta,
  type,
  className,
  style,
}: {
  brand: string;
  cat: string;
  title: string;
  owner: string;
  meta: string;
  type: "GIFT" | "EXCHANGE";
  className?: string;
  style?: React.CSSProperties;
}) {
  const chip = type === "GIFT" ? "bg-pine-tint text-pine" : "bg-teal-tint text-teal";
  return (
    <div
      className={cn("w-64 rounded-2xl border border-line bg-paper p-4 shadow-lift", className)}
      style={style}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold", chip)}>
            {brand[0]}
          </span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {brand} · {cat}
          </span>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", chip)}>
          {type === "GIFT" ? "免費贈送" : "交換"}
        </span>
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
      .then((r) => setFeatured(r.data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-20 pb-10">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-4 md:grid-cols-2 md:pt-10">
        <div className="text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-3 py-1 text-sm font-semibold text-accent-press">
            <Icon name="heart" size={14} /> 讓善意流動的地方
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
            把用不到的優惠券，
            <br />
            <span className="text-accent">送給</span>需要的人
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-soft">
            一張你還沒時間用的券，剛好是別人正需要的小確幸。把「我用不到」交給「我需要」，讓世界溫暖一點。
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <Button href="/login" size="lg" icon="heart">
              加入，開始分享
            </Button>
            <Button href="/login" size="lg" variant="outline">
              我已經有帳號
            </Button>
          </div>
        </div>

        {/* Card deck visual */}
        <div className="relative mx-auto flex h-72 w-full max-w-sm items-center justify-center">
          <SampleCard
            brand="Louisa"
            cat="咖啡"
            title="路易莎 指定飲品 88 折"
            owner="Amy · 達人"
            meta="想換手搖飲"
            type="EXCHANGE"
            className="absolute"
            style={{ transform: "rotate(-7deg) translate(-46px, -30px)" }}
          />
          <SampleCard
            brand="全家"
            cat="超商"
            title="全家 中杯經典美式"
            owner="Jean · 傳奇"
            meta="11 小時後到期"
            type="GIFT"
            className="absolute"
            style={{ transform: "rotate(6deg) translate(52px, 38px)" }}
          />
          <SampleCard
            brand="Starbucks"
            cat="咖啡"
            title="星巴克 大杯飲料買一送一"
            owner="Jean · 傳奇"
            meta="4 天後到期"
            type="GIFT"
            className="relative z-10"
          />
        </div>
      </section>

      {/* Origin story */}
      <section className="mx-auto max-w-2xl">
        <Card className="bg-accent-tint/50 p-7 sm:p-9">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent-press">
            <Icon name="sparkle" size={16} /> 為什麼做這個
          </p>
          <div className="mt-4 space-y-4 text-[16px] leading-loose text-ink-soft">
            <p>
              我常在社群上看到，很多人手邊有用不到的兌換券，也很樂意分享出去
              <span className="text-ink">——只是一直沒有一個好地方可以送。</span>
            </p>
            <p>
              於是我做了 CouponShare，想讓「我剛好用不到」可以遇上「我剛好需要」。
              每一張被好好使用的券，都是一次小小的互助；不用花一毛錢，也能讓彼此的生活、
              讓這個世界，變得溫暖一點點。
            </p>
          </div>
        </Card>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-ink">三步驟，開始互助</h2>
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
                  <Icon name={s.icon} size={20} />
                </span>
                <span className="text-lg font-bold text-ink-faint">0{i + 1}</span>
              </div>
              <p className="mt-3 font-semibold text-ink">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-4xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-ink">各種你會用到的券</h2>
        <p className="mt-2 text-sm text-ink-soft">超商購物金、手搖飲、咖啡、甜點… 都能直接兌換。</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {CATEGORIES.filter((c) => c.key !== "OTHER").map((c, i) => (
            <span
              key={c.key}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium shadow-soft",
                i % 2 === 0 ? "bg-accent-tint text-accent-press" : "border border-line bg-paper text-ink",
              )}
            >
              {c.label}
            </span>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-ink">現在有人正在分享</h2>
            <Link href="/login" className="text-sm font-medium text-accent hover:text-accent-press">
              全部票券
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {featured.map((c) => (
              <CouponCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      {/* Closing CTA */}
      <section className="flex flex-col items-center pt-2 text-center">
        <p className="text-xl font-bold tracking-tight text-ink">讓世界溫暖一點，從一張券開始</p>
        <p className="mt-1.5 text-sm text-ink-soft">你用不到的，也許正是別人今天需要的。</p>
        <div className="mt-5">
          <Button href="/login" size="lg" icon="heart">
            加入 CouponShare
          </Button>
        </div>
      </section>
    </div>
  );
}
