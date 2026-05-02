# Saver Architecture v1

## Core Idea

Saver ko 2 alag surfaces me sochna chahiye:

1. Public marketing website
2. Authenticated app

Yeh dono visually related honge, lekin UX alag hoga.

- Marketing site ka goal: user ko product samjhana aur sign up karwana
- App ka goal: user ko money clarity dena

---

## High-Level User Journey

1. User landing page par aata hai
2. User product samajhta hai
3. User `Get Started` ya `Register` click karta hai
4. User register page par jata hai
5. Account create karta hai
6. Email / OTP verification hoti hai
7. User onboarding flow me jata hai
8. Mode select karta hai:
   - Fixed Income
   - Irregular Income
   - Allowance
9. Basic financial setup complete karta hai
10. User dashboard par land karta hai

Returning user flow:

1. User landing page ya direct app URL par aata hai
2. Agar logged out hai:
   - login page par redirect
3. Agar logged in hai but onboarding incomplete hai:
   - onboarding resume
4. Agar logged in aur onboarding complete hai:
   - direct dashboard

---

## Route Architecture

### Public Routes

- `/`
  - Landing page
- `/register`
  - New user account creation
- `/login`
  - Existing user login
- `/forgot-password`
  - Password reset request
- `/verify`
  - OTP or email verification

### Protected Setup Routes

- `/onboarding`
  - Multi-step user setup
- `/onboarding/mode`
  - Income type selection
- `/onboarding/setup`
  - Income, fixed expenses, reserve
- `/onboarding/goals`
  - Savings goal setup

### Protected App Routes

- `/app/dashboard`
  - Main overview
- `/app/transactions`
  - Full transaction history
- `/app/add-expense`
  - Quick expense entry
- `/app/goals`
  - Savings goals
- `/app/profile`
  - User settings and profile

---

## Access Rules

### Guest User

- Can access:
  - `/`
  - `/register`
  - `/login`
  - `/forgot-password`
- Cannot access:
  - `/onboarding`
  - `/app/*`

### Authenticated But Not Verified

- Can access:
  - `/verify`
- Should be redirected away from:
  - `/app/*`

### Authenticated But Onboarding Incomplete

- Can access:
  - `/onboarding/*`
- If tries to open `/app/*`, redirect to `/onboarding`

### Fully Authenticated User

- Can access:
  - `/app/*`
- If visits `/login` or `/register`, redirect to `/app/dashboard`

---

## Navigation Rules

### On Landing Page

Header should show:

- Logo
- Features
- Testimonials
- Pricing or Waitlist
- `Login`
- `Get Started`

Important:

- Landing page par bottom app nav nahi aayega
- Bottom nav sirf authenticated app pages me hoga

### On Register Page

Show:

- Logo
- short headline
- registration form
- link: `Already have an account? Log in`

### On Login Page

Show:

- Logo
- short welcome back copy
- login form
- link: `New here? Create account`

### In App

Show:

- app shell navigation
- mobile bottom nav
- user avatar / profile access

---

## Best CTA Flow

### Primary CTA

`Get Started for Free`

Flow:

Landing page -> Register page

### Secondary CTA

`View Demo`

Flow:

Landing page -> demo section, preview modal, or interactive sample

### Login CTA

`Log in`

Flow:

Landing page -> Login page

---

## Recommended Register Flow

### MVP Version

Simple and fast:

1. Name
2. Email
3. Password
4. Create account
5. Verify
6. Onboarding

Optional:

- Google sign in later
- Phone OTP later

### Good Register UX

- Keep form short
- Do not ask financial data on register page
- Financial setup only after account creation

---

## Recommended Login Flow

1. Email
2. Password
3. Login

Optional later:

- Google login
- Magic link
- OTP login

---

## Onboarding Architecture

Onboarding should not feel like a finance form.

It should be 3 lightweight steps:

1. Money mode
   - Fixed Income
   - Irregular Income
   - Allowance

2. Setup basics
   - income / available money
   - fixed or committed expenses
   - reserve / savings target
   - cycle

3. Goal setup
   - emergency fund
   - gadget
   - trip
   - course fee

After completion:

- Save onboarding state
- Mark user as onboarded
- Redirect to dashboard

---

## App Shell Architecture

After login and onboarding, user enters app shell.

### Desktop App Shell

- top app bar
- side navigation or compact tab nav
- content area

### Mobile App Shell

- top header
- main content
- bottom navigation

Bottom nav items:

- Home
- Trends
- Budgets
- Profile

---

## State Model

User state ko backend ya auth layer me clearly track karna hoga:

- `isAuthenticated`
- `isVerified`
- `isOnboarded`
- `selectedMode`

These flags decide routing.

---

## Recommended Page Order For Design

Build in this order:

1. Landing page
2. Register page
3. Login page
4. Onboarding flow
5. Dashboard
6. Add expense page
7. Transactions page
8. Goals page

---

## Implementation Architecture

### Two-Zone Approach

**Zone 1 — Multi-Page (Public Site)**

Each public page is a separate HTML file:

- `pages/index.html` — Landing page
- `pages/login.html` — Login
- `pages/register.html` — Register
- `pages/verify.html` — Email/OTP verification

These pages share styles via `design-system.css`, `components.css`, and `tailwind-theme.js`.

**Zone 2 — Single-Page (Authenticated App)**

All authenticated features live in one file:

- `pages/app.html` — Onboarding, Dashboard, Transactions, Goals, Profile

JavaScript toggles sections. Bottom nav stays persistent. No page reloads inside the app.

### Design System Modes

- `data-ui="marketing"` — Landing page, verify page
- `data-ui="auth"` — Login, register pages
- `data-ui="app"` — Authenticated app (shares auth palette, cleaner background)

### State Model

Stored in `localStorage`:

- `saver_onboarding` — Onboarding wizard state (mode, income, expenses, goals)
- `saverUserEmail` — User email from auth
- `saverUserName` — User name from auth

---

## Final Implemented Flow

`Landing -> Register -> Verify -> app.html (Onboarding) -> app.html (Dashboard)`

Returning users:

`Landing or direct URL -> Login -> app.html (Dashboard)`
