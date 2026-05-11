# Supabase Setup

This folder is for Saver's Supabase project setup, public browser config, and future database migrations.

## Current Auth Wiring

- Browser config: `supabase/config.js`
- Client bootstrap: `scripts/supabase-client.js`
- Login/register actions: `scripts/auth.js`
- Protected page session checks: `scripts/onboarding.js`, `scripts/dashboard.js`

Until `supabase/config.js` has real values, login/register show a configuration message and protected pages remain previewable for local UI work. Once the URL and anon/public key are set, Supabase session checks become active.

## Required Dashboard Setup

1. Create or open your Supabase project.
2. Copy the Project URL and anon/public key from Project Settings > API.
3. Paste those values into `supabase/config.js`.
4. In Authentication > URL Configuration, set the local redirect URLs:
   - `http://localhost:5173/pages/onboarding.html`
   - `http://localhost:5173/pages/login.html`
5. Add the deployed redirect URLs after deployment:
   - `https://YOUR_DOMAIN/pages/onboarding.html`
   - `https://YOUR_DOMAIN/pages/login.html`
6. In Authentication > Providers:
   - Enable Email.
   - Enable Google.
   - Add the Google OAuth client ID and client secret in the Supabase dashboard.

## Email Delivery Notes

Supabase's built-in auth email service is only for demos and early testing. It has strict hourly limits and can fail to deliver to addresses outside the project team. For production, configure a custom SMTP provider under Authentication > Email.

For local testing, if an email/password user was created but no confirmation email arrives, you can either:

- Check Inbox, Spam, and Promotions for the confirmation email.
- Manually confirm the test user in the Supabase dashboard.
- Temporarily disable email confirmation while testing the UI flow.
- Configure custom SMTP before testing with real users.

## Why `verify.html` Was Removed

Saver should not own a fake OTP screen. Supabase Auth already handles email confirmation links, OAuth redirects, session persistence, and token parsing. If the product later needs a status screen, use a small "check your email" or callback status page instead of manual verification logic.
