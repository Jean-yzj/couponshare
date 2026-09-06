import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { MARK_WHITE, OG, OG_FONTS } from "@/lib/og-assets";
import { CATEGORY_LABEL } from "@/lib/categories";

// 單張券分享到 LINE／Threads 時的預覽卡。券頁本來就有 generateMetadata，但沒有
// images，所以分享一張券出去顯示的是首頁那張「這個網站是什麼」的通用卡——
// 看的人完全不知道被分享的是什麼券。
//
// 只放公開欄位（標題、品牌、分類、贈送或交換、到期日）。**條碼永遠不進這張圖**：
// OG 圖是任何人都抓得到的，而條碼是這個平台最敏感的欄位。
export const runtime = "nodejs";

const { INK, SOFT, FAINT, BLUE, TINT } = OG;

const KIND: Record<string, { label: string; tint: string; text: string }> = {
  FREE_ITEM: { label: "免費兌換", tint: "#e4f7ed", text: "#0b7a46" },
  DISCOUNT: { label: "折價券", tint: "#fdefdf", text: "#c26410" },
  BOGO: { label: "買一送一", tint: "#ece7fe", text: "#5a3fd0" },
};

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  const c =
    id && /^[0-9a-f-]{36}$/i.test(id)
      ? await prisma.coupon
          .findUnique({
            where: { id },
            select: { title: true, brand: true, category: true, type: true, redeemKind: true, expiryDate: true },
          })
          .catch(() => null)
      : null;

  // 查不到（券被刪、已下架、id 亂填）時畫一張不具名的卡，而不是轉址到預設圖。
  // 原本用 Response.redirect(new URL("/og-default.png", req.url))，但在 Zeabur 的
  // 反向代理後面 req.url 的 origin 是容器內部位址，實測吐出的是
  // `https://localhost:8080/og-default.png`——LINE 或 Facebook 跟著走只會拿到空的，
  // 預覽圖照樣壞掉。直接畫就沒有這個問題，也不必猜對外網址是什麼。
  if (!c) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200, height: 630, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", background: BLUE, fontFamily: "Noto",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK_WHITE} width={150} height={94} alt="" />
          <div style={{ display: "flex", fontSize: 44, fontWeight: 900, color: "#fff", marginTop: 30, flexShrink: 0 }}>
            CouponShare
          </div>
          <div
            style={{ display: "flex", fontSize: 27, color: "rgba(255,255,255,0.82)", marginTop: 16, flexShrink: 0 }}
          >
            把用不到的票券送給需要的人
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts: OG_FONTS, headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }

  // 站上標題最長 35 字（中位數 13）。字級固定的話長標題會爆版。
  const size = c.title.length <= 14 ? 66 : c.title.length <= 22 ? 54 : 44;
  const brand = (c.brand || "").trim() || "CouponShare";
  const kind = (c.redeemKind && KIND[c.redeemKind]) || KIND.DISCOUNT;
  const exp = c.expiryDate;
  const expText = exp ? `${exp.getMonth() + 1}/${exp.getDate()} 前使用` : "沒有期限";
  const isGift = c.type === "GIFT";

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: TINT, padding: 60, fontFamily: "Noto" }}>
        <div style={{ display: "flex", flex: 1, background: "#fff", borderRadius: 28, overflow: "hidden" }}>
          <div
            style={{
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              width: 300, background: BLUE, padding: "30px 20px",
            }}
          >
            <div
              style={{
                display: "flex", fontSize: brand.length <= 4 ? 44 : 32, fontWeight: 900, color: "#fff",
                textAlign: "center", flexShrink: 0,
              }}
            >
              {brand.length > 10 ? `${brand.slice(0, 10)}…` : brand}
            </div>
            <div style={{ display: "flex", marginTop: 16, flexShrink: 0 }}>
              <div
                style={{
                  display: "flex", background: "rgba(255,255,255,0.22)", color: "#fff", fontSize: 21,
                  fontWeight: 700, padding: "7px 16px", borderRadius: 999,
                }}
              >
                {CATEGORY_LABEL[c.category] ?? "其他"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 40, flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MARK_WHITE} width={46} height={29} alt="" />
              <div style={{ display: "flex", fontSize: 19, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                CouponShare
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex", flexDirection: "column", justifyContent: "center", flex: 1,
              padding: "0 58px", borderLeft: `4px dashed ${TINT}`,
            }}
          >
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexShrink: 0 }}>
              <div
                style={{
                  display: "flex", background: isGift ? TINT : "#fde7f0", color: isGift ? BLUE : "#c2185b",
                  fontSize: 21, fontWeight: 700, padding: "8px 18px", borderRadius: 999,
                }}
              >
                {isGift ? "免費贈送" : "交換"}
              </div>
              <div
                style={{
                  display: "flex", background: kind.tint, color: kind.text, fontSize: 21, fontWeight: 700,
                  padding: "8px 18px", borderRadius: 999,
                }}
              >
                {kind.label}
              </div>
            </div>
            {/* flexShrink:0 是必要的：satori 會把大級數 CJK 區塊壓到高度近乎 0，字就會溢出蓋到鄰居。 */}
            <div style={{ display: "flex", fontSize: size, fontWeight: 900, color: INK, lineHeight: 1.32, flexShrink: 0 }}>
              {c.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 26, flexShrink: 0 }}>
              <div style={{ display: "flex", fontSize: 24, color: SOFT }}>{expText}</div>
              <div style={{ display: "flex", fontSize: 24, color: FAINT }}>·</div>
              <div style={{ display: "flex", fontSize: 24, color: FAINT }}>先搶先贏，領完為止</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: OG_FONTS,
      // 一小時。券被領走之後卡片會過時，但 LINE／Facebook 本來就會在自己那端
      // 長時間快取，設更短也救不了，反而每次都白查一次資料庫。
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
