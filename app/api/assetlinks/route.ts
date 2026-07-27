import { NextResponse } from "next/server";

// Android App Links 驗證檔，對外路徑是 /.well-known/assetlinks.json（見 next.config.ts 的 rewrites）。
//
// 指紋來源：Google Play Console →「測試與發布 › 應用程式完整性 › 應用程式簽署」。
// 那裡會有兩組 SHA-256：「應用程式簽署金鑰憑證」（Google 保管，正式安裝用）與
// 「上傳金鑰憑證」（EAS 保管）。兩組都要放進來，否則從 Play 安裝的版本無法通過驗證。
// 本機 debug 建置的指紋也可以一併加入以便測試。
//
// 以環境變數 ANDROID_CERT_SHA256 提供，多組用逗號分隔。
// 未設定時回 404——寧可讓 App Links 維持未啟用，也不要對外送出錯誤的指紋。
export const dynamic = "force-dynamic";

const ANDROID_PACKAGE = "com.lazybearlife.couponshare";

export async function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (fingerprints.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
