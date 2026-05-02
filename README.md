# Saver

A personal money clarity app that helps you understand how much you can freely spend and how much stays safe.

## Features

- **3-Step Onboarding** — Quick setup: money mode → set your money → saving goal
- **Smart Suggest** — Auto-recommends a sustainable saving amount (30%)
- **Live Preview** — Real-time calculations update as you enter data
- **Responsive Design** — Works on mobile, tablet, and desktop
- **Offline-Ready** — Built as a Progressive Web App (PWA)

## Tech Stack

- HTML5, Vanilla JS, CSS
- Tailwind CSS (CDN)
- Google Material Symbols
- Plus Jakarta Sans + Inter typography

## Project Structure

```
Saver/
├── index.html              # Root redirect to pages/index.html
├── architecture.md         # Technical architecture document
├── pages/
│   ├── index.html          # Landing page (marketing)
│   ├── login.html          # User login
│   ├── register.html       # User registration
│   ├── verify.html         # Email/OTP verification
│   └── app.html            # App shell (onboarding + dashboard)
├── scripts/
│   ├── app.js              # Onboarding wizard logic
│   ├── auth.js             # Auth form validation
│   ├── components.js       # Shared UI component renderers
│   └── tailwind-theme.js   # Tailwind design tokens
└── styles/
    ├── design-system.css   # CSS variables and base tokens
    └── components.css      # Reusable component styles
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

## License

MIT
