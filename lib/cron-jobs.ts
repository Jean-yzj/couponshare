import { prisma } from "./db";
import { notify } from "./notify";
import { writeAudit } from "./audit";

// Core cron logic, callable both from the HTTP cron routes (external trigger)
// and the in-process scheduler (lib/scheduler.ts). No req/auth here — the caller
// is responsible for authorization. Each query is capped so a backlog can't load
// unbounded rows.
const DAY = 86_400_000;
const STALE_DAYS = 7;

// Date-expire coupons, then auto-delist ones with zero applications after 7 days.
export async function runExpireCoupons() {
  const now = new Date();

  const expiring = await prisma.coupon.findMany({
    where: { status: { in: ["AVAILABLE", "PENDING"] }, expiryDate: { lt: now } },
    select: { id: true, ownerId: true, title: true, status: true },
    take: 500,
  });
  for (const c of expiring) {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id: c.id }, data: { status: "EXPIRED" } });
      await tx.claimRequest.updateMany({
        where: { couponId: c.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await notify(tx, {
        userId: c.ownerId,
        type: "COUPON_EXPIRED",
        title: "票券已過期",
        body: `「${c.title}」已過期並自動下架`,
        referenceType: "coupon",
        referenceId: c.id,
      });
      await writeAudit(tx, {
        action: "coupon.expire",
        targetType: "coupon",
        targetId: c.id,
        before: { status: c.status },
        after: { status: "EXPIRED" },
      });
    });
  }

  // No-interest auto-delist: AVAILABLE, listed 7+ days, still zero applications.
  const staleBefore = new Date(now.getTime() - STALE_DAYS * DAY);
  const stale = await prisma.coupon.findMany({
    where: { status: "AVAILABLE", claimRequestCount: 0, createdAt: { lt: staleBefore } },
    select: { id: true, ownerId: true, title: true },
    take: 500,
  });
  for (const c of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id: c.id }, data: { status: "EXPIRED" } });
      await notify(tx, {
        userId: c.ownerId,
        type: "COUPON_EXPIRED",
        title: "票券已自動下架",
        body: `「${c.title}」上架 7 天都沒有人申請，已自動下架，避免占用版面。若仍然有效，歡迎重新上傳一張。`,
        referenceType: "coupon",
        referenceId: c.id,
      });
      await writeAudit(tx, {
        action: "coupon.auto_delist_stale",
        targetType: "coupon",
        targetId: c.id,
        before: { status: "AVAILABLE" },
        after: { status: "EXPIRED" },
      });
    });
  }

  return { expired: expiring.length, delisted_stale: stale.length };
}

// Warn owners of coupons expiring within 24h (de-duped to once per 20h).
export async function runExpiringSoon() {
  const now = new Date();
  const in24h = new Date(now.getTime() + DAY);
  const soon = await prisma.coupon.findMany({
    where: { status: "AVAILABLE", expiryDate: { gt: now, lte: in24h } },
    select: { id: true, ownerId: true, title: true },
    take: 500,
  });

  let notified = 0;
  for (const c of soon) {
    const recent = await prisma.notification.findFirst({
      where: {
        userId: c.ownerId,
        type: "COUPON_EXPIRING_SOON",
        referenceId: c.id,
        createdAt: { gt: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
      },
    });
    if (recent) continue;
    await notify(prisma, {
      userId: c.ownerId,
      type: "COUPON_EXPIRING_SOON",
      title: "票券即將過期",
      body: `「${c.title}」將在 24 小時內過期，把握最後機會送出吧`,
      referenceType: "coupon",
      referenceId: c.id,
    });
    notified++;
  }
  return { candidates: soon.length, notified };
}

// Revert PENDING coupons idle > 24h back to AVAILABLE for others to apply.
export async function runPendingTimeout() {
  const cutoff = new Date(Date.now() - DAY);
  const stale = await prisma.coupon.findMany({
    where: { status: "PENDING", updatedAt: { lt: cutoff } },
    select: { id: true, ownerId: true, title: true },
    take: 500,
  });

  for (const c of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id: c.id }, data: { status: "AVAILABLE" } });
      await tx.claimRequest.updateMany({
        where: { couponId: c.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await notify(tx, {
        userId: c.ownerId,
        type: "COUPON_EXPIRING_SOON",
        title: "票券已重新開放申請",
        body: `「${c.title}」的保留時間已到，重新開放給其他人申請`,
        referenceType: "coupon",
        referenceId: c.id,
      });
      await writeAudit(tx, {
        action: "coupon.pending_timeout",
        targetType: "coupon",
        targetId: c.id,
        before: { status: "PENDING" },
        after: { status: "AVAILABLE" },
      });
    });
  }
  return { reverted: stale.length };
}

// ── 個資保存期限：清除已刪除帳號的可識別欄位 ────────────────────────────────
// 隱私權政策 5.4：帳號刪除滿六個月後，清除稽核日誌中足資識別特定個人之欄位
// （email / IP / User-Agent），僅保留無從識別個人的操作紀錄。
//
// 政策 5.5 的例外由 hasOpenMatter() 實作：帳號涉及未結爭議、檢舉、申訴或
// 司法程序者不清除。少了這道閘門，2026-08 那件交換爭議的證據會在偵查中被抹掉。
const RETENTION_DAYS = 180;

// 法律保全：對特定帳號寫入這個 action 即可無限期擋下清除，寫入 release 則解除。
// 刻意用稽核事件而非新增 User 欄位——schema 漂移在這個專案癱瘓過線上登入一次。
export const LEGAL_HOLD = "user.legal_hold";
export const LEGAL_HOLD_RELEASE = "user.legal_hold_release";

async function hasOpenMatter(userId: string): Promise<boolean> {
  const [disputed, reported, appealed, holds, releases] = await Promise.all([
    prisma.transaction.count({
      where: { OR: [{ ownerId: userId }, { claimantId: userId }], status: "DISPUTED" },
    }),
    prisma.report.count({
      where: {
        OR: [{ reportedUserId: userId }, { reporterId: userId }],
        status: { in: ["PENDING", "REVIEWING"] },
      },
    }),
    prisma.appeal.count({ where: { userId, status: "PENDING" } }),
    prisma.auditLog.count({ where: { targetId: userId, action: LEGAL_HOLD } }),
    prisma.auditLog.count({ where: { targetId: userId, action: LEGAL_HOLD_RELEASE } }),
  ]);
  return disputed > 0 || reported > 0 || appealed > 0 || holds > releases;
}

// Strip identifying fields from one JSON blob without discarding the rest of the
// event (the action + timestamp stay, so the audit trail's integrity is intact).
function scrubJson(v: unknown): unknown {
  if (!v || typeof v !== "object") return v;
  const o = { ...(v as Record<string, unknown>) };
  for (const k of ["email", "ip", "ipAddress", "userAgent", "ua", "phone"]) {
    if (k in o) o[k] = null;
  }
  return o;
}

export async function runPurgeDeletedUsers() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY);

  // Deletion time comes from the audit event, not the user row — user.updatedAt
  // moves whenever anything else touches the row and would reset the clock.
  const deletions = await prisma.auditLog.findMany({
    where: { action: "user.delete", createdAt: { lt: cutoff } },
    select: { targetId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  let purged = 0;
  let held = 0;

  for (const d of deletions) {
    const userId = d.targetId;

    // A previous run leaves its own marker, so re-scanning the same account is a
    // single count instead of re-reading and re-writing every one of its events.
    const alreadyPurged = await prisma.auditLog.count({
      where: { targetId: userId, action: "user.pii_purged" },
    });
    if (alreadyPurged > 0) continue;

    if (await hasOpenMatter(userId)) {
      held += 1;
      continue;
    }

    const logs = await prisma.auditLog.findMany({
      where: { OR: [{ actorId: userId }, { targetId: userId }] },
      select: { id: true, beforeValue: true, afterValue: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const l of logs) {
        await tx.auditLog.update({
          where: { id: l.id },
          data: {
            ipAddress: null,
            userAgent: null,
            beforeValue: scrubJson(l.beforeValue) as never,
            afterValue: scrubJson(l.afterValue) as never,
          },
        });
      }
      await writeAudit(tx, {
        action: "user.pii_purged",
        targetType: "user",
        targetId: userId,
        after: { retention_days: RETENTION_DAYS, scrubbed_events: logs.length },
      });
    });
    purged += 1;
  }

  return { scanned: deletions.length, purged, held_open_matter: held };
}

// ── 條碼去重：清掉已確實存在 R2 的資料庫副本 ──────────────────────────────
// 上傳流程刻意先寫資料庫再傳 R2（R2 故障不該讓上架失敗），但成功後從不清除
// 資料庫那份，於是每張券都存兩份。2026-08 一次性清掉 4740 筆後又在兩天內累積
// 573 筆，可見一次性清理沒有用——重複會一直長回來，備份也跟著變肥。
//
// 這裡不動上傳路徑，改成事後掃描：只有「R2 物件確實存在、且內容雜湊與資料庫
// 這份相符」才清除，並保留 24 小時緩衝，讓剛上傳的券仍有本地備援可退。
const BARCODE_GRACE_HOURS = 24;

export async function runDedupeBarcodes() {
  const { getR2ClientAndBucket } = await import("./barcode-storage");
  const r2 = getR2ClientAndBucket();
  if (!r2) return { scanned: 0, cleared: 0, skipped: 0, reason: "r2_not_configured" };
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

  const cutoff = new Date(Date.now() - BARCODE_GRACE_HOURS * 3600_000);

  // The hash comparison runs in Postgres so the barcode blobs (up to ~6.7MB each)
  // never travel to this process just to be checked.
  const rows = await prisma.$queryRaw<{ id: string; key: string }[]>`
    select id, barcode_storage_key as key
    from coupons
    where barcode_storage_key is not null
      and barcode_encrypted_data is not null
      and updated_at < ${cutoff}
      and encode(sha256(decode(barcode_encrypted_data, 'base64')), 'hex')
          = split_part(split_part(barcode_storage_key, '/', 4), '.', 1)
    limit 100
  `;

  let cleared = 0;
  let skipped = 0;

  for (const row of rows) {
    // The read path refuses an object without this checksum metadata, so an object
    // missing it is not a usable replacement for the database copy.
    try {
      const head = await r2.client.send(
        new HeadObjectCommand({ Bucket: r2.bucket, Key: row.key }),
      );
      if (!head.Metadata?.sha256) {
        skipped += 1;
        continue;
      }
    } catch {
      skipped += 1;
      continue;
    }

    // Guarded on the key still matching: if the owner replaced the barcode in the
    // meantime the upload handler resets the key, and this row no longer applies.
    const res = await prisma.coupon.updateMany({
      where: { id: row.id, barcodeStorageKey: row.key },
      data: { barcodeEncryptedData: null },
    });
    cleared += res.count;
  }

  return { scanned: rows.length, cleared, skipped };
}
