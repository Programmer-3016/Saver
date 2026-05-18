# Saver Architecture

## Core Concept

Saver has two surfaces:

1. Public marketing pages that explain the product and drive sign-ups.
2. Authenticated app pages that guide setup and show daily money clarity.

Both surfaces share the same design tokens, typography, and route helper layer.

## User Journey

### New User

1. User lands on `/`.
2. User opens `/register` or continues with Google.
3. Email/password signup sends a Supabase confirmation email.
4. The confirmation link returns the user to `/login`.
5. User logs in and moves to `/onboarding`.
6. User completes setup.
7. User lands on `/dashboard`.

Google OAuth users skip the email confirmation step and go directly to `/onboarding`.

### Returning User

1. User opens `/login`, `/onboarding`, or `/dashboard`.
2. If logged out, protected pages send the user to `/login`.
3. If logged in but onboarding is incomplete, `/dashboard` sends the user to `/onboarding`.
4. If logged in and onboarded, `/onboarding` sends the user to `/dashboard`.

## Route Architecture

Production uses Vercel clean URLs. The source files stay under `pages/` because this is still a static frontend.

| Public route      | Source file                 | Purpose                          |
| ----------------- | --------------------------- | -------------------------------- |
| `/`               | `index.html`                | Landing page                     |
| `/register`       | `pages/register.html`       | Email/password and Google signup |
| `/login`          | `pages/login.html`          | Email/password and Google login  |
| `/reset-password` | `pages/reset-password.html` | Password reset completion        |
| `/privacy`        | `pages/privacy.html`        | Privacy Policy                   |
| `/terms`          | `pages/terms.html`          | Terms of Service                 |

| Protected route | Source file             | Purpose                 |
| --------------- | ----------------------- | ----------------------- |
| `/onboarding`   | `pages/onboarding.html` | Financial setup wizard  |
| `/dashboard`    | `pages/dashboard.html`  | Main dashboard and tabs |

Legacy `/pages/*.html` paths redirect to the clean routes in `vercel.json`.

## Access Rules

| User state                   | Can access                                                          | Redirect behavior                  |
| ---------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| Guest                        | `/`, `/register`, `/login`, `/reset-password`, `/privacy`, `/terms` | Protected pages go to `/login`     |
| Authenticated, not onboarded | `/onboarding`                                                       | `/dashboard` goes to `/onboarding` |
| Authenticated and onboarded  | `/dashboard`                                                        | `/onboarding` goes to `/dashboard` |

## Navigation Rules

### Landing Page

The landing page is the canonical root page. Header and footer links scroll to stable section IDs.

### Auth Pages

Login, register, and reset password share the auth layout, Supabase auth script, password visibility controls, and clean alternate links.

### Dashboard

Dashboard tab switching happens in-place with `dash-panel` and `data-panel` attributes. Desktop and tablet use the top tab bar; phones use the bottom navigation bar.

## Onboarding Flow

The setup wizard has three active steps plus a completion screen:

1. Money mode: fixed income, irregular income, or allowance.
2. Available money and saving amount.
3. Saving goal type and optional goal details.
4. Summary screen that persists the profile and enters the dashboard.

## Implementation Model

### Static Pages

Every route is backed by a static HTML file. Page-specific behavior lives in page-specific scripts:

- `scripts/auth.js` for login, registration, reset password, and OAuth redirects.
- `scripts/onboarding.js` for setup steps and profile persistence.
- `scripts/dashboard.js` for dashboard data, transactions, modal UI, and logout/reset actions.

Shared helpers live in:

- `scripts/shared.js` for DOM helpers, formatting, local cache, and transaction utilities.
- `scripts/supabase-client.js` for Supabase bootstrap, auth guards, and clean route mapping.

### State Model

Supabase is the source of truth for account and onboarding profile state:

- `auth.users` stores authenticated users.
- `public.profiles` stores display name, onboarding data, and `onboarding_completed`.
- `public.budget_cycles` stores the user's active money mode, cycle amounts, free-to-spend amount, and daily limit.
- `public.transactions` stores expense and income history.
- `public.savings_goals` stores goal type, target amount, saved amount, and active state.

Browser storage is a cache/fallback only:

- `saver_onboarding:<user-key>` stores the current user's setup cache.
- `saver_transactions:<user-key>` stores the current user's prototype transaction list.
- `saverUserEmail` and `saverUserName` support UI fallback text.

Point 2 has the Supabase data model in `supabase/schema.sql`. The dashboard still uses the local transaction cache until the next step wires `scripts/onboarding.js`, `scripts/dashboard.js`, and `scripts/supabase-client.js` to these tables.

Every public app data table must keep three database rules together:

- Explicit Data API grants for `authenticated` and `service_role`.
- RLS enabled before client access.
- Owner-only policies using `(select auth.uid()) = user_id`.

## Implemented Flow

```text
Landing -> Register/Login -> Supabase Auth -> Onboarding -> Dashboard
```

Email signup confirmation intentionally lands on `/login` so the user starts a normal login session before onboarding.
