import { readFileSync } from "node:fs";
import path from "node:path";

// OG 圖的共用資產。字型在模組層讀一次即可，別在每次請求時重讀 4MB。
//
// 繁中一定要自載：next/og 內建的字型只有拉丁，沒傳 fonts 時它會在執行時去
// fonts.googleapis.com 抓中文子集。那是間歇性失敗（單張測幾乎都過、批次時才
// 零星整張豆腐框），而且更陰險的症狀是「中文永遠不會粗」——CJK 備援只有一個
// 字重，所以 fontWeight 對中文靜靜地沒有作用，看起來像排版沒設計過。
// 驗證法：本機與線上算同一張圖的 md5，一致才代表線上用的是 repo 內的字型。
const DIR = path.join(process.cwd(), "public");

export const OG_FONTS = [400, 700, 900].map((weight) => ({
  name: "Noto",
  data: readFileSync(path.join(DIR, `fonts/noto-sans-tc-${weight}.woff`)),
  weight: weight as 400 | 700 | 900,
  style: "normal" as const,
}));

// 藍底上要用單色白版：原圖左半就是品牌藍，直接放上去那一半會整塊消失在背景裡。
const markSrc = readFileSync(path.join(DIR, "couponshare-mark.svg")).toString();
export const MARK_WHITE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    markSrc
      .replace(/fill="#2867E0"/i, 'fill="#ffffff"')
      .replace(/fill="#7B8492"/i, 'fill="#ffffff" fill-opacity="0.55"')
      .replace(/fill="#fff"/i, 'fill="#2867e0"'),
  ).toString("base64");

export const OG = {
  INK: "#16181d",
  SOFT: "#5b6471",
  FAINT: "#8b93a1",
  BLUE: "#2867e0",
  TINT: "#edf3fe",
} as const;
