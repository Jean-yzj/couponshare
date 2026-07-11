# Database migrations

The project historically used `prisma db push` (no history, no rollback, no drift
detection). It now carries a proper Prisma **migration history** under
`prisma/migrations/`, starting from a baseline that reflects the current schema.

## One-time: baseline the existing production database

The `0_init` migration describes the schema that **already exists** in production.
Applying it with `migrate deploy` would try to `CREATE TABLE` tables that are
already there and fail. So the existing DB must be *baselined* (marked as already
having `0_init` applied) exactly once:

```bash
# Point DATABASE_URL at the existing production DB, then:
npx prisma migrate resolve --applied 0_init
```

A brand-new/empty database needs no baselining — `migrate deploy` applies `0_init`
normally.

## Going forward

- **Author a change** (dev): edit `prisma/schema.prisma`, then
  `npm run db:migrate` (`prisma migrate dev`) to generate a new timestamped
  migration and apply it locally.
- **Deploy** (CI / production): `npm run db:migrate:deploy`
  (`prisma migrate deploy`) applies any pending migrations. Consider adding this
  to your deploy step so schema changes ship with the code that needs them
  (replacing the ad-hoc `npm run db:push` note in CLAUDE.md).
- Stop using `prisma db push` against production — it bypasses history and can
  silently drop columns/data.

## Why

`migrate` gives a reviewable SQL diff per change, an ordered history, rollback
points, and drift detection (`prisma migrate status`) — none of which `db push`
provides.
