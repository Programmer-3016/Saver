# Saver Architecture v2

## Core Concept

Saver is designed as two distinct surfaces:

1. **Public marketing website** — Educates users and drives sign-ups
2. **Authenticated app** — Provides daily money clarity and spending tracking

Both share a unified design system but serve different UX goals.

---

## User Journey

### New User

1. User lands on the marketing page
2. User explores features, testimonials, and pricing
3. User clicks "Get Started" or "Register"
4. User creates an account on the register page
5. Email/OTP verification completes
6. User enters the onboarding flow
7. User completes 3-step setup
8. User lands on the dashboard

### Returning User

1. User visits the landing page or direct app URL
2. If logged out → redirected to login page
3. If logged in but onboarding incomplete → onboarding resumes
4. If logged in and onboarded → direct to dashboard

---

## Route Architecture

### Public Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing page | Marketing and product overview |
| `/register` | Register page | New user account creation |
| `/login` | Login page | Existing user authentication |
| `/verify` | Verification page | Email or OTP verification |

### Protected Setup Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/onboarding` | Multi-step wizard | User financial setup |
| `/onboarding/mode` | Step 1 | Income type selection |
| `/onboarding/money` | Step 2 | Available money and saving preference |
| `/onboarding/goal` | Step 3 | Saving goal type |

### Protected App Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/app/dashboard` | Dashboard | Main overview with spending tracker |
| `/app/transactions` | Transactions | Full spending history |
| `/app/add-expense` | Add Expense | Quick expense entry |
| `/app/goals` | Goals | Savings goal tracking |
| `/app/profile` | Profile | User settings |

---

## Access Rules

| User State | Can Access | Redirected From |
|------------|-----------|-----------------|
| Guest | `/`, `/register`, `/login` | `/onboarding`, `/app/*` |
| Authenticated, not verified | `/verify` | `/app/*` |
| Authenticated, not onboarded | `/onboarding/*` | `/app/*` → `/onboarding` |
| Fully authenticated | `/app/*` | `/login`, `/register` → `/app/dashboard` |

---

## Navigation Rules

### Landing Page

Header displays: Logo, Features, Testimonials, Login, Get Started.
No bottom app navigation on the landing page.

### Auth Pages (Login/Register)

Displays: Logo, headline, form, and alternate auth link.

### In-App (Dashboard)

Top navigation bar with:
- Logo ("Saver")
- Tab pills: **Overview** (active) | **Transactions** | **Goals**
- Notification bell + user avatar

No sidebar navigation. Mobile uses a fixed bottom nav bar for tab switching. Tabs switch content in-place.

---

## Onboarding Flow

Three lightweight steps designed to feel conversational, not like a finance form:

### Step 1 — Money Mode

User selects how money comes to them:
- **Fixed Income** — Regular salary or stipend
- **Irregular Income** — Freelance or project-based
- **Allowance** — Pocket money or travel savings

### Step 2 — Set Your Money

User answers two questions:
1. "How much money do you have right now?" → Single currency input
2. "How much do you want to save?" → Two options:
   - **Custom** — User enters a specific amount
   - **Smart Suggest** — App recommends 30% of total

### Step 3 — Why Save?

User picks a saving motivation:
- **Saving for something specific** — User enters item name and price. App calculates the timeline.
- **Just for the future** — No input needed. App auto-tracks toward a safety buffer.

### Completion

Shows the calculated "Free to Spend" amount and transitions to the dashboard.

---

## Implementation Architecture

### Two-Zone Approach

**Zone 1 — Multi-Page (Public Site)**

Each public page is a separate HTML file:
- `pages/index.html` — Landing page
- `pages/login.html` — Login
- `pages/register.html` — Register
- `pages/verify.html` — Email/OTP verification

These pages share styles via `design-system.css`, `shared.css`, and `tailwind-theme.js`.

**Zone 2 — Multi-Page (Authenticated App)**

Authenticated features are split across two pages:
- `pages/onboarding.html` — Setup wizard (Mode → Money → Goal → Done)
- `pages/dashboard.html` — Dashboard (tabbed: Overview, Transactions, Goals)

Onboarding redirects to dashboard on completion. Dashboard redirects back to onboarding if setup is incomplete. Tab switching within the dashboard uses `dash-panel` + `data-panel` attributes — no page reloads inside the dashboard.

Shared logic lives in `scripts/shared.js` (DOM helpers, currency formatting, state persistence). Each page has its own script (`onboarding.js`, `dashboard.js`).

### Design System Modes

- `data-ui="marketing"` — Landing page, verify page
- `data-ui="auth"` — Login, register pages
- `data-ui="app"` — Authenticated app shell

### State Model

Stored in `localStorage`:
- `saver_onboarding` — Onboarding wizard state (mode, money, saving, goal)
- `saver_transactions` — Array of expense/income objects `{ desc, amount, category, ts }`
- `saverUserEmail` — User email from auth
- `saverUserName` — User name from auth

---

## Implemented Flow

```
Landing → Register → Verify → onboarding.html (Wizard) → dashboard.html (Dashboard)
```

Returning users:

```
Landing or direct URL → Login → onboarding.html (auto-redirects to dashboard.html)
```
