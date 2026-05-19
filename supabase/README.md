# Supabase Setup

This folder contains Saver's Supabase setup notes, public browser config, and database schema.

## Current Auth Wiring

- Browser config: `supabase/config.js`
- Client bootstrap: `scripts/supabase-client.js`
- Login/register/reset actions: `scripts/auth.js`
- Protected page guards: `scripts/onboarding.js`, `scripts/dashboard.js`
- Database schema: `supabase/schema.sql`

Until `supabase/config.js` has real values, login/register show a configuration message and protected pages stay previewable for local UI work. Once the URL and anon/public key are set, Supabase session checks become active.

## Required Dashboard Setup

1. Create or open the Supabase project.
2. Copy the Project URL and anon/public key from Project Settings > API.
3. Paste those values into `supabase/config.js`.
4. In Authentication > URL Configuration, set Site URL to:
   - `https://savers.dev`
5. Add these local redirect URLs:
   - `http://localhost:5173/pages/login.html`
   - `http://localhost:5173/pages/onboarding.html`
   - `http://localhost:5173/pages/reset-password.html`
6. Add these production redirect URLs:
   - `https://savers.dev/login`
   - `https://savers.dev/onboarding`
   - `https://savers.dev/reset-password`
7. In Authentication > Providers:
   - Enable Email.
   - Enable Google.
   - Add the Google OAuth client ID and client secret.

For Google Cloud OAuth, keep these authorized JavaScript origins:

- `http://localhost:5173`
- `https://savers.dev`

The authorized redirect URI remains the Supabase callback URL shown in the Supabase Google provider panel.

## Required Database Setup

Run `supabase/schema.sql` in Supabase SQL Editor. It creates:

- `profiles` for display name and onboarding state.
- `budget_cycles` for the active money setup per user.
- `transactions` for expense and income rows.
- `savings_goals` for goal tracking.
- RLS policies, indexes, updated-at triggers, and the auth trigger that gives every Supabase Auth user a matching profile row.

Saver uses `profiles.onboarding_completed` as the dashboard gate. Browser local storage is only a per-user cache, so one account cannot inherit another account's onboarding state on the same device.

The app data tables intentionally grant Data API access to `authenticated` and `service_role` only. They do not grant table access to `anon`, because financial rows should never be readable before login. Keep this explicit grant pattern for every new `public` table:

```sql
grant select, insert, update, delete on table public.your_table to authenticated;
grant select, insert, update, delete on table public.your_table to service_role;
alter table public.your_table enable row level security;
```

Onboarding and the dashboard now use these tables through `scripts/supabase-client.js`. Local storage remains a per-user cache/fallback, but Supabase is the source of truth for active setup rows and transaction history after login. When an older browser has valid user-scoped local transactions without `remoteId`, the dashboard syncs those rows into Supabase on the next authenticated load and keeps the local cache aligned with the returned remote IDs.

`transactions.client_txn_id` is the idempotency key for dashboard writes. It lets the browser retry a failed add-expense request without creating duplicate rows. If these tables already exist, rerun `supabase/schema.sql` in the SQL Editor to apply the `client_txn_id` column and unique index. The frontend keeps a legacy fallback for older schemas, but database-level duplicate protection starts only after that SQL is applied.

If users completed onboarding before `budget_cycles` and `savings_goals` existed, they do not need to create a fresh account. The dashboard repairs missing active setup rows from `profiles.onboarding_data` on the next login. For a manual bulk repair, run `supabase/backfill-existing-users.sql`; it is idempotent and only inserts rows where a completed profile has no active budget cycle or saving goal.

## Email Delivery Notes

Production auth email is configured through custom SMTP on the `savers.dev` domain. Keep the SMTP sender aligned with the verified domain, for example:

- Sender email: `no-reply@savers.dev`
- Sender name: `Saver`

New domains can still see occasional spam placement while reputation warms up. Keep SPF, DKIM, and DMARC verified in the email provider dashboard and avoid repeatedly testing with the same inbox in a short time window.

Forgot-password emails use `/reset-password` as their redirect target. Signup confirmation emails use `/login` as their redirect target. After a user confirms email, Saver signs out the temporary confirmation session and asks the user to log in manually before onboarding.

For local testing, if an email/password user was created but no confirmation email arrives:

- Check Inbox, Spam, and Promotions.
- Manually confirm the test user in the Supabase dashboard.
- Temporarily disable email confirmation while testing only the UI.
- Verify custom SMTP before testing real users.

## Verification Page Policy

Saver should not own a fake OTP screen. Supabase Auth already handles email confirmation links, OAuth redirects, session persistence, and token parsing. If the product later needs a status screen, use a small "check your email" or callback status page instead of manual verification logic.
