import type { ReasonPreset } from "@/components/ReasonModal";

// The suspension reason is not an internal note — it is pasted verbatim into the
// notification the suspended person receives:
//
//   你的帳號因違反平台規範已被暫停，相關票券已下架：{reason}。如有疑問可提出申訴。
//
// So each preset has to read as a complete explanation in that sentence, saying
// what was wrong and (where it helps) what the rule actually is. Terse admin
// shorthand fails that test: a real suspension logged only "平台禁止交易", and
// the recipient's appeal was literally "？？為何停權" — he had been told, and
// still could not tell what he had done. Hence the short chip label + long text.
//
// No trailing punctuation: the notification template supplies the 。
export const SUSPENSION_REASON_PRESETS: ReasonPreset[] = [
  {
    label: "販售行為",
    text: "你上架的票券標價出售或要求現金、轉帳。本平台只能免費贈送或以券換券，不接受金錢交易",
  },
  {
    label: "票券無效",
    text: "你上架的票券已過期、已被使用或無法兌換，與說明不符。上架前請先確認票券仍可正常使用",
  },
  {
    label: "附加條件",
    text: "你的票券需要加好友、追蹤帳號或完成任務才能兌換。平台規定票券必須可直接兌換，不得附加其他條件",
  },
  {
    label: "不是優惠券",
    text: "你上架的是推薦碼、邀請連結或集點活動，不是可直接兌換的優惠券",
  },
  {
    label: "惡意檢舉",
    text: "你多次對其他使用者提出不實檢舉，影響他人權益",
  },
  {
    label: "交易失聯",
    text: "你在對方申請成功後未依約完成兌換，或中途失去聯繫，影響對方權益",
  },
  {
    label: "言語不當",
    text: "你在交易對話中出現辱罵、騷擾或其他不當言語",
  },
];
