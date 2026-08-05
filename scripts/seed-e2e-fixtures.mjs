// 模擬器／瀏覽器端對端測試用的種子資料。
//
// 只跑在 /tmp 拋棄式測試庫（.env.local 指向 localhost:54329）——**不要對正式庫執行**。
// 跑之前先確認：
//   set -a && . ./.env.local && set +a && echo $DATABASE_URL   # 必須是 localhost:54329
//
// 跑法：
//   set -a && . ./.env.local && set +a && npx tsx scripts/seed-e2e-fixtures.mjs
//
// 造出三組情境，涵蓋 2026-08-05 交接檔列的三條待驗路徑：
//   A 兌換碼交換（券主兌換碼 × 領取者圖片）
//   B 兌換碼交換（券主圖片 × 領取者兌換碼）
//   C 空手的交換——用來測「確認交換」在沒提供任何東西時是否 disabled，
//     以及走 UI 填入兌換碼的完整流程
//   D 被停權的帳號——申訴畫面只有 SUSPENDED 進得去
import { PrismaClient } from "@prisma/client";
import { hashPassword, encryptBarcode } from "../lib/crypto.js";

const prisma = new PrismaClient();

const PASSWORD = "test1234";
const PW_HASH = hashPassword(PASSWORD);

// 1x1 透明 PNG，足夠讓「有沒有圖」的判斷成立，又不佔空間。
const FAKE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

if (!/localhost:54329/.test(process.env.DATABASE_URL || "")) {
  throw new Error(
    `拒絕執行：DATABASE_URL 不是本機測試庫（localhost:54329）。目前指向 ${process.env.DATABASE_URL?.replace(/:\/\/[^@]*@/, "://***@")}`,
  );
}

async function user(email, name, extra = {}) {
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash: PW_HASH, ...extra },
    create: { email, displayName: name, passwordHash: PW_HASH, status: "ACTIVE", ...extra },
  });
}

async function exchange({ label, title, ownerCoupon, claimantOffer }) {
  const owner = await user(`owner-${label}@t.local`, `券主-${label}`);
  const claimant = await user(`claimant-${label}@t.local`, `領取者-${label}`);

  const coupon = await prisma.coupon.create({
    data: {
      ownerId: owner.id,
      title,
      brand: "測試品牌",
      type: "EXCHANGE",
      status: "CLAIMED",
      claimantId: claimant.id,
      claimedAt: new Date(),
      ...ownerCoupon,
    },
  });
  const request = await prisma.claimRequest.create({
    data: {
      couponId: coupon.id,
      requesterId: claimant.id,
      requestType: "EXCHANGE",
      status: "APPROVED",
      message: "測試申請",
    },
  });
  const txn = await prisma.transaction.create({
    data: {
      couponId: coupon.id,
      ownerId: owner.id,
      claimantId: claimant.id,
      claimRequestId: request.id,
      transactionType: "EXCHANGE",
      status: "CREATED",
      ...claimantOffer,
    },
  });

  console.log(`\n[${label}] ${title}`);
  console.log(`  交易頁      /transactions/${txn.id}`);
  console.log(`  券主登入    owner-${label}@t.local : ${PASSWORD}`);
  console.log(`  領取者登入  claimant-${label}@t.local : ${PASSWORD}`);
  return txn;
}

// A：券主的券是兌換碼、領取者給圖片。亮碼後領取者按鈕應顯示「查看對方的兌換碼」。
await exchange({
  label: "A",
  title: "A｜券主兌換碼 × 領取者圖片",
  ownerCoupon: { redeemCodeEncrypted: encryptBarcode(Buffer.from("OWNER-CODE-AAA111", "utf8")) },
  claimantOffer: {
    offerBarcodeEncryptedData: encryptBarcode(FAKE_PNG),
    offerBarcodeMime: "image/png",
  },
});

// B：券主圖片、領取者兌換碼。這一側原本後端根本無法送出，領取者按不了確認交換。
await exchange({
  label: "B",
  title: "B｜券主圖片 × 領取者兌換碼",
  ownerCoupon: { barcodeEncryptedData: encryptBarcode(FAKE_PNG), barcodeMime: "image/png" },
  claimantOffer: {
    offerRedeemCodeEncrypted: encryptBarcode(Buffer.from("CLAIMANT-CODE-BBB222", "utf8")),
  },
});

// C：領取者什麼都還沒提供。用來驗證「確認交換」是 disabled 並顯示提示，
//    以及走 UI 的「改用兌換碼」→ 輸入 → 送出 這條完整路徑。
await exchange({
  label: "C",
  title: "C｜領取者空手（測 disabled 與 UI 輸入流程）",
  ownerCoupon: { barcodeEncryptedData: encryptBarcode(FAKE_PNG), barcodeMime: "image/png" },
  claimantOffer: {},
});

// D：被停權的帳號。申訴畫面（App 的 /appeal）只有 SUSPENDED 狀態進得去，
//    用它驗證 5024f7c 的修復——舊版 App POST 到 /me/appeal 會 405 且畫面無錯誤提示。
const suspended = await user("suspended@t.local", "被停權的測試者", { status: "SUSPENDED" });
console.log(`\n[D] 申訴路徑`);
console.log(`  登入        suspended@t.local : ${PASSWORD}`);
console.log(`  App 進 /appeal 應看得到申訴表單；送出後應變成「審核中」而不是靜靜地什麼都沒發生`);
console.log(`  user id     ${suspended.id}`);

console.log(`\n模擬器自動登入用法：EXPO_PUBLIC_DEV_AUTOLOGIN="claimant-C@t.local:${PASSWORD}" npx expo run:android`);

await prisma.$disconnect();
