## 1. Project Setup & Database

- [x] 1.1 Initialize `package.json` with project metadata and dev dependencies (vitest, happy-dom, fast-check, @vitest/coverage-v8)
- [x] 1.2 Create `vitest.config.js` with unit (node) and integration (happy-dom) environments, coverage threshold at 85% on `site/js/**`
- [x] 1.3 Create `schema.sql` with all tables organized by feature section (site_config, pages, sections, membership_tiers, member_custom_fields, members, events, event_rsvps, resources, forum tables, committees, announcements, activity_log, AI tables) using `CREATE TABLE IF NOT EXISTS`
- [x] 1.4 Create `seed.sql` with default site_config (branding, theme, feature flags, nav), default membership tiers, and sample homepage sections using `ON CONFLICT` for idempotency

## 2. Deploy Script

- [x] 2.1 Create `deploy.js` that reads project files, assembles Run402 `app.json` manifest (migrations_file, rls, files, functions, subdomain), and runs `run402 deploy --manifest app.json`
- [x] 2.2 Support `RUN402_PROJECT_ID` env var or active project fallback, `SUBDOMAIN` env var or default
- [x] 2.3 Configure RLS in manifest: `user_owns_rows` for `members` (owner_column: user_id), `public_read` for config/content tables

## 3. Frontend Foundation (CSS + Config + API)

- [x] 3.1 Create `site/css/theme.css` with CSS custom properties and sensible defaults for all theme variables
- [x] 3.2 Create `site/css/styles.css` with component styles using CSS variables (layout, cards, buttons, forms, nav, typography, responsive breakpoints)
- [x] 3.3 Create `site/js/api.js` — thin REST wrapper around Run402 PostgREST API: GET/POST/PATCH/DELETE with auth headers, 401 → token refresh → retry, JSON parsing
- [x] 3.4 Create `site/js/config.js` — fetch site_config on load, inject theme as CSS custom properties, build nav from config, check feature flags, set branding (title, logo, favicon), check if current user exists in members (on-signup resilience)
- [x] 3.5 Create `site/custom/brand.json` with default config (name, theme, languages, defaultLanguage)

## 4. Auth

- [x] 4.1 Create `site/js/auth.js` — PKCE helpers, Google OAuth flow (start → redirect → exchange), password signup/login, session persistence in localStorage, token refresh, role checking, logout
- [x] 4.2 Create `functions/on-signup.js` edge function — check if members table is empty → first user becomes admin, otherwise create pending member; populate display_name/avatar_url from auth user
- [x] 4.3 Add login/signup UI to `site/index.html` (or a login modal) with Google Sign-In button and email/password form

## 5. i18n

- [x] 5.1 Create `site/js/i18n.js` — `t(key, vars)` function with English fallback, `_one` plural suffix, `{placeholder}` interpolation, on-demand fetch of locale files, localStorage persistence, RTL support
- [x] 5.2 Create `site/custom/strings/en.json` with all UI string keys (~450 keys organized by section: nav, auth, profile, directory, announcements, admin, settings, common)

## 6. Pages — Home & Announcements

- [x] 6.1 Create `site/index.html` — landing page with schema-driven sections (hero, features, CTA, stats, testimonials, FAQ), announcements feed, login/signup, nav
- [x] 6.2 Create homepage section renderer in `config.js` or a dedicated module — reads `sections` table, renders each type (hero, features, cta, stats, testimonials, faq, custom)
- [x] 6.3 Create announcement display logic — fetch announcements ordered by pinned + created_at, render as feed on home page

## 7. Member Profiles & Directory

- [x] 7.1 Create `site/profile.html` + `site/js/profile.js` — profile editor with display_name, bio, avatar upload, custom fields dynamically rendered from `member_custom_fields`, auth-gated
- [x] 7.2 Create `site/directory.html` + `site/js/directory.js` — member grid/list, search by name, filter by tier, member detail view (modal/expand), auth-gating based on `directory_public` config

## 8. Admin Dashboard & Management

- [x] 8.1 Create `site/admin.html` + `site/js/admin.js` — stats cards (active members, pending, announcements, expiring), activity feed (latest 20 from activity_log), quick actions, admin role gate
- [x] 8.2 Create `site/admin-members.html` + `site/js/admin-members.js` — member list with search/filter, approve/suspend/change tier/change role actions, CSV export
- [x] 8.3 Create `site/admin-settings.html` + `site/js/admin-settings.js` — edit site name/tagline/logo/favicon, theme color pickers, feature flag toggles, tier configuration, custom field management

## 9. Announcements Admin

- [x] 9.1 Add announcement creation UI for admins (title + rich text body, Post button)
- [x] 9.2 Add pin/unpin, edit (inline), and delete actions on announcements for admins
- [x] 9.3 Log announcement creation to activity_log

## 10. Inline Editing

- [x] 10.1 Create `site/js/admin-editor.js` — scan for `data-editable`, `data-editable-rich`, `data-editable-image` attributes; attach contenteditable handlers with save-on-blur
- [x] 10.2 Implement Tiptap lazy-load from esm.sh for `data-editable-rich` elements — floating toolbar on selection, save on blur
- [x] 10.3 Implement click-to-upload for `data-editable-image` elements — file picker, upload to Run402 storage, update src
- [x] 10.4 Add dynamic `<script>` injection of `admin-editor.js` in `config.js` only when user role is admin

## 11. Schema-Driven Pages

- [x] 11.1 Create `site/page.html` — generic page renderer that reads `?slug=` parameter, fetches page + sections, renders content and sections

## 12. Agent Documentation

- [x] 12.1 Create `STRUCTURE.md` — AI-readable manifest covering current version, file structure, schema overview, feature flags, how to add features/pages/languages, naming conventions
- [x] 12.2 Create `CUSTOMIZING.md` — step-by-step examples for: add tier (SQL), add custom field, enable feature flag, create page, add language, add scheduled job, retheme

## 13. Tests

- [x] 13.1 Create `tests/fixtures/configs.js` and `tests/fixtures/members.js` with reusable mock data
- [x] 13.2 Create `tests/unit/api.test.js` — test auth headers, 401 refresh, JSON parsing, error handling
- [x] 13.3 Create `tests/unit/i18n.test.js` — test t() translation, fallback, interpolation, plurals
- [x] 13.4 Create `tests/unit/auth.test.js` — test PKCE generation, session persistence, role checking
- [x] 13.5 Create `tests/unit/config.test.js` — test theme injection, nav filtering, feature flag processing
- [x] 13.6 Create `tests/integration/nav.test.js` — test nav renders correctly from config, feature flags hide items
- [x] 13.7 Create `tests/integration/features.test.js` — fast-check property tests for random feature flag combinations
- [x] 13.8 Create `tests/integration/i18n-render.test.js` — test UI string rendering with different locales
- [x] 13.9 Create `tests/integration/directory.test.js` — test member grid rendering, search filtering
- [x] 13.10 Create `tests/integration/dashboard.test.js` — test stats cards and activity feed rendering

## 14. Deploy Verification

- [x] 14.1 Deploy to Run402 prototype tier and verify: all pages load, first-user-admin flow works, inline editing works, feature flags toggle nav items, announcements CRUD works
