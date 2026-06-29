"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "./CouponCard";
import { Button, Card } from "./ui";
import { Icon, type IconName } from "./icons";
import { CATEGORIES } from "@/lib/categories";

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

export function Landing() {
  const [featured, setFeatured] = useState<FeedCoupon[]>([]);

  useEffect(() => {
    apiFetch<{ data: FeedCoupon[] }>("/api/v1/coupons/feed?limit=3&sort=popular")
      .then((r) => setFeatured(r.data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-16 pb-8">
      {/* Hero */}
      <section className="pt-4 text-center sm:pt-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-3 py-1 text-sm font-semibold text-accent-press">
          <Icon name="heart" size={14} /> 讓善意流動的地方
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          把用不到的優惠券，
          <br />
          <span className="text-accent">送給</span>需要的人
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          一張你還沒時間用的券，剛好是別人正需要的小確幸。
          <br className="hidden sm:block" />
          在 CouponShare，把「我用不到」交給「我需要」，讓世界溫暖一點。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button href="/login" size="lg" icon="heart">
            加入，開始分享
          </Button>
          <Button href="/login" size="lg" variant="outline">
            我已經有帳號
          </Button>
        </div>
      </section>

      {/* Origin story */}
      <section className="mx-auto max-w-2xl">
        <Card className="p-7 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">為什麼做這個</p>
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
            <p className="text-ink">這是一份個人筆記般的小作品，謝謝你也願意一起讓善意流動。</p>
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
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-tint text-accent">
                  <Icon name={s.icon} size={20} />
                </span>
                <span className="text-sm font-bold text-ink-faint">0{i + 1}</span>
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
          {CATEGORIES.filter((c) => c.key !== "OTHER").map((c) => (
            <span
              key={c.key}
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink shadow-soft"
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
      <section className="mx-auto max-w-2xl">
        <Card className="bg-accent p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white">讓世界溫暖一點，從一張券開始</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            你用不到的，也許正是別人今天需要的。
          </p>
          <div className="mt-6">
            <Button href="/login" size="lg" variant="secondary" icon="heart">
              加入 CouponShare
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
