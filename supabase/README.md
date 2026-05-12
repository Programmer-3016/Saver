# Supabase Setup

This folder contains Saver's Supabase setup notes, public browser config, and database schema.

## Current Auth Wiring

- Browser config: `supabase/config.js`
- Client bootstrap: `scripts/supabase-client.js`
- Login/register/reset actions: `scripts/auth.js`
- Protected page guards: `scripts/onboarding.js`, `scripts/dashboard.js`
- Database profile schema: `supabase/schema.sql`

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

Run `supabase/schema.sql` in Supabase SQL Editor. It creates the `profiles` table, RLS policies, and the auth trigger that gives every Supabase Auth user a matching profile row.

Saver uses `profiles.onboarding_completed` as the dashboard gate. Browser local storage is only a per-user cache, so one account cannot inherit another account's onboarding state on the same device.

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
