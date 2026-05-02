# Saver

Saver is a static prototype for a student-friendly money clarity app.

## Current Flow

Landing page -> Register/Login -> Verify -> Onboarding -> Dashboard.

## Folder Structure

- `index.html`: Compatibility redirect to `pages/index.html` for local preview/static hosting.
- `pages/`: HTML pages and route-level screens.
- `pages/index.html`: Public landing page and product story.
- `pages/login.html`: Login screen using the shared auth visual system.
- `pages/register.html`: Register screen using the shared auth visual system.
- `pages/verify.html`: Verification step after login/register.
- `pages/app.html`: Single-page authenticated app (onboarding, dashboard, transactions, goals, profile).
- `styles/design-system.css`: CSS variables for colors, spacing, typography (marketing + auth + app modes).
- `styles/components.css`: Shared component styles, animations, and auth layout helpers.
- `scripts/tailwind-theme.js`: CSS-var-driven Tailwind config loaded by all pages.
- `scripts/components.js`: JS-rendered shared UI components (headers, footers, auth visuals).
- `scripts/auth.js`: Shared static validation and prototype redirects for auth pages.
- `scripts/app.js`: App shell logic — onboarding wizard, state management, live preview.
- `assets/`: Images, icons, and generated visual assets.

## Code Readability Rules

- Keep page sections separated with short HTML comments.
- Keep form behavior in shared JS files, not inline `onsubmit` handlers.
- Use `data-*` hooks for JavaScript behavior so styling classes stay visual-only.
- Avoid comments that explain obvious HTML; comment only file purpose, sections, or tricky behavior.
- Run Prettier before pushing changes.

## Formatting

Use the repo Prettier config:

```bash
npx prettier --write index.html pages/**/*.html scripts/**/*.js styles/**/*.css
```
