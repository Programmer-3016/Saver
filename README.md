# Saver

Saver is a static money clarity app that helps users understand what they can spend freely and what should stay safe.

**Live site:** [savers.dev](https://savers.dev/)

## Current Scope

- Public landing page with feature, trust, demo, and CTA sections.
- Supabase-powered login, registration, Google OAuth, and password reset flows.
- Three-step onboarding for money mode, available money, and saving goal.
- Authenticated dashboard with overview, transactions, goals, profile, and mobile bottom navigation.
- Supabase `profiles` table for onboarding state, with local storage only as a browser cache/fallback.

## Tech Stack

- HTML5, Vanilla JavaScript, CSS
- Tailwind CSS CDN
- Supabase Auth and Postgres
- Vercel hosting with clean URL rewrites
- Google Material Symbols
- Plus Jakarta Sans and Inter typography

## Project Structure

```text
Saver/
|-- index.html                  # Canonical landing page
|-- architecture.md             # Technical architecture notes
|-- vercel.json                 # Clean URL redirects and rewrites
|-- .prettierrc.json            # Prettier config
|
|-- supabase/
|   |-- config.js               # Public Supabase browser config
|   |-- schema.sql              # profiles table, RLS, and auth trigger
|   `-- README.md               # Supabase dashboard setup notes
|
|-- pages/
|   |-- index.html              # Legacy /pages landing redirect fallback
|   |-- login.html              # User login
|   |-- register.html           # User registration
|   |-- reset-password.html     # Password reset completion
|   |-- onboarding.html         # Setup wizard
|   `-- dashboard.html          # Authenticated dashboard
|
|-- scripts/
|   |-- auth.js                 # Supabase auth form validation and redirects
|   |-- dashboard.js            # Dashboard state, transactions, and modal logic
|   |-- onboarding.js           # Onboarding wizard and profile persistence
|   |-- reveal.js               # FOUC prevention
|   |-- shared.js               # Shared DOM, formatting, and local cache helpers
|   |-- supabase-client.js      # Supabase client bootstrap and route helpers
|   `-- tailwind-theme.js       # Tailwind design token config
|
`-- styles/
    |-- dashboard.css           # Dashboard shell, panels, bottom nav, modal
    |-- design-system.css       # CSS variables and base tokens
    |-- onboarding.css          # Onboarding panels, cards, and inputs
    `-- shared.css              # Shared auth/marketing visuals
```

## Local Development

```bash
npx serve .
```

Then open `http://localhost:3000/` or use a Vite/static server on `http://localhost:5173/` if you are testing the Supabase redirect URLs already configured for local auth.

## Routing

Production is hosted on Vercel. Clean URLs are the public contract:

| Clean URL         | Source file                 |
| ----------------- | --------------------------- |
| `/`               | `index.html`                |
| `/register`       | `pages/register.html`       |
| `/login`          | `pages/login.html`          |
| `/reset-password` | `pages/reset-password.html` |
| `/onboarding`     | `pages/onboarding.html`     |
| `/dashboard`      | `pages/dashboard.html`      |

Legacy `/pages/*.html` URLs are redirected in `vercel.json` so old links and email redirects do not break.

## Auth And Data

Real authentication requires valid Supabase values in `supabase/config.js`.

Run `supabase/schema.sql` in the Supabase SQL Editor before testing production auth. The dashboard gate uses `profiles.onboarding_completed`; local storage is only a cache so one account cannot inherit another account's onboarding state on the same device.

## Deployment

- **Hosting:** Vercel
- **Production domain:** [savers.dev](https://savers.dev/)
- **Repo:** [github.com/Programmer-3016/Saver](https://github.com/Programmer-3016/Saver)

## License

MIT
