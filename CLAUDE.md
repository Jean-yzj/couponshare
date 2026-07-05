@AGENTS.md

## Recent Codex changes: admin analytics attribution

- Admin dashboard now supports selectable signup windows via `/api/v1/admin/stats?signup_hours=3|6|12|24|48`.
- Registration heatmap is scoped to the selected signup window and displayed in Taiwan time.
- Users now have optional `birth_year` plus UTM attribution fields on `User`: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, and `landing_path`.
- Email registration accepts optional `birth_year` and `utm`; Google OAuth stores UTM in a short-lived `cs_utm` cookie and writes it only when creating a new Google user.
- `components/UtmCapture.tsx` captures UTM params from any landing page into `sessionStorage` so registration can attribute later signups.
- Admin UTM reporting treats `utm_content` as the post id first, falling back to `utm_campaign`.
- After pulling these changes into an environment, run `npm run db:push` or an equivalent Prisma migration before using the new admin stats, because the `users` table needs the new columns.
