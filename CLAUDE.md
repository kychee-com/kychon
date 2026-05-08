# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kychon is an AI-powered membership/community portal template built on the Run402 serverless platform. It's three products in one:

- **Kychon** - A forkable community portal template (free + $5-20/mo Run402 hosting)
- **Kychon Studio** - AI concierge that builds your portal via investigation + interview ($29 premium)
- **Kychon Pro** - Ongoing AI customization agent ($9-29/mo)

**Status**: Design complete, ready for implementation. The full spec lives in `docs/spec.md`.

**Cross-repo boundary**: The marketing site at `kychon.com` lives in the sibling private repo `kychee-com/kychon-private`. Marketing-site source, deploy script, copy, and domain config changes go there, not here. See `openspec/specs/marketing-deploy/spec.md`.

## Architecture

### Config-Driven Design

The central design principle: **an AI agent's API is SQL for config and file editing for code.** Three customization tiers:

1. **SQL only** (80%) - rebrand, toggle features, restructure via `site_config` table (JSONB)
2. **HTML/CSS** (15%) - visual/layout changes
3. **Full fork** (5%) - new tables, functions, page types

### Inline Editing ("The page IS the admin")

Members and admins see the same URL. Admins get edit overlays via `data-editable` attributes. Three editing layers:
- **Simple text**: native `contenteditable` (~30 lines JS)
- **Rich text**: Tiptap (~45kB), lazy-loaded only for admins
- **Images**: click-to-upload handler (~30 lines)

Member page load: ~15kB. Admin adds: ~60kB (admin-editor.js + Tiptap).

### Composable Layout (every block is data)

Every visible block on every page — including chrome (`zone='header'`, `zone='footer'`) and main content (`zone='main'`) — is a row in the `sections` table addressed by `(page_slug, zone, scope, position)`. There are no hard-coded `<Nav>` / `<Footer>` components.

- **Block registry** (`src/lib/blocks.ts`) — single isomorphic `renderBlock(section, ctx): string` runs at Astro build time (Node) and at runtime (browser). Dynamic blocks emit a skeleton at bake time and have a `hydrate(el, section, ctx)` that fetches data and replaces the body. Block types:
  - **Main-zone**: `hero`, `features`, `cta`, `stats`, `testimonials`, `faq`, `polls` (dyn), `event_countdown` (dyn), `announcements_feed` (dyn), `activity_feed` (dyn), `tagline_strip`, `promo_cards`, `link_list` (dyn in resources mode), `events_list` (dyn), `slideshow` (dyn), `custom`.
  - **Header-zone**: `nav`, `brand_header`, `sign_in_bar`, `page_banner` (page-scoped per-page banner; substrate uses `scope='page'` so a banner appears only on its page).
  - **Footer-zone**: `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`.
  - The `slideshow` controller lives at `src/lib/blocks/slideshow.ts` (~3 kB minified) and respects `prefers-reduced-motion`, hover, focus, and tab-visibility pause; cleans up on `astro:before-swap` and `wl-content-rendered`.
- **Typed seeds** — each forkable project has a `src/seeds/{project}.ts` module exporting a `ProjectSeed`. `scripts/generate-seed-sql.ts` translates the typed seed into idempotent `seed.sql` (gitignored). `KYCHON_PROJECT` env var selects which project's seed to use; `Portal.astro` and the generator both read it via `getActiveProjectSeed()`.
- **Build-time bake** — `Portal.astro`'s frontmatter calls `renderBlock` against the active project's `scope='global'` header / footer blocks at build time (page-scoped chrome like `page_banner` is intentionally excluded so it does not leak into every page's static HTML — runtime hydrate paints it on its target page in the first frame). The result is injected into `#zone-header` and `#zone-footer` containers via `set:html`, giving instant chrome on cold visits with no flicker.
- **Runtime hydrate** — `src/lib/page-render.ts:hydratePage(slug)` runs on every page load. It reads cached sections from `localStorage` (`wl_cache_sections_{slug}`), renders into zones, then fetches fresh from PostgREST in one query (`?or=(and(page_slug.eq.{slug},scope.eq.page),scope.eq.global,page_slug.eq.*)`), updates if different, and runs each block's hydrator.
- **Cross-zone drag** — `AdminEditor.astro` has document-level drag handlers. Drop into a different zone PATCHes both `zone` and `position`. Empty zones show a "Drop here" placeholder during admin drag. Cross-zone-into-chrome shows a transient promotion tooltip offering `Make global`.
- **Scope toggle** — `scope` is an explicit, drag-independent property. The admin section toolbar shows a `GLOBAL` pill when `scope='global'` plus a `Make global` / `Make page-only` toggle.
- **Column span** — each `sections` row carries `column_span` (`'1' | '1/2' | '1/3' | '2/3'`). The main and footer zone hosts (`#sections`, `[data-zone="footer"] > .container`) render as a 6-column CSS Grid (`public/css/zone-grid.css`); `renderBlock` post-processes the leading tag of every block with `data-column-span`. On tablet (≤900px) the grid drops to 4 cols and thirds collapse to full; on mobile (≤600px) every block stacks. Each `BlockType.supportedSpans` constrains the popover's span radio. The header zone keeps its existing flex layout — chrome is naturally horizontal.

### i18n (Krello Pattern)

- Translation files in `public/custom/strings/{lang}.json` (~450 keys)
- `t(key, vars)` function with English fallback, `_one` suffix for plurals, `{placeholder}` interpolation
- Config in `public/custom/brand.json`: `languages` array + `defaultLanguage`

### AI Features (BYOK)

Users store `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` as project secrets. Scheduled edge functions call the API. Feature-flagged: moderation, auto-translation, newsletter, member insights, onboarding, event recaps.

## Tech Stack

- **Frontend**: Astro SSG (static output) + TypeScript + Zod schemas
- **Editor**: Tiptap (headless, lazy-loaded for admins via client:idle island)
- **Runtime**: Node.js edge functions on Run402
- **Database**: PostgreSQL via Run402 (PostgREST)
- **Auth**: Run402 built-in (Google OAuth + password)
- **Testing**: Vitest + happy-dom + fast-check + @vitest/coverage-v8 (85%+ threshold)
- **E2E**: Claude Code + Chrome MCP (agent-driven visual verification)
- **Deployment**: `npx tsx scripts/deploy.ts` (astro build + idempotent, additive migrations) — typed `@run402/sdk/node` calls

## File Structure

```
kychon/
├── astro.config.mjs       # Astro config: SSG, build.format: 'file', i18n
├── scripts/
│   ├── deploy.ts          # Production deploy entry (kychon.run402.com)
│   ├── deploy-demo.ts     # Per-demo orchestrator (asset copy + deploy + bootstrap)
│   ├── deploy-all.ts      # Multi-demo dispatcher (called by deploy-all.sh)
│   ├── bootstrap-demo.ts  # Demo account setup (signup, on-signup, role-set)
│   ├── generate-seed-sql.ts # Reads src/seeds/{project}.ts → writes seed.sql
│   └── _lib.ts            # Shared: runDeploy(), file collection, error formatting
├── schema.sql             # All tables (idempotent)
├── seed.sql               # Generated by `tsx scripts/generate-seed-sql.ts` (gitignored)
├── src/
│   ├── pages/*.astro      # One .astro file per route
│   ├── layouts/Portal.astro  # Main layout (zones + build-time chrome bake)
│   ├── components/*.astro    # Reusable components (AdminEditor, Toast, etc.)
│   ├── lib/blocks.ts         # Block-type registry + isomorphic renderBlock()
│   ├── lib/block-hydrators.ts # Browser-only hydration for dynamic blocks
│   ├── lib/page-render.ts    # Runtime zone hydration + cache layer
│   ├── lib/*.ts              # Shared modules (api, auth, config, i18n)
│   ├── schemas/*.ts          # Zod schemas for PostgREST responses
│   └── seeds/{project}.ts    # Typed ProjectSeed per fork (kychon, eagles, ...)
├── public/
│   ├── css/               # Static adjunct CSS (theme.css, nav-dropdown.css, zone-grid.css, a11y.css, admin-editing.css)
│   ├── js/env.js          # Runtime config (auto-generated by deploy script)
│   └── custom/            # brand.json, strings/*.json
├── functions/             # Run402 edge functions
└── tests/                 # Vitest (unit + integration)
```

## Key Conventions

- **One .astro page per route** - each page imports Portal layout and adds page-specific content + `<script>`
- **Predictable naming**: `src/pages/{feature}.astro`, `src/components/{Name}.astro`, `src/lib/{module}.ts`
- **Island hydration**: `client:load` (immediate), `client:visible` (on scroll), `client:idle` (after page settles)
- **Feature flags, not plugins** - all features ship, toggle with booleans in `site_config`
- **CSS variables for theming** - ConfigProvider reads `theme` from DB and sets custom properties at runtime; every theme key has a downstream consumer in `public/css/`. Non-system fonts named in `theme.font_heading` / `theme.font_body` are auto-loaded via Google Fonts at build time (see [THEME.md](THEME.md))
- **Astro build step** - `astro build` outputs static HTML/JS/CSS to `dist/`, deployed to Run402
- **View transitions** - `<ClientRouter />` provides SPA-like navigation without full page reloads
- **Type safety** - Zod schemas validate API responses; typed wrappers in `src/lib/api.ts`
- **Run402 tooling uses `@run402/sdk`** - new Node code targeting Run402 imports from `@run402/sdk/node` (typed errors, structured methods). No new `execSync('run402 …')` call sites. The `@run402/sdk` devDep is exact-pinned because the SDK is <1 month old and has shipped breaking minor bumps. See `openspec/changes/deploy-sdk-migration/` for the migration record.
  - **Local-only**: this machine's `npm` config has a `before=` cutoff that filters out recently-published packages. Bumping the SDK to a release published after the cutoff requires `npm install --before=null @run402/sdk@<version>` (or temporarily `npm config delete before`). Not a Run402 issue — a personal sandbox knob.

## Build Phases

1. **Phase 1 (MVP)**: Schema, auth, members, directory, announcements, admin dashboard, inline editing, i18n, config-driven nav/pages, tests, STRUCTURE.md, CUSTOMIZING.md
2. **Phase 2**: Events, resources, scheduled functions, forum, committees, AI features (moderation, translation, insights, onboarding)
3. **Phase 3**: Kychon Studio (Chrome investigation + interview + build), newsletter/recap AI, marketing site, niche variants
4. **Phase 4**: Kychon Pro agent, marketplace publishing, growth

## OpenSpec Workflow

Changes are managed via OpenSpec in `/openspec/`. Use `/opsx:propose` to propose new changes, `/opsx:apply` to implement tasks, `/opsx:explore` to think through ideas.

## Run402 Platform Gaps to Work Around

- **~~No webhooks~~** (FIXED): Run402 now has lifecycle hooks. A deployed function named `on-signup` is automatically invoked after first signup with `{ user: { id, email, created_at } }` payload.
- **No batch REST operations**: Approving 12 members = 12 PATCH requests. Workaround: use an edge function with `db.sql()` for bulk updates.
- **~~10MB file upload limit~~** (RAISED): As of `@run402/sdk@1.44.0` the bundle-deploy endpoint accepts ~50MB+ payloads in a single shot, so the deploy batching workaround is gone. The 1.50.x switch to `r.deploy.apply()` (CAS streaming) lifts that ceiling further — bytes are uploaded only for SHAs the gateway hasn't seen. Per-blob upload limits for runtime user uploads (photos/videos) are unchanged from the platform default.
