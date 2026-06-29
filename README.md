# CouponShare

> 把用不到的優惠券，送給需要的人。

A gift / exchange platform for idle coupons and tickets, built around an
invite-and-approve model with a contribution-score community loop. Implements
the CouponShare PRD v1.1 MVP.

## What it does

- **Share** unused coupons (barcode / QR image), as a free gift or an exchange.
- **Browse & apply** — leave a message to apply; the holder picks who receives it.
- **Secure barcodes** — the barcode is never exposed in the feed and is only
  revealed to the chosen claimant through a short-lived, authorised link.
- **Contribution score & levels** drive fairer distribution and curb abuse.
- Ratings, reports, notifications, daily rate limits, audit log, and background
  expiry jobs.

## Stack

- **Next.js 16** (App Router) — UI + API routes in one deployable
- **PostgreSQL + Prisma 6**
- **Tailwind CSS v4** — warm beige design system
- Sessions via signed cookies, passwords via scrypt, barcodes via AES-256-GCM
  (all `node:crypto`, no extra deps)

## Core model & guarantees

The four state-consistent models are `Coupon → ClaimRequest → Transaction →
ScoreLedger`. Approving an applicant runs inside a single DB transaction with a
row-level lock on the coupon (re-checks status under lock, claims it, rejects the
rest, creates the transaction, scores the giver, notifies, audits) — so a hot
coupon can never be double-claimed and a score event can never double-count
(idempotent ledger).

Barcode safety: the feed serializer never emits barcode fields; the detail API
exposes only `has_barcode` / `can_view_barcode`; the image is served from
`/api/v1/coupons/:id/barcode/image` only with a valid 5-minute signed token AND a
re-validated owner/claimant check, with `Cache-Control: no-store`.

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL + secrets
npx prisma db push          # create schema
npx prisma db seed          # demo users + coupons
npm run dev
```

Demo accounts (password `demo1234`, or one-click on the login page):
`jean@demo.couponshare.app`, `amy@demo.couponshare.app`, … (6 personas).

## Environment variables

See [.env.example](.env.example). `BARCODE_KEY` must be identical wherever
barcodes are encrypted (seeding) and decrypted (the running app).

## Background jobs (cron)

Point a scheduler at these (send `x-cron-secret: $CRON_SECRET`):

- `POST /api/v1/cron/expire-coupons` — every ~10 min
- `POST /api/v1/cron/expiring-soon` — hourly
- `POST /api/v1/cron/pending-timeout` — hourly
