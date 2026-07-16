import type { Metadata } from "next";
import { Banner, Button, EmptyState, PageHeader } from "@/components/ui";
import { CouponCard } from "@/components/CouponCard";
import { getCurrentUser } from "@/lib/auth";
import { getCouponFeed } from "@/lib/feed";

export const metadata: Metadata = {
  title: "當日專區",
  alternates: { canonical: "/today" },
  description: "今天（台灣時間）就到期的贈送券，先領先用。用不到的當日券，分享給需要的人。",
};

// 內容以「台灣時間今天」為界，跨日就變 — 跟隨首頁的 force-dynamic，不做靜態快取。
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const viewer = await getCurrentUser();
  const feed = await getCouponFeed({
    viewer,
    type: "GIFT",
    expiringToday: true,
    sort: "expiry_soon",
    page: 1,
    limit: 50,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Today only"
        title="當日專區"
        subtitle="今天就到期的贈送券，像是停車折抵、當日餐飲券——先領先用。"
      />

      <div className="mt-4">
        <Banner tone="info" icon="clock">
          當日專區的券由使用者即時分享，當天到期、先領先用。平台不查驗券的有效性，無法保證每張券都能成功使用，請自行評估後領取。
        </Banner>
      </div>

      <div className="mt-5">
        {feed.data.length === 0 ? (
          <EmptyState
            icon="clock"
            title="現在沒有今天到期的券"
            hint="有用不到、今天就過期的券嗎？分享給需要的人。"
            action={
              <Button href="/new" icon="plus">
                分享一張券
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {feed.data.map((c) => (
              <CouponCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
