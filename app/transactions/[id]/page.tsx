"use client";

import { useRef, useState } from "react";
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
  Spinner,
} from "@/components/ui";
import { BarcodeModal } from "@/components/BarcodeModal";
import { ReportModal } from "@/components/ReportModal";
import { Modal } from "@/components/Modal";
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
  image_url: string | null;
  created_at: string;
};
type UserTrust = {
  joined_days_ago: number;
  completed_count: number;
  rating_avg: number | null;
  rating_count: number;
  is_new: boolean;
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
  owner_ready: boolean;
  claimant_ready: boolean;
  revealed: boolean;
  has_offer_barcode: boolean;
  disputed_at: string | null;
  role?: string;
  rated_by_viewer?: boolean;
  messages: Msg[];
  counterpart_trust: UserTrust | null;
};

const GIFT_STEPS = ["持有者已把券送給你", "點「查看條碼」到店兌換", "完成後別忘了互相評價與感謝"];
const EXCHANGE_STEPS = [
  "持有者的券已就緒；申請者上傳「要交換的條碼」",
  "兩邊各自按「確認交換」",
  "雙方都按下後，系統同時亮出彼此的條碼 — 沒人能先看到對方的就落跑",
  "各自到店兌換，沒問題就按「完成」並互評；有問題按「回報問題」",
];

const DISPUTE_REASONS: { key: string; label: string }[] = [
  { key: "INVALID_COUPON", label: "條碼無效 / 掃不出來" },
  { key: "ALREADY_USED", label: "已經被使用過" },
  { key: "EXPIRED_COUPON", label: "已過期" },
  { key: "SCAM", label: "詐騙 / 給假的" },
  { key: "OTHER", label: "其他問題" },
];

function fileToChatImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const maxSide = 960;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function TransactionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const { data: t, loading, refetch } = useApi<Txn>(`/api/v1/transactions/${id}`);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [offerBarcodeOpen, setOfferBarcodeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [readying, setReadying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [disputing, setDisputing] = useState(false);

  if (loading) return <Skeleton className="mx-auto h-72 max-w-2xl rounded-2xl" />;
  if (!t)
    return (
      <div className="py-10">
        <EmptyState icon="swap" title="找不到這筆交易" action={<Button href="/wallet" variant="outline">回到錢包</Button>} />
      </div>
    );

  const isExchange = t.transaction_type === "EXCHANGE";
  const isOwner = t.role === "owner";
  const isClaimant = t.role === "claimant";
  const counterpart = isOwner ? t.claimant : t.owner;
  const completed = t.status === "COMPLETED";
  const disputed = t.status === "DISPUTED";
  const revealed = t.revealed;
  const myReady = isOwner ? t.owner_ready : t.claimant_ready;
  const otherReady = isOwner ? t.claimant_ready : t.owner_ready;
  const myConfirmed = isOwner ? t.owner_completed : t.claimant_completed;
  const otherConfirmed = isOwner ? t.claimant_completed : t.owner_completed;
  const myBarcodeReady = isOwner ? true : t.has_offer_barcode;

  async function pickMessageImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("請選擇圖片檔（PNG / JPG / WebP / GIF）");
      return;
    }
    try {
      setImagePreview(await fileToChatImage(file));
    } catch {
      alert("無法讀取這張圖片，請換一張");
    }
  }

  async function send() {
    const message = text.trim();
    if (!message && !imagePreview) return;
    setSending(true);
    try {
      await apiFetch(`/api/v1/transactions/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message, image: imagePreview }),
      });
      setText("");
      setImagePreview(null);
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

  async function ready() {
    setReadying(true);
    try {
      await apiFetch(`/api/v1/transactions/${id}/ready`, { method: "POST" });
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "操作失敗");
    } finally {
      setReadying(false);
    }
  }

  async function uploadOffer(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/v1/transactions/${id}/offer-barcode`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || "上傳失敗");
      }
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  async function submitDispute(reason: string, note: string) {
    setDisputing(true);
    try {
      await apiFetch(`/api/v1/transactions/${id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason, description: note.trim() || null }),
      });
      setDisputeOpen(false);
      await refetch();
    } catch (e) {
      alert(e instanceof ApiErr ? e.message : "送出失敗");
    } finally {
      setDisputing(false);
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
            <p className="text-xs font-bold uppercase tracking-wide text-accent">{t.coupon?.brand}</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-snug tracking-tight text-ink">
              {t.coupon?.title ?? "交易"}
            </h1>
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
                {isExchange ? "交換對象" : isOwner ? "送給" : "來自"} {counterpart.display_name}
              </p>
              <p className="text-xs text-ink-faint">{counterpart.contribution_score} 貢獻分</p>
            </div>
            <LevelBadge level={counterpart.user_level} />
            <Icon name="chevronRight" size={16} className="text-ink-faint" />
          </Link>
        )}
        {t.counterpart_trust && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-xs text-ink-faint">
            <span className="flex items-center gap-1">
              <Icon name="clock" size={12} />
              加入 {t.counterpart_trust.joined_days_ago} 天
            </span>
            <span className="text-ink-faint">·</span>
            <span>完成 {t.counterpart_trust.completed_count} 筆</span>
            {t.counterpart_trust.rating_count > 0 && t.counterpart_trust.rating_avg !== null && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="flex items-center gap-0.5">
                  <Icon name="star" size={11} className="fill-gold text-gold" />
                  {t.counterpart_trust.rating_avg.toFixed(1)}（{t.counterpart_trust.rating_count}）
                </span>
              </>
            )}
          </div>
        )}
        {t.counterpart_trust?.is_new && isExchange && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/8 px-3.5 py-3">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-danger">
              <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
              <span>
                這是新帳號、交易紀錄還少。交換前建議先在聊天確認對方身分，並確認拿到的條碼可用後再按完成。
              </span>
            </p>
          </div>
        )}
      </Card>

      {/* Owner of a gift: thank-you, not the claimant's redeem steps */}
      {!isExchange && isOwner ? (
        <Card className="mt-4 p-5">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <Icon name="heart" size={17} className="text-pine" /> 感謝你的分享
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            你已經把這張券送出去了，謝謝你讓用不到的好康流動起來。等對方兌換後，別忘了回來互相評價與感謝。
          </p>
        </Card>
      ) : (
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
      )}

      {/* Gift claimant barcode */}
      {isClaimant && !isExchange && (
        <Card className="mt-4 flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Icon name="shieldCheck" size={20} className="text-pine" />
            <p className="text-sm font-medium text-ink">這張券已經是你的了</p>
          </div>
          <Button icon="ticket" onClick={() => setBarcodeOpen(true)}>
            查看條碼
          </Button>
        </Card>
      )}

      {/* Exchange escrow */}
      {isExchange && !completed && !disputed && (
        <Card className="mt-4 p-5">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
            <Icon name="swap" size={18} className="text-accent" /> 亮碼交換
          </p>
          {!revealed ? (
            <>
              <p className="text-sm leading-relaxed text-ink-soft">
                雙方都按下「確認交換」後，系統會
                <span className="font-medium text-ink">同時</span>
                亮出彼此的條碼，避免有人先看到對方的就落跑。
              </p>

              <div className="mt-4 rounded-xl bg-canvas/60 p-3.5">
                {isClaimant ? (
                  t.has_offer_barcode ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm text-pine">
                        <Icon name="check" size={16} /> 你的交換條碼已上傳
                      </span>
                      {!myReady && (
                        <UploadButton small label="重新上傳" busy={uploading} onFile={uploadOffer} />
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-ink">先上傳你要交換的條碼</p>
                      <p className="mt-0.5 text-xs text-ink-faint">在你們都確認前，對方都看不到它。</p>
                      <UploadButton
                        className="mt-2.5"
                        label="上傳交換條碼"
                        busy={uploading}
                        onFile={uploadOffer}
                      />
                    </div>
                  )
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-pine">
                    <Icon name="check" size={16} /> 你的券條碼已就緒
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className={cn("inline-flex items-center gap-1", myReady ? "text-pine" : "text-ink-faint")}>
                  <Icon name={myReady ? "check" : "clock"} size={13} /> 你：{myReady ? "已確認" : "未確認"}
                </span>
                <span className="text-ink-faint">·</span>
                <span className={cn("inline-flex items-center gap-1", otherReady ? "text-pine" : "text-ink-faint")}>
                  <Icon name={otherReady ? "check" : "clock"} size={13} /> 對方：{otherReady ? "已確認" : "未確認"}
                </span>
              </div>

              {myReady ? (
                <div className="mt-3">
                  <Banner tone="info" icon="clock">
                    <span className="text-ink-soft">你已確認，等對方也按下「確認交換」就會同時亮碼。</span>
                  </Banner>
                </div>
              ) : (
                <Button className="mt-3" icon="check" loading={readying} disabled={!myBarcodeReady} onClick={ready}>
                  確認交換
                </Button>
              )}
              {!myBarcodeReady && !myReady && (
                <p className="mt-2 text-xs text-ink-faint">要先準備好你的條碼才能確認。</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-ink-soft">
                雙方都確認了，條碼已亮出。各自到店兌換，沒問題就按完成；如果對方的券有問題，請回報。
              </p>
              <Button
                className="mt-3"
                icon="ticket"
                onClick={() => (isOwner ? setOfferBarcodeOpen(true) : setBarcodeOpen(true))}
              >
                查看對方的條碼
              </Button>

              <div className="mt-4 border-t border-line pt-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className={cn(myConfirmed ? "text-pine" : "text-ink-faint")}>
                    你：{myConfirmed ? "已完成" : "未完成"}
                  </span>
                  <span className="text-ink-faint">·</span>
                  <span className={cn(otherConfirmed ? "text-pine" : "text-ink-faint")}>
                    對方：{otherConfirmed ? "已完成" : "未完成"}
                  </span>
                </div>
                {myConfirmed ? (
                  <div className="mt-3">
                    <Banner tone="info" icon="clock">
                      <span className="text-ink-soft">你已確認完成，等待對方確認。</span>
                    </Banner>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button icon="check" loading={completing} onClick={complete}>
                      沒問題，完成交換
                    </Button>
                    <Button variant="danger" icon="flag" onClick={() => setDisputeOpen(true)}>
                      對方的券有問題
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Disputed */}
      {disputed && (
        <Card className="mt-4 p-5">
          <Banner tone="warn" icon="flag">
            此交易已回報問題，平台複核中。若你覺得被誤會，可到帳號頁提出申訴。
          </Banner>
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
                    {m.image_url && (
                      <a href={m.image_url} target="_blank" rel="noreferrer" className="mb-1.5 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.image_url}
                          alt="訊息圖片"
                          loading="lazy"
                          decoding="async"
                          className="max-h-64 max-w-full rounded-2xl border border-line object-contain shadow-soft"
                        />
                      </a>
                    )}
                    {m.message && (
                      <div
                        className={cn(
                          "inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                          mine ? "bg-accent text-white" : "bg-sand text-ink",
                        )}
                      >
                        {m.message}
                      </div>
                    )}
                    <p className="mt-0.5 text-[11px] text-ink-faint">{relativeTime(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!disputed && (
          <div className="mt-4 space-y-2">
            {imagePreview && (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-canvas/60 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="待傳送圖片"
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">已選擇圖片</p>
                  <p className="text-xs text-ink-faint">送出前會先壓縮，點叉叉可移除。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  aria-label="移除圖片"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-sand hover:text-ink"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={pickMessageImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                aria-label="選擇圖片"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink-soft transition-colors hover:bg-sand hover:text-ink"
              >
                <Icon name="image" size={19} />
              </button>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={imagePreview ? "加一句話（可不填）…" : "輸入訊息…"}
              />
              <Button icon="send" loading={sending} onClick={send} disabled={!text.trim() && !imagePreview}>
                傳送
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Gift completion / rating after completion */}
      {completed ? (
        <Card className="mt-4 p-5">
          {t.rated_by_viewer ? (
            <p className="flex items-center gap-2 text-sm font-medium text-pine">
              <Icon name="check" size={18} /> 交易已完成，謝謝你的評價！
            </p>
          ) : (
            <RatingForm txnId={t.id} toUser={counterpart} onDone={refetch} />
          )}
        </Card>
      ) : !isExchange && !disputed ? (
        <Card className="mt-4 p-5">
          <p className="font-semibold text-ink">完成後請確認</p>
          <p className="mt-1 text-sm text-ink-soft">兌換完成後按一下，雙方就能互相評價。</p>
          <Button className="mt-3" icon="check" loading={completing} onClick={complete}>
            確認完成
          </Button>
        </Card>
      ) : null}

      {/* First-claim second-touch CTA: show below the completed card for the claimant who hasn't shared yet */}
      {completed && isClaimant && me && me.has_shared === false && (
        <div className="mt-3 text-center">
          <Link
            href="/new?src=first-claim"
            className="text-sm text-ink-soft transition-colors hover:text-accent"
          >
            也把你用不到的券分享出去 →
          </Link>
        </div>
      )}

      {counterpart && !disputed && (
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
      <BarcodeModal
        endpoint={`/api/v1/transactions/${t.id}/offer-barcode`}
        title="對方的交換條碼"
        open={offerBarcodeOpen}
        onClose={() => setOfferBarcodeOpen(false)}
      />
      <DisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        busy={disputing}
        onSubmit={submitDispute}
      />
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

function UploadButton({
  label,
  busy,
  onFile,
  small,
  className,
}: {
  label: string;
  busy: boolean;
  onFile: (f: File) => void;
  small?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full bg-accent font-medium text-white transition-colors hover:bg-accent-press",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        busy && "pointer-events-none opacity-60",
        className,
      )}
    >
      {busy ? <Spinner size={small ? 13 : 15} /> : <Icon name="image" size={small ? 13 : 16} />}
      {busy ? "上傳中…" : label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function DisputeModal({
  open,
  onClose,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onSubmit: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState("INVALID_COUPON");
  const [note, setNote] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="回報交換問題" size="sm">
      <p className="text-sm leading-relaxed text-ink-soft">
        對方給的條碼有什麼問題？平台會複核；惡意提供假券、已用過的券會被處分。
      </p>
      <div className="mt-3 space-y-1.5">
        {DISPUTE_REASONS.map((r) => {
          const active = reason === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                active ? "border-accent bg-accent-tint text-accent-press" : "border-line bg-paper text-ink-soft hover:bg-canvas-2",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border",
                  active ? "border-accent bg-accent text-white" : "border-line",
                )}
              >
                {active && <Icon name="check" size={11} />}
              </span>
              {r.label}
            </button>
          );
        })}
      </div>
      <Textarea
        className="mt-3"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="補充說明（選填）。可在聊天室附上截圖證據。"
      />
      <div className="mt-4 flex gap-2">
        <Button variant="outline" full onClick={onClose}>
          取消
        </Button>
        <Button variant="danger" full loading={busy} onClick={() => onSubmit(reason, note)}>
          送出回報
        </Button>
      </div>
    </Modal>
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
          <Banner tone="warn" icon="info">
            {error}
          </Banner>
        </div>
      )}
      <Button className="mt-3" full icon="star" loading={busy} onClick={submit}>
        送出評價
      </Button>
    </div>
  );
}
