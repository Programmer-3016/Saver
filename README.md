# Saver

A personal money clarity app that helps you understand how much you can freely spend and how much stays safe.

🔗 **Live Demo:** [voluble-lebkuchen-4e3e1a.netlify.app](https://voluble-lebkuchen-4e3e1a.netlify.app/)

## Features

- **3-Step Onboarding** — Quick setup: money mode → set your money → saving goal
- **Smart Suggest** — Auto-recommends a sustainable saving amount (30%)
- **Live Preview** — Real-time calculations update as you enter data
- **YOLO Dashboard** — Editorial layout with Recent Transactions, spending insights, and goal tracking
- **Expense Tracking** — Add expenses with category tags, view full history with filters
- **Income Support** — Log income entries that display in green with `+` prefix
- **Segmented Progress Bar** — Visual step tracker with animated connectors
- **Slide Animations** — Directional transitions between onboarding steps
- **Responsive Design** — Works on mobile, tablet, and desktop
- **FOUC Prevention** — No flash of unstyled content on page load

## Tech Stack

- HTML5, Vanilla JS, CSS
- Tailwind CSS (CDN)
- Google Material Symbols
- Plus Jakarta Sans + Inter typography

## Project Structure

```
Saver/
├── index.html                # Root redirect → pages/index.html
├── architecture.md           # Technical architecture document
├── .prettierrc.json          # Prettier formatting config (2-space, 100 width)
├── pages/
│   ├── index.html            # Landing page (marketing)
│   ├── login.html            # User login
│   ├── register.html         # User registration
│   ├── verify.html           # Email/OTP verification
│   ├── onboarding.html       # Setup wizard (Mode → Money → Goal → Done)
│   └── dashboard.html        # Dashboard (Overview, Transactions, Goals tabs)
├── scripts/
│   ├── shared.js             # Shared utilities ($, $$, formatCurrency, state)
│   ├── onboarding.js         # Onboarding wizard logic + step navigation
│   ├── dashboard.js          # Dashboard logic + transactions + expense modal
│   ├── auth.js               # Auth form validation (login + register)
│   ├── tailwind-theme.js     # Tailwind design token config
│   └── reveal.js             # FOUC prevention (reveals page after load)
└── styles/
    ├── design-system.css     # CSS variables, base tokens, FOUC guard
    ├── shared.css            # Auth visuals, glass cards, animations
    ├── onboarding.css        # Step panels, progress bar, mode cards, inputs
    └── dashboard.css         # Tabs, expense chips, modal, scrollbar utility
```

## Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/Programmer-3016/Saver.git
   ```
2. Open `index.html` in a browser or start a local server:
   ```bash
   npx serve .
   ```

## Onboarding Flow

1. **Money Mode** — Fixed Income / Irregular / Allowance
2. **Set Your Money** — Enter available money + choose saving method (Custom or Smart Suggest)
3. **Why Save?** — Saving for something specific (item + price) or building a safety buffer
4. **Completion** — Personalized summary with free-to-spend amount → redirects to dashboard

## Dashboard (YOLO Layout)

After onboarding, users land on a tabbed dashboard:

| Tab | Content |
|-----|---------|
| **Overview** | Recent Transactions list (full width, scrollable) |
| **Transactions** | Full expense history with category filter chips |
| **Goals** | Saving goal progress, cycle tracker, reset option |

> **Note:** The Overview tab currently shows only Recent Transactions. The Free to Spend sidebar and Daily Spending chart are planned but temporarily removed.

## Deployment

- **Hosting:** Netlify (auto-deploys from `main` branch)
- **Repo:** [github.com/Programmer-3016/Saver](https://github.com/Programmer-3016/Saver)

## License

MIT
