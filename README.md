# Saver

A personal money clarity app that helps you understand how much you can freely spend and how much stays safe.

🔗 **Live Demo:** [voluble-lebkuchen-4e3e1a.netlify.app](https://voluble-lebkuchen-4e3e1a.netlify.app/)

## Features

- **3-Step Onboarding** — Quick setup: money mode → set your money → saving goal
- **Smart Suggest** — Auto-recommends a sustainable saving amount (30%)
- **Live Preview** — Real-time calculations update as you enter data
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
├── pages/
│   ├── index.html            # Landing page (marketing)
│   ├── login.html            # User login
│   ├── register.html         # User registration
│   ├── verify.html           # Email/OTP verification
│   └── app.html              # App shell (onboarding + dashboard)
├── scripts/
│   ├── app.js                # Onboarding wizard logic + state management
│   ├── auth.js               # Auth form validation (login + register)
│   ├── components.js         # Shared UI component renderers
│   ├── tailwind-theme.js     # Tailwind design token config
│   └── reveal.js             # FOUC prevention (reveals page after load)
└── styles/
    ├── design-system.css     # CSS variables, base tokens, FOUC guard
    └── components.css        # Reusable component styles (steps, cards, etc.)
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
4. **Completion** — Personalized summary with free-to-spend amount

## Deployment

- **Hosting:** Netlify (auto-deploys from `main` branch)
- **Repo:** [github.com/Programmer-3016/Saver](https://github.com/Programmer-3016/Saver)

## License

MIT
