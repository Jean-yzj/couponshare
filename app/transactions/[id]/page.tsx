"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, useApi, useMe, ApiErr } from "@/lib/client";
import {
  Button,
  Card,
  Banner,
  Avatar,
  LevelBadge,
  Input,
  Textarea,
  Skeleton,
  EmptyState,
  Pill,
} from "@/components/ui";
import { BarcodeModal } from "@/components/BarcodeModal";
import { ReportModal } from "@/components/ReportModal";
import { Icon } from "@/components/icons";
import { cn, relativeTime } from "@/lib/display";

type Party = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_level: string;
  level_name: string;
  contribution_score: number;
};
type Msg = {
  id: string;
  sender: Party;
  message: string;
  created_at: string;
};
type Txn = {
  id: string;
  coupon_id: string;
  coupon: { id: string; title: string; brand: string } | null;
  owner: Party | null;
  claimant: Party | null;
  transaction_type: string;
  status: string;
  owner_completed: boolean;
  claimant_completed: boolean;
  role?: string;
  rated_by_viewer?: boolean;
  messages: Msg[];
};

const GIFT_STEPS = ["持有者已把券送給你", "點「查看條碼」到店兌換", "完成後別忘了互相評價與感謝"];
const EXCHANGE_STEPS = [
  "在下方訊息喬好怎麼交換（時間、地點、如何把券給對方）",
  "雙方各自把要交換的東西給對方",
  "兩邊都按「確認完成」，交易才算完成",
  "完成後互相評價",
];

export default function TransactionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const { data: t, loading, refetch } = useApi<Txn>(`/api/v1/transactions/${id}`);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  if (loading) return <Skeleton className="mx-auto h-72 max-w-2xl rounded-2xl" />;
  if (!t)
    return (
      <div className="py-10">
        <EmptyState icon="swap" title="找不到這筆交易" action={<Button href="/wallet" variant="outline">回到錢包</Button>} />
      </div>
    );

  const isExchange = t.transaction_type === "EXCHANGE";
  const counterpart = t.role === "owner" ? t.claimant : t.owner;
  const isClaimant = t.role === "claimant";
  const completed = t.status === "COMPLETED";
  const myConfirmed = t.role === "owner" ? t.owner_completed : t.claimant_completed;
  const otherConfirmed = t.role === "owner" ? t.claimant_completed : t.owner_completed;

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/v1/transactions/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text.trim() }),
      });
      setText("");
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "送出失敗");
    } finally {
      setSending(false);
    }
  }

  async function complete() {
    setCompleting(true);
    try {
      await apiFetch(`/api/v1/transactions/${id}/complete`, { method: "POST" });
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setCompleting(false);
    }
  }

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {t.coupon?.brand}
            </p>
            <h1 className="mt-1 text-xl font-bold text-ink">{t.coupon?.title ?? "交易"}</h1>
          </div>
          <Pill className={isExchange ? "bg-teal-tint text-teal" : "bg-pine-tint text-pine"}>
            {isExchange ? "交換" : "贈送"}
          </Pill>
        </div>
        {counterpart && (
          <Link
            href={`/users/${counterpart.id}`}
            className="mt-4 flex items-center gap-3 rounded-xl bg-canvas/60 p-3 transition-colors hover:bg-canvas-2"
          >
            <Avatar name={counterpart.display_name} url={counterpart.avatar_url} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">
                {t.role === "owner" ? "送給" : "領取自"} {counterpart.display_name}
              </p>
              <p className="text-xs text-ink-faint">{counterpart.contribution_score} 貢獻分</p>
            </div>
            <LevelBadge level={counterpart.user_level} />
            <Icon name="chevronRight" size={16} className="text-ink-faint" />
          </Link>
        )}
      </Card>

      {/* Step guide */}
      <Card className="mt-4 p-5">
        <p className="mb-3 flex items-center gap-1.5 font-semibold text-ink">
          <Icon name="info" size={17} className="text-accent" />
          {isExchange ? "交換怎麼進行" : "領取流程"}
        </p>
        <ol className="space-y-2.5">
          {(isExchange ? EXCHANGE_STEPS : GIFT_STEPS).map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-bold text-accent-press">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-ink-soft">{s}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Barcode for gift claimant */}
      {isClaimant && !isExchange && (
        <Card className="mt-4 flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-pine">
            <Icon name="shieldCheck" size={20} />
            <p className="text-sm font-medium text-ink">這張券已經是你的了</p>
          </div>
          <Button icon="ticket" onClick={() => setBarcodeOpen(true)}>
            查看條碼
          </Button>
        </Card>
      )}

      {/* Chat */}
      <Card className="mt-4 p-5">
        <p className="mb-3 font-semibold text-ink">交換訊息</p>
        {t.messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-faint">
            還沒有訊息。{isExchange ? "傳個訊息跟對方喬怎麼交換吧。" : "可以在這裡跟對方道謝。"}
          </p>
        ) : (
          <div className="space-y-3">
            {t.messages.map((m) => {
              const mine = m.sender.id === me?.id;
              return (
                <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
                  <Avatar name={m.sender.display_name} url={m.sender.avatar_url} size={28} />
                  <div className={cn("max-w-[75%]", mine && "items-end text-right")}>
                    <div
                      className={cn(
                        "inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        mine ? "bg-accent text-white" : "bg-sand text-ink",
                      )}
                    >
                      {m.message}
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-faint">{relativeTime(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!completed && (
          <div className="mt-4 flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="輸入訊息…"
            />
            <Button icon="send" loading={sending} onClick={send} disabled={!text.trim()}>
              傳送
            </Button>
          </div>
        )}
      </Card>

      {/* Complete / rating */}
      <Card className="mt-4 p-5">
        {completed ? (
          t.rated_by_viewer ? (
            <p className="flex items-center gap-2 text-sm font-medium text-pine">
              <Icon name="check" size={18} /> 交易已完成，謝謝你的評價！
            </p>
          ) : (
            <RatingForm
              txnId={t.id}
              toUser={counterpart}
              onDone={refetch}
            />
          )
        ) : (
          <div>
            <p className="font-semibold text-ink">
              {isExchange ? "雙方都確認後，交易才完成" : "完成後請確認"}
            </p>
            {isExchange && (
              <div className="mt-2 flex gap-2 text-xs">
                <span className={cn(myConfirmed ? "text-pine" : "text-ink-faint")}>
                  你：{myConfirmed ? "已確認" : "未確認"}
                </span>
                <span className="text-ink-faint">·</span>
                <span className={cn(otherConfirmed ? "text-pine" : "text-ink-faint")}>
                  對方：{otherConfirmed ? "已確認" : "未確認"}
                </span>
              </div>
            )}
            {myConfirmed ? (
              <Banner tone="info" icon="clock">
                <span className="text-ink-soft">你已確認，等待對方確認完成。</span>
              </Banner>
            ) : (
              <Button className="mt-3" icon="check" loading={completing} onClick={complete}>
                確認完成
              </Button>
            )}
          </div>
        )}
      </Card>

      {counterpart && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-danger"
          >
            <Icon name="flag" size={15} />
            檢舉對方（無效券 / 放鳥 / 不合理交換）
          </button>
        </div>
      )}

      <BarcodeModal couponId={t.coupon_id} open={barcodeOpen} onClose={() => setBarcodeOpen(false)} />
      {counterpart && (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          reportedUserId={counterpart.id}
          title={`檢舉 ${counterpart.display_name}`}
          onDone={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

const TAGS = ["回覆速度快", "人很好", "票券有效", "乾脆爽快", "會再交易"];

function RatingForm({
  txnId,
  toUser,
  onDone,
}: {
  txnId: string;
  toUser: Party | null;
  onDone: () => void;
}) {
  const [score, setScore] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!toUser) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/transactions/${txnId}/ratings`, {
        method: "POST",
        body: JSON.stringify({
          to_user_id: toUser!.id,
          rating_score: score,
          tags,
          comment: comment.trim() || null,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiErr ? e.message : "送出失敗");
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="font-semibold text-ink">評價 {toUser.display_name}</p>
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setScore(n)} aria-label={`${n} 星`}>
            <Icon name="star" size={30} className={cn(n <= score ? "fill-gold text-gold" : "text-line")} />
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {TAGS.map((tg) => (
          <button
            key={tg}
            onClick={() => setTags((p) => (p.includes(tg) ? p.filter((x) => x !== tg) : [...p, tg]))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              tags.includes(tg)
                ? "border-accent bg-accent-tint text-accent-press"
                : "border-line bg-paper text-ink-soft hover:bg-canvas-2",
            )}
          >
            {tg}
          </button>
        ))}
      </div>
      <Textarea
        className="mt-3"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="留下一句感謝或回饋（選填）"
      />
      {error && (
        <div className="mt-2">
          <Banner tone="warn" icon="info">{error}</Banner>
        </div>
      )}
      <Button className="mt-3" full icon="star" loading={busy} onClick={submit}>
        送出評價
      </Button>
    </div>
  );
}
