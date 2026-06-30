import { randomUUID } from "node:crypto";
import {
  PrismaClient,
  type CouponCategory,
  type CouponStatus,
  type CouponType,
  type VisibilityLevel,
} from "@prisma/client";
import { encryptBarcode, hashPassword } from "../lib/crypto";

const prisma = new PrismaClient();

function barcodeSvg(code: string): Buffer {
  const rects: string[] = [];
  let x = 16;
  for (let i = 0; i < 52; i++) {
    const w = ((i * 7 + code.length * 5) % 4) + 1;
    if (i % 2 === 0) rects.push(`<rect x="${x}" y="18" width="${w * 3}" height="118" fill="#1b1b1b"/>`);
    x += w * 3 + 3;
  }
  const W = x + 16;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="170" viewBox="0 0 ${W} 170">` +
    `<rect width="100%" height="100%" rx="8" fill="#ffffff"/>${rects.join("")}` +
    `<text x="${W / 2}" y="158" font-family="ui-monospace,monospace" font-size="15" letter-spacing="3" text-anchor="middle" fill="#1b1b1b">${code}</text></svg>`;
  return Buffer.from(svg, "utf8");
}

function barcodeFields() {
  const code = `CS-${randomUUID().slice(0, 8).toUpperCase()}`;
  return { barcodeEncryptedData: encryptBarcode(barcodeSvg(code)), barcodeMime: "image/svg+xml" };
}

function catFor(brand: string): CouponCategory {
  const b = brand.toLowerCase();
  if (/7-eleven|全家|familymart|萊爾富|ok超商/.test(b)) return "CONVENIENCE";
  if (/starbucks|louisa|路易莎|cama|咖啡/.test(b)) return "COFFEE";
  if (/清心|50嵐|可不可|迷客夏|手搖|comebuy/.test(b)) return "DRINK";
  if (/mcdonald|麥當勞|mos|摩斯|kfc|肯德基|subway|漢堡/.test(b)) return "FASTFOOD";
  if (/再睡5分鐘|義美|甜|蛋糕|冰/.test(b)) return "DESSERT";
  if (/鼎泰豐|鬍鬚張|餐廳/.test(b)) return "RESTAURANT";
  if (/uniqlo|誠品|book|蝦皮|momo/.test(b)) return "SHOPPING";
  return "OTHER";
}

const hour = 3_600_000;
const day = 24 * hour;
const ago = (d: number) => new Date(Date.now() - d * day);
const inHours = (h: number) => new Date(Date.now() + h * hour);
const inDays = (d: number) => new Date(Date.now() + d * day);

async function main() {
  console.log("Clearing existing data…");
  await prisma.rating.deleteMany();
  await prisma.transactionMessage.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.claimRequest.deleteMany();
  await prisma.report.deleteMany();
  await prisma.scoreLedger.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.brandFollow.deleteMany();
  await prisma.appeal.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.user.deleteMany();

  const password = hashPassword("demo1234");
  const personas = [
    { key: "nina", name: "Nina", score: 152, level: "LEVEL_3" },
    { key: "jean", name: "Jean", score: 128, level: "LEVEL_3" },
    { key: "amy", name: "Amy", score: 58, level: "LEVEL_2" },
    { key: "ken", name: "Ken", score: 33, level: "LEVEL_2" },
    { key: "mia", name: "Mia", score: 14, level: "LEVEL_1" },
    { key: "leo", name: "Leo", score: 6, level: "LEVEL_1" },
    { key: "sam", name: "Sam", score: -10, level: "LEVEL_1" },
  ] as const;

  const u: Record<string, string> = {};
  for (const p of personas) {
    const user = await prisma.user.create({
      data: {
        displayName: p.name,
        email: `${p.key}@demo.couponshare.app`,
        passwordHash: password,
        loginProvider: "EMAIL",
        contributionScore: p.score,
        userLevel: p.level,
        lastLoginAt: ago(0),
        createdAt: ago(30),
      },
    });
    u[p.key] = user.id;
  }
  console.log(`Created ${personas.length} demo users (password: demo1234)`);

  type C = {
    owner: string;
    title: string;
    brand: string;
    type: CouponType;
    exchangeTarget?: string;
    status?: CouponStatus;
    expiry: Date;
    visibility?: VisibilityLevel;
    createdDaysAgo: number;
    description?: string;
  };

  const coupons: C[] = [
    { owner: "jean", title: "星巴克 大杯飲料買一送一", brand: "Starbucks", type: "GIFT", expiry: inDays(5), createdDaysAgo: 0.2, description: "限本週使用，需內用或外帶皆可。" },
    { owner: "jean", title: "全家 中杯經典美式", brand: "全家 FamilyMart", type: "GIFT", expiry: inHours(20), createdDaysAgo: 0.5, description: "今天沒空去領，送給需要咖啡的你！" },
    { owner: "amy", title: "麥當勞 經典大薯（免費）", brand: "McDonald's", type: "GIFT", expiry: inDays(3), createdDaysAgo: 0.8 },
    { owner: "amy", title: "路易莎 指定飲品 88 折", brand: "Louisa Coffee", type: "EXCHANGE", exchangeTarget: "想換一張手搖飲折價券", expiry: inDays(6), createdDaysAgo: 1.2 },
    { owner: "ken", title: "7-ELEVEN City Cafe 大杯拿鐵", brand: "7-ELEVEN", type: "GIFT", expiry: inDays(2), createdDaysAgo: 1.6 },
    { owner: "nina", title: "鼎泰豐 9 折抵用券", brand: "鼎泰豐", type: "GIFT", expiry: inDays(10), visibility: "LEVEL_2_ONLY", createdDaysAgo: 2, description: "達人以上限定，希望給常分享的夥伴。" },
    { owner: "nina", title: "誠品書店 95 折購書券", brand: "誠品", type: "GIFT", expiry: inDays(14), createdDaysAgo: 2.4 },
    { owner: "mia", title: "摩斯漢堡 雞塊買一送一", brand: "MOS Burger", type: "GIFT", expiry: inHours(22), createdDaysAgo: 0.3 },
    { owner: "ken", title: "Uniqlo 100 元折價券", brand: "Uniqlo", type: "EXCHANGE", exchangeTarget: "想換餐飲類折價券", expiry: inDays(8), createdDaysAgo: 3 },
    { owner: "leo", title: "再睡 5 分鐘 鬆餅第二份半價", brand: "再睡5分鐘", type: "GIFT", expiry: inDays(4), createdDaysAgo: 1 },
    { owner: "nina", title: "星巴克 莓果優格星冰樂", brand: "Starbucks", type: "GIFT", expiry: inDays(30), visibility: "LEVEL_3_ONLY", createdDaysAgo: 0.6, description: "傳奇限定，感謝一路上互相幫忙的大家。" },
    { owner: "jean", title: "義美 紅豆牛奶冰（已過期）", brand: "義美", type: "GIFT", status: "EXPIRED", expiry: ago(2), createdDaysAgo: 9 },
    { owner: "jean", title: "肯德基 蛋撻 2 入（已下架）", brand: "KFC", type: "GIFT", status: "CANCELLED", expiry: inDays(5), createdDaysAgo: 6 },
  ];

  const couponIds: Record<string, string> = {};
  for (let i = 0; i < coupons.length; i++) {
    const c = coupons[i];
    const created = await prisma.coupon.create({
      data: {
        ownerId: u[c.owner],
        title: c.title,
        brand: c.brand,
        category: catFor(c.brand),
        description: c.description ?? null,
        type: c.type,
        exchangeTarget: c.exchangeTarget ?? null,
        status: c.status ?? "AVAILABLE",
        expiryDate: c.expiry,
        visibilityLevel: c.visibility ?? "PUBLIC",
        createdAt: ago(c.createdDaysAgo),
        cancelledAt: c.status === "CANCELLED" ? ago(1) : null,
        ...barcodeFields(),
      },
    });
    couponIds[`${c.owner}-${i}`] = created.id;
  }
  console.log(`Created ${coupons.length} coupons`);

  // Pending applicants on a few popular coupons
  async function applicant(couponId: string, requester: string, message: string) {
    await prisma.claimRequest.create({
      data: { couponId, requesterId: u[requester], requestType: "GIFT", message, status: "PENDING" },
    });
  }
  const starbucks = couponIds["jean-0"];
  await applicant(starbucks, "amy", "您好～我今天剛好會經過星巴克，會很珍惜這杯，謝謝你！");
  await applicant(starbucks, "mia", "好想喝星巴克但最近有點省，可以分我嗎？感激不盡 🙏");
  await applicant(starbucks, "leo", "我會把握使用，謝謝分享！");
  await prisma.coupon.update({ where: { id: starbucks }, data: { claimRequestCount: 3, viewCount: 42 } });

  const fries = couponIds["amy-2"];
  await applicant(fries, "ken", "想跟朋友分享這份大薯，謝謝你！");
  await applicant(fries, "leo", "剛好晚餐想吃麥當勞，謝謝～");
  await prisma.coupon.update({ where: { id: fries }, data: { claimRequestCount: 2, viewCount: 28 } });

  // A completed gift: Amy → Mia, with rating
  const completedCoupon = await prisma.coupon.create({
    data: {
      ownerId: u["amy"],
      title: "清心福全 大杯飲品兌換券",
      brand: "清心福全",
      category: "DRINK",
      type: "GIFT",
      status: "CLAIMED",
      expiryDate: inDays(5),
      claimantId: u["mia"],
      claimedAt: ago(1),
      createdAt: ago(4),
      claimRequestCount: 2,
      viewCount: 51,
      ...barcodeFields(),
    },
  });
  const approvedReq = await prisma.claimRequest.create({
    data: {
      couponId: completedCoupon.id,
      requesterId: u["mia"],
      requestType: "GIFT",
      message: "謝謝 Amy！我會好好享用這杯～",
      status: "APPROVED",
      approvedAt: ago(1),
    },
  });
  const txn = await prisma.transaction.create({
    data: {
      couponId: completedCoupon.id,
      ownerId: u["amy"],
      claimantId: u["mia"],
      claimRequestId: approvedReq.id,
      transactionType: "GIFT",
      status: "COMPLETED",
      completedAt: ago(0.5),
      createdAt: ago(1),
    },
  });
  await prisma.rating.create({
    data: {
      transactionId: txn.id,
      fromUserId: u["mia"],
      toUserId: u["amy"],
      ratingScore: 5,
      tags: ["回覆速度快", "人很好", "票券有效"],
      comment: "超快就回覆，票券完全沒問題，謝謝 Amy！",
    },
  });

  // An in-progress exchange: Ken ⇄ Leo, coordinating via messages
  const exchangeCoupon = await prisma.coupon.create({
    data: {
      ownerId: u["ken"],
      title: "Uniqlo 100 元折價券（交換中）",
      brand: "Uniqlo",
      category: "SHOPPING",
      type: "EXCHANGE",
      exchangeTarget: "想換餐飲類折價券",
      status: "CLAIMED",
      expiryDate: inDays(8),
      claimantId: u["leo"],
      claimedAt: ago(0.3),
      createdAt: ago(2),
      claimRequestCount: 1,
      viewCount: 19,
      ...barcodeFields(),
    },
  });
  const exReq = await prisma.claimRequest.create({
    data: {
      couponId: exchangeCoupon.id,
      requesterId: u["leo"],
      requestType: "EXCHANGE",
      message: "我想用麥當勞大薯券跟你換，可以嗎？",
      exchangeOfferText: "麥當勞 經典大薯兌換券一張",
      status: "APPROVED",
      approvedAt: ago(0.3),
    },
  });
  const exTxn = await prisma.transaction.create({
    data: {
      couponId: exchangeCoupon.id,
      ownerId: u["ken"],
      claimantId: u["leo"],
      claimRequestId: exReq.id,
      transactionType: "EXCHANGE",
      status: "CREATED",
      createdAt: ago(0.3),
    },
  });
  await prisma.transactionMessage.createMany({
    data: [
      {
        transactionId: exTxn.id,
        senderId: u["ken"],
        message: "好啊！我把 Uniqlo 折價碼給你，你把大薯券給我～",
        createdAt: ago(0.25),
      },
      {
        transactionId: exTxn.id,
        senderId: u["leo"],
        message: "沒問題，今晚我截圖傳給你！",
        createdAt: ago(0.2),
      },
    ],
  });

  // Score ledgers (story for the score page)
  const ledger = [
    { user: "jean", type: "COUPON_GIFTED" as const, delta: 10, desc: "成功贈出票券" },
    { user: "jean", type: "COUPON_GIFTED" as const, delta: 10, desc: "成功贈出票券" },
    { user: "jean", type: "POSITIVE_RATING" as const, delta: 3, desc: "收到 4 星以上好評" },
    { user: "jean", type: "THANK_YOU_MESSAGE" as const, delta: 2, desc: "領取後留下感謝訊息" },
    { user: "nina", type: "COUPON_GIFTED" as const, delta: 10, desc: "成功贈出票券" },
    { user: "nina", type: "COUPON_EXCHANGED" as const, delta: 5, desc: "成功交換票券" },
    { user: "nina", type: "POSITIVE_RATING" as const, delta: 3, desc: "收到 4 星以上好評" },
    { user: "amy", type: "COUPON_GIFTED" as const, delta: 10, desc: "成功贈出票券" },
    { user: "amy", type: "POSITIVE_RATING" as const, delta: 3, desc: "收到 4 星以上好評" },
    { user: "ken", type: "COUPON_EXCHANGED" as const, delta: 5, desc: "成功交換票券" },
    { user: "mia", type: "THANK_YOU_MESSAGE" as const, delta: 2, desc: "領取後留下感謝訊息" },
  ];
  for (const l of ledger) {
    await prisma.scoreLedger.create({
      data: {
        userId: u[l.user],
        eventType: l.type,
        scoreDelta: l.delta,
        referenceType: "TRANSACTION",
        referenceId: randomUUID(),
        description: l.desc,
        createdAt: ago(Math.random() * 10 + 1),
      },
    });
  }

  // Notifications
  const notifs = [
    { user: "jean", type: "CLAIM_REQUEST_RECEIVED" as const, title: "有人申請你的票券", body: "Amy 申請了「星巴克 大杯飲料買一送一」", ref: starbucks },
    { user: "jean", type: "CLAIM_REQUEST_RECEIVED" as const, title: "有人申請你的票券", body: "Mia 申請了「星巴克 大杯飲料買一送一」", ref: starbucks },
    { user: "jean", type: "CLAIM_REQUEST_RECEIVED" as const, title: "有人申請你的票券", body: "Leo 申請了「星巴克 大杯飲料買一送一」", ref: starbucks },
    { user: "amy", type: "RATING_RECEIVED" as const, title: "你收到一則新評價", body: "Mia 給了你 5 星評價：「超快就回覆，票券完全沒問題！」", ref: null },
    { user: "mia", type: "CLAIM_APPROVED" as const, title: "你的申請被接受了！", body: "你已成功領取「清心福全 大杯飲品兌換券」，立即查看條碼", ref: completedCoupon.id, read: true },
  ];
  for (const n of notifs) {
    await prisma.notification.create({
      data: {
        userId: u[n.user],
        type: n.type,
        title: n.title,
        body: n.body,
        referenceType: n.ref ? "coupon" : null,
        referenceId: n.ref,
        isRead: n.read ?? false,
      },
    });
  }

  // A suspended account (Sam) reported by 3 people, with a pending appeal
  // — so the admin review loop is demoable.
  for (const reporter of ["amy", "ken", "mia"] as const) {
    await prisma.report.create({
      data: {
        reporterId: u[reporter],
        reportedUserId: u["sam"],
        reason: "INVALID_COUPON",
        description: "上架的券到店無法使用",
        status: "PENDING",
        createdAt: ago(1),
      },
    });
  }
  await prisma.user.update({ where: { id: u["sam"] }, data: { status: "SUSPENDED", riskFlag: true } });
  await prisma.appeal.create({
    data: {
      userId: u["sam"],
      message: "我上架的券都是真的，可能是店員操作或時間點的問題，希望能幫我複查，謝謝。",
      status: "PENDING",
      createdAt: ago(0.5),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
