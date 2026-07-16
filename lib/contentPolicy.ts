// 上架內容關鍵字黑名單 — 軟性攔截，客戶端（app/new/Client.tsx）與伺服器端
// （POST /api/v1/coupons、PATCH /api/v1/coupons/[id]）共用，訊息才會一致。
// 設計原則：寧可漏擋不可誤殺——用具體詞、不用高誤殺率的單字
// （「菸」幾乎只出現在菸品語境所以可用；「酒」「藥」單字禁用，
// 否則會擋掉「酒釀」「藥妝」「藥膳」等正常券）。
export const BLOCKED_CONTENT: { category: string; words: string[] }[] = [
  { category: "菸類", words: ["菸", "香煙", "電子煙", "加熱煙", "雪茄"] },
  {
    category: "酒類",
    words: ["啤酒", "紅酒", "白酒", "威士忌", "清酒", "調酒", "高粱", "伏特加", "酒類", "洋酒"],
  },
  { category: "藥類", words: ["處方藥", "成藥", "藥品", "醫療器材"] },
  { category: "博弈", words: ["彩券", "刮刮樂", "樂透", "博弈"] },
  {
    category: "其他",
    words: ["成人用品", "情趣", "醫美", "微整", "肉毒", "玻尿酸", "基金", "保險", "股票", "虛擬貨幣"],
  },
];

export type BlockedHit = { category: string; word: string };

// 找出第一個命中的黑名單詞（含類別）；沒命中回 null。
export function findBlockedContent(text: string): BlockedHit | null {
  for (const group of BLOCKED_CONTENT) {
    for (const word of group.words) {
      if (text.includes(word)) return { category: group.category, word };
    }
  }
  return null;
}

// 給使用者看的攔截原因 — 客戶端與伺服器端共用同一句。
export function blockedContentMessage(hit: BlockedHit): string {
  return `本平台不開放刊登菸酒、藥品、彩券等受法令限制的內容（偵測到「${hit.word}」）。若為誤判，請來信 iamlazybear2023@gmail.com`;
}
