## Why

Kychon is designed and specced but has zero implementation. We need the full Phase 1 MVP deployed on Run402 to validate the architecture, dogfood the platform, and enable the Kychon Studio and Pro products that depend on a working template. Without a live MVP, nothing else moves forward.

## What Changes

- Create the database schema (`schema.sql`) and seed data (`seed.sql`) for all core tables
- Build the deploy script (`deploy.ts`) targeting Run402 bundle deploy
- Implement Google OAuth + password auth with first-user-admin flow
- Build member profiles and the member directory (public/private views)
- Build announcements (create, edit, pin)
- Build the full admin dashboard (stats, activity feed, member management, event management, resource management, site settings)
- Implement inline editing for admins (contenteditable + lazy-loaded Tiptap)
- Implement the i18n framework (`t()` function, `en.json`, language picker)
- Build config-driven navigation and schema-driven homepage sections
- Create `STRUCTURE.md` (AI-readable manifest) and `CUSTOMIZING.md` (agent guide)
- Set up Vitest + happy-dom test suite with 85%+ coverage
- Establish deploy verification flow via Claude Code + Chrome MCP

## Capabilities

### New Capabilities

- `database-schema`: All Postgres tables organized by feature section, idempotent migrations, seed data with default config
- `deploy`: Run402 bundle deploy script — schema, site files, functions, secrets, subdomain in one command
- `auth`: Google OAuth + password login, session management, role-based access (member/admin/moderator), first-user-admin flow via `on-signup` edge function
- `member-profiles`: Member CRUD, custom fields (JSONB), avatar upload, profile editor page
- `member-directory`: Searchable/filterable member listing, public vs. auth-gated views, tier display
- `announcements`: Create/edit/pin announcements, admin and member views, activity feed integration
- `admin-dashboard`: Stats cards, activity feed, quick actions, members-needing-attention section, full member/event/resource management pages, site settings panel
- `inline-editing`: `data-editable` attribute system, contenteditable for simple text, Tiptap for rich text (lazy-loaded), click-to-upload for images, admin-only loading
- `i18n`: `t(key, vars)` with English fallback, `_one` plurals, `{placeholder}` interpolation, language picker in profile, `localStorage` persistence, on-demand locale loading
- `config-driven-ui`: `site_config` table drives nav, theme (CSS custom properties), feature flags, homepage sections; `pages` + `sections` tables for schema-driven pages
- `test-suite`: Vitest unit tests (Node) + integration tests (happy-dom), fixture system, fast-check for config permutations, 85%+ coverage via @vitest/coverage-v8
- `agent-docs`: STRUCTURE.md manifest and CUSTOMIZING.md guide for AI agents to understand and modify the template

### Modified Capabilities

(none — greenfield)

## Impact

- **New files**: ~30 files across `site/`, `functions/`, `tests/`, plus root config files
- **Dependencies**: Vitest, happy-dom, fast-check, @vitest/coverage-v8 (dev); Tiptap (runtime, lazy-loaded via esm.sh)
- **Platform**: Requires Run402 project with active tier, Google OAuth (auto-enabled), PostgREST API
- **External**: No external services required for MVP (AI features are Phase 2)
