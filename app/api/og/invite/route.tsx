import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// 邀請連結（/login?ref=<userId>）貼到 LINE／Threads 時顯示的預覽卡。在此之前
// 邀請連結沿用的是首頁那張通用卡，看起來像廣告而不像朋友的邀請。
export const runtime = "nodejs";

const DIR = path.join(process.cwd(), "public");

// 字型在模組層讀一次。繁中一定要自載：next/og 內建的字型只有拉丁，沒傳 fonts
// 時它會在執行時去 fonts.googleapis.com 抓中文子集——那是間歇性失敗（單張測
// 幾乎都過、批次時零星整張豆腐框），而且 CJK 備援只有一個字重，中文永遠不會粗。
const FONTS = [400, 700, 900].map((weight) => ({
  name: "Noto",
  data: readFileSync(path.join(DIR, `fonts/noto-sans-tc-${weight}.woff`)),
  weight: weight as 400 | 700 | 900,
  style: "normal" as const,
}));

const markSrc = readFileSync(path.join(DIR, "couponshare-mark.svg")).toString();
// 藍底上要用單色白版：原圖左半就是品牌藍，直接放上去那一半會整塊消失。
const MARK_WHITE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    markSrc
      .replace(/fill="#2867E0"/i, 'fill="#ffffff"')
      .replace(/fill="#7B8492"/i, 'fill="#ffffff" fill-opacity="0.55"')
      .replace(/fill="#fff"/i, 'fill="#2867e0"'),
  ).toString("base64");

const INK = "#16181d", FAINT = "#8b93a1", BLUE = "#2867e0", TINT = "#edf3fe";

export async function GET(req: NextRequest) {
  const ref = new URL(req.url).searchParams.get("ref");

  // 只讀公開欄位，而且只有正常帳號才具名。被停權或不存在時退成不具名的版本，
  // 而不是報錯——預覽卡壞掉會讓整個連結看起來可疑。
  let name: string | null = null;
  if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
    const u = await prisma.user
      .findFirst({ where: { id: ref, status: "ACTIVE" }, select: { displayName: true } })
      .catch(() => null);
    // 暱稱上限 40 字，塞進這行會擠掉標題，所以截斷。
    if (u?.displayName) name = u.displayName.length > 12 ? `${u.displayName.slice(0, 12)}…` : u.displayName;
  }

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: TINT, padding: 60, fontFamily: "Noto" }}>
        <div style={{ display: "flex", flex: 1, background: "#fff", borderRadius: 28, overflow: "hidden" }}>
          <div
            style={{
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              width: 300, background: BLUE, padding: 30,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARK_WHITE} width={128} height={80} alt="" />
            <div style={{ display: "flex", fontSize: 25, fontWeight: 700, color: "#fff", marginTop: 22, flexShrink: 0 }}>
              CouponShare
            </div>
          </div>
          <div
            style={{
              display: "flex", flexDirection: "column", justifyContent: "center", flex: 1,
              padding: "0 62px", borderLeft: `4px dashed ${TINT}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 26, color: FAINT, marginBottom: 18, flexShrink: 0 }}>
              {name ? `${name} 邀請你加入` : "邀請你一起加入"}
            </div>
            {/* flexShrink:0 是必要的：satori 會把大級數 CJK 區塊壓到高度近乎 0，字就會溢出蓋到鄰居。 */}
            <div style={{ display: "flex", fontSize: 62, fontWeight: 900, color: INK, lineHeight: 1.3, flexShrink: 0 }}>
              你用不到的券，
            </div>
            <div style={{ display: "flex", fontSize: 62, fontWeight: 900, color: INK, lineHeight: 1.3, flexShrink: 0 }}>
              有人正需要
            </div>
            <div style={{ display: "flex", marginTop: 30, flexShrink: 0 }}>
              <div
                style={{
                  display: "flex", background: TINT, color: BLUE, fontSize: 24, fontWeight: 700,
                  padding: "12px 24px", borderRadius: 999,
                }}
              >
                免費贈送 · 不用點數 · 不用抽獎
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: FONTS,
      // 具名的卡片會隨暱稱改變，但改動極少；一天的快取讓 LINE／Threads 重複抓
      // 同一張時不必每次都查資料庫，又不至於讓改暱稱的人卡住太久。
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
