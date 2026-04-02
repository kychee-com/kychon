## Context

Kychon is a greenfield community portal template deploying on Run402. The spec (`docs/spec.md`) defines the full product; this change implements Phase 1 MVP — the core template that everything else builds on.

Run402 provides: Postgres + PostgREST API, static site hosting, Google OAuth + password auth (auto-enabled, PKCE flow), edge functions (Node 22), file storage, email (template-based), and `run402 deploy --manifest app.json` for single-command deploys. The `anon_key` is a permanent project identifier embedded in frontend code. RLS controls write access.

The `../run402/site/llms-cli.txt` file is the authoritative reference for all Run402 CLI commands, REST API patterns, auth flows, and deploy manifests.

## Goals / Non-Goals

**Goals:**

- Deploy a fully functional community portal to `kychon.com` via a single `run402 deploy` command
- Implement all 12 Phase 1 items: schema, deploy, auth, members, directory, announcements, admin dashboard, site settings, inline editing, i18n, config-driven UI, tests, and agent docs
- Achieve 85%+ test coverage on `site/js/**`
- Make the template forkable — a new community can rebrand and deploy in 5 minutes

**Non-Goals:**

- Events, resources, forum, committees (Phase 2 modules)
- AI-powered features — moderation, translation, newsletter, insights (Phase 2)
- Kychon Studio or Kychon Pro (Phase 3-4)
- Recurring billing / Stripe integration
- Real-time features (Run402 is HTTP-only)
- Custom domain support (subdomain only for MVP)

## Decisions

### 1. Deploy manifest as JSON, not TypeScript

The spec references `deploy.ts` but Run402's bundle deploy expects `app.json`. We'll use a `deploy.js` script (Node, no TypeScript compilation needed) that:
- Reads `schema.sql`, `seed.sql`, site files, and function files from disk
- Assembles the `app.json` manifest with `project_id`, `migrations_file`, `rls`, `files`, `functions`, `subdomain`
- Shells out to `run402 deploy --manifest app.json`

**Why not raw app.json?** The manifest needs file contents inlined as `data` strings. A script reads files from disk and assembles the manifest dynamically — no manual base64/string escaping.

**Why JS not TS?** Zero build step. Run with `node deploy.js`. Matches the vanilla JS frontend philosophy.

### 2. RLS strategy: `user_owns_rows` for member data, `public_read` for public content

- `members` table: `user_owns_rows` with `owner_column: "user_id"` — members can only edit their own profile
- `site_config`, `pages`, `sections`, `membership_tiers`, `member_custom_fields`: `public_read` — anyone reads, only authenticated users (admin role checked in JS) write
- `announcements`, `activity_log`: `public_read` — visible to all, admin writes
- Write operations that require admin role are enforced in frontend JS + edge functions (PostgREST doesn't have role-aware RLS beyond owner)

**Alternative considered:** `public_read_write` everywhere with JS-only auth checks. Rejected because any user with the anon_key could write directly to the API.

### 3. Auth flow: Run402 built-in Google OAuth + password, with `on-signup` edge function

- Frontend implements PKCE flow per Run402 docs (`/auth/v1/oauth/google/start` → Google → `#code=xxx` → exchange)
- `on-signup` edge function called by client after first auth callback
- Function checks if `members` table is empty → first user becomes admin
- Session stored in `localStorage` (`access_token`, `refresh_token`, user object)
- Token refresh on 401 responses via `api.js` wrapper

**Why client-triggered on-signup?** Run402 has no webhook/event system (Gap 2 in spec). The client must call `on-signup` explicitly after OAuth callback.

### 4. CSS custom properties injected from `site_config`, no build step

- `config.js` fetches `site_config` on page load, reads the `theme` JSONB value
- Sets CSS custom properties on `document.documentElement` (e.g., `--color-primary`, `--color-bg`)
- `theme.css` declares the variables with defaults; `styles.css` uses them
- No Tailwind, no PostCSS, no build step. Pure CSS variables.

### 5. Tiptap loaded from esm.sh CDN, lazy on admin click

- `admin-editor.js` dynamically imports Tiptap from `esm.sh` only when an admin clicks an editable rich-text region
- Members never download Tiptap (~45kB gzipped)
- Floating toolbar appears on text selection, disappears on blur
- Saves via PATCH to the relevant REST endpoint on blur/save

### 6. i18n: fetch-based locale loading, `t()` function in global scope

- `i18n.js` exports `t(key, vars)` globally, attached to `window`
- On page load, fetches `/custom/strings/{lang}.json` based on `localStorage` preference or `brand.json` default
- Falls back to English key if translation missing
- Plurals via `key_one` suffix; interpolation via `{placeholder}` replacement
- Language picker only shown if `brand.json` lists >1 language

### 7. Test architecture: Vitest with two environments

- `tests/unit/` — runs in Node, tests pure functions (API wrapper, formatters, i18n logic, auth helpers)
- `tests/integration/` — runs in happy-dom, tests DOM rendering and config-driven UI
- `tests/fixtures/` — shared mock data (configs, members, feature flag permutations)
- `fast-check` for property-based tests on config permutations (random feature flag combos should never crash)
- Coverage threshold: 85% on `site/js/**` via `@vitest/coverage-v8`

### 8. Navigation is config-driven, not hardcoded

- `site_config` stores a `nav` key with ordered JSON array of nav items
- Each item has `label`, `href`, `icon`, `public` (bool), `auth` (bool), `feature` (feature flag key), `admin` (bool)
- `config.js` reads nav config + feature flags, filters items based on auth state, renders nav
- Adding/removing nav items = SQL update, no file changes

## Risks / Trade-offs

- **[Client-triggered on-signup is fragile]** → If user closes tab before the call completes, they won't be created in `members`. Mitigation: `config.js` checks on every page load if current auth user exists in `members`; if not, calls `on-signup`.
- **[Admin-only write protection via JS, not RLS]** → A determined user could PATCH admin-only tables using their access_token. Mitigation: Acceptable for community portals (low attack incentive). Phase 2 can add a custom RLS policy using a `role` claim in the JWT if needed.
- **[CDN dependency for Tiptap]** → esm.sh outage blocks admin editing. Mitigation: Admin editing is not critical path. Could vendor Tiptap later if needed.
- **[85% coverage is ambitious for MVP]** → May slow down initial development. Mitigation: Focus coverage on `config.js`, `auth.js`, `api.js`, `i18n.js` — the shared modules. Page-specific JS can have lighter coverage initially.
- **[No email beyond Run402 templates]** → Welcome emails limited to 500-char plain text `notification` template. Mitigation: Functional but not beautiful. Phase 2 addresses with external email API.
