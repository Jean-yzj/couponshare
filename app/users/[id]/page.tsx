"use client";

import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/lib/client";
import { CouponCard, type FeedCoupon } from "@/components/CouponCard";
import { Card, Avatar, LevelBadge, Skeleton, EmptyState, Button, Banner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cn, formatDate, relativeTime } from "@/lib/display";

type RatingItem = {
  from: { display_name: string; avatar_url: string | null } | null;
  rating_score: number;
  tags: string[];
  comment: string | null;
  created_at: string;
};
type Profile = {
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    user_level: string;
    level_name: string;
    contribution_score: number;
    created_at: string;
    status: string;
  };
  rating: { avg: number | null; count: number; items: RatingItem[] };
  gifts_given: number;
  coupons: FeedCoupon[];
};

function Stars({ score, size = 16 }: { score: number; size?: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={size}
          className={cn(n <= Math.round(score) ? "fill-gold text-gold" : "text-line")}
        />
      ))}
    </span>
  );
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading } = useApi<Profile>(`/api/v1/users/${id}`);

  if (loading) return <Skeleton className="mx-auto h-64 max-w-2xl rounded-2xl" />;
  if (!data)
    return (
      <div className="py-10">
        <EmptyState icon="user" title="找不到這位使用者" action={<Button href="/" variant="outline">回到探索</Button>} />
      </div>
    );

  const { user, rating, gifts_given, coupons } = data;
  const suspended = user.status === "SUSPENDED";

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} />
        返回
      </button>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.display_name} url={user.avatar_url} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold text-ink">{user.display_name}</h1>
              <LevelBadge level={user.user_level} />
            </div>
            <p className="mt-0.5 text-xs text-ink-faint">於 {formatDate(user.created_at)} 加入</p>
          </div>
        </div>

        {suspended && (
          <div className="mt-4">
            <Banner tone="warn" icon="ban">
              此帳號因多次被檢舉已被停權。
            </Banner>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat value={String(user.contribution_score)} label="貢獻分" />
          <Stat value={String(gifts_given)} label="送出票券" />
          <Stat
            value={rating.avg != null ? rating.avg.toFixed(1) : "—"}
            label={rating.count > 0 ? `${rating.count} 則評價` : "尚無評價"}
            star
          />
        </div>
      </Card>

      {/* Ratings */}
      <h2 className="mb-3 mt-7 font-semibold text-ink">收到的評價</h2>
      {rating.items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-soft">還沒有評價。</Card>
      ) : (
        <div className="space-y-2.5">
          {rating.items.map((r, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {r.from && <Avatar name={r.from.display_name} url={r.from.avatar_url} size={28} />}
                  <span className="text-sm font-medium text-ink">{r.from?.display_name ?? "匿名"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Stars score={r.rating_score} size={14} />
                  <span className="text-xs text-ink-faint">{relativeTime(r.created_at)}</span>
                </div>
              </div>
              {r.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded-full bg-accent-tint px-2 py-0.5 text-xs text-accent-press">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.comment}</p>}
            </Card>
          ))}
        </div>
      )}

      {/* Their coupons */}
      <h2 className="mb-3 mt-7 font-semibold text-ink">{user.display_name} 正在分享</h2>
      {coupons.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-soft">目前沒有正在分享的票券。</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {coupons.map((c) => (
            <CouponCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, star }: { value: string; label: string; star?: boolean }) {
  return (
    <div className="rounded-xl bg-canvas/60 py-3">
      <p className="flex items-center justify-center gap-1 text-xl font-bold text-ink">
        {star && value !== "—" && <Icon name="star" size={16} className="fill-gold text-gold" />}
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-faint">{label}</p>
    </div>
  );
}
