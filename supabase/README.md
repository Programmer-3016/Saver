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

## Why `verify.html` Was Removed

Saver should not own a fake OTP screen. Supabase Auth already handles email confirmation links, OAuth redirects, session persistence, and token parsing. If the product later needs a status screen, use a small "check your email" or callback status page instead of manual verification logic.
