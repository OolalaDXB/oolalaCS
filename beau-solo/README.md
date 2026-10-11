# BEAU Solo

The back office of a solo professional: diary, bookable appointment types,
places, client enquiries and contacts. Extracted from Coach Gari's back office;
Oolala is its first host. It will move to `OolalaDXB/BEAUX` as `packages/solo`
once it has run in production here.

## What is installed where

| Piece | Where |
|---|---|
| Schema `beau_solo` (tables) + API functions `public.solo_*` | `sql/0001_p1_core.sql`, applied to Supabase project `ejulkzxohloxfvpbnyyw` |
| Oolala starting data (types, office, hours) | `hosts/oolala/seed.sql` |
| Public Edge Function `solo-public` | `functions/solo-public/index.ts` |
| Notification sender `solo-outbox` (Resend, pg_cron every minute) | `functions/solo-outbox/index.ts`, `sql/0002_outbox_sender.sql` |
| Booking page and contact form | `src/routes/{-$lang}.rendez-vous.tsx`, `src/components/oolala/contact-form.tsx` |
| Back office | `src/routes/admin.tsx`, `src/components/solo-admin/` (mobile first: today, diary, days off, hours, blocks, enquiries, clients, places, appointment types) |

The version ledger is `beau_solo.schema_versions`, separate from the host's.

## Access model

- Nothing in `beau_solo` is reachable through the API: `anon` and
  `authenticated` hold no privilege on the schema, and row level security is
  on with no policy as a second wall.
- `public.solo_public_*` — service role only, called by the `solo-public`
  Edge Function (rate limits by email and hashed IP).
- `public.solo_admin_*` — signed-in users; each function checks the caller's
  email against `beau_solo.staff` and its permission:
  `solo:agenda` (hours, bookings), `solo:crm` (enquiries, contacts, notes),
  `solo:settings` (types, places), `solo:admin` (all).
- A signed-in account that is not staff reads nothing (tested).

Granting access:

1. Supabase → Authentication → URL configuration: add the site's `/admin` URL
   (Lovable preview and production domain) to the redirect URLs, so the magic
   link comes back to the back office.
2. Create the person's account, confirmed and without an invitation email (an
   invitation would redirect to the host's Site URL): Supabase → Authentication
   → Users → *Add user* → *Create new user*, any password, *Auto Confirm User*.
   Sign-in uses `shouldCreateUser: false`: nobody else can create an account.
   Done on 2026-10-12 for darya@oolala.ae and mickael@oolala.ae.
3. SQL editor:

```sql
insert into beau_solo.staff (email, name, permissions) values ('<email>', 'Darya', array['solo:admin']);
update beau_solo.settings set notify_email = '<email>' where id;
```

## Rules for the SQL files

- Idempotent: every file can run twice.
- No `DROP`, no `DELETE`, no `UPDATE` without a `WHERE`, no percent sign: the
  Supabase MCP SQL tools stall on them (they wait for a confirmation that never
  arrives). Hours are switched off (`active`) and blocks are marked
  (`deleted_at`) instead of being deleted.

## Tests

```bash
# throwaway local Postgres 16
psql -v ON_ERROR_STOP=1 -f sql/tests/supabase_stub.sql -f sql/0001_p1_core.sql -f sql/tests/p1_contract.sql
# → SOLO_P1 ok=47, then sql/0002_outbox_sender.sql + sql/tests/p2_outbox.sql → SOLO_P2 ok=9
node --experimental-strip-types functions/tests/solo-public.test.mjs   # SOLO_PUBLIC ok=12
node --experimental-strip-types functions/tests/solo-outbox.test.mjs   # SOLO_OUTBOX ok=10
```

The suite runs in one transaction and rolls back. It covers availability,
buffers, blocks, open windows, double booking, the manage link, CRM matching,
staff bookings at a partner's address and every access boundary.

## Emails

Bookings, cancellations and enquiries queue messages in `beau_solo.outbox`.
`solo-outbox` sends them through Resend from `darya@oolala.ae` (Resend domain
oolala.ae, verified), clients in their language, staff in French, and reports
each result back (5 attempts, a 10-minute claim so a message never goes twice).
It does nothing until the secret `RESEND_API_KEY` is set (Supabase → Edge
Functions → Secrets). Optional: `SOLO_MAIL_FROM`, `SOLO_REPLY_TO`, `SOLO_SITE_URL`.

Back-office sign-in links are sent by Supabase Auth itself: they need the same
Resend key as custom SMTP (Authentication → Emails → SMTP: smtp.resend.com,
port 465, user `resend`).

## Not in P1

Payments and invoices (BEAU PH, FactureX), calendar sync, reminders,
presence periods per city (Dubai / Vannes).
