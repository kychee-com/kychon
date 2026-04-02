## Why

The 3 demo sites (Silver Pines, Eagles, Barrio Unido) are currently static showcases — visitors can look but not touch. The demo IS the sales funnel for Wild Lychee. Making demos fully "playable" — where visitors can instantly try admin or member roles with real writes — turns passive browsing into hands-on conviction.

## What Changes

- **Demo mode flag** in `site_config` (`demo_mode: true`) enables all demo-specific behavior
- **Pre-seeded demo accounts** (admin + member) per demo site with hardcoded credentials, auto-signed-in on button click via `signIn()` with real JWTs
- **Demo banner component** — persistent top banner showing current role, role switcher, countdown to reset, and "Get Your Own Portal" CTA
- **Hourly reset function** (`reset-demo.js`) — scheduled function that TRUNCATEs mutable tables, re-runs seed data, and re-links demo auth accounts
- **Reset countdown + force-reload** — client reads `last_reset` from `site_config`, shows countdown in banner, force-reloads page when reset fires
- **Demo deploy scripts updated** — include `reset-demo.js`, exclude `check-expirations.js` (irrelevant for demos: no real members, no real emails, data resets hourly)
- **One-time bootstrap script** per demo site — signs up demo auth accounts, links them to seed member records, stores user_ids in `site_config`

## Capabilities

### New Capabilities
- `demo-mode`: Demo mode detection, demo banner UI, role switching, auto-login with demo credentials, reset countdown, and force-reload on reset
- `demo-reset`: Hourly scheduled function that resets demo site data to seed state while preserving auth accounts, plus one-time bootstrap script for initial demo account setup

### Modified Capabilities
- `deploy`: Demo deploy scripts updated to include `reset-demo.js` and exclude `check-expirations.js`

## Impact

- **New files**: `src/components/DemoBanner.astro`, `functions/reset-demo.js`, `scripts/bootstrap-demo.sh`
- **Modified files**: `src/layouts/Portal.astro` (conditionally render DemoBanner), `demo/*/seed.sql` (add `demo_mode`, `demo_accounts`, `last_reset` config keys), `demo/*/deploy.sh` (swap scheduled function)
- **Dependencies**: None new — uses existing `signIn()`/`signOut()` from `src/lib/auth.ts` and `db.sql()` from Run402 functions
- **RLS**: No changes — `public_read` template already allows authenticated writes
- **Tier impact**: Each demo project uses its 1 allowed prototype-tier scheduled function for `reset-demo.js` instead of `check-expirations.js`
