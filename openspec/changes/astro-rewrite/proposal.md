## Why

Wild Lychee's vanilla HTML/JS architecture has three gaps that compound as agents build more portals:

1. **Full page reloads** — every navigation is a hard reload, falling short of modern UX expectations. Building a proper client-side router in vanilla JS is effectively building a framework.
2. **No component reuse** — agents copy-paste nav, footer, scripts, and boilerplate into every new page. Each copy is a chance to diverge, forget, or break.
3. **No build-time type checking** — agent mistakes (wrong field names, bad payloads, missing imports) only surface at runtime in production.

Astro SSG solves all three while outputting the same static HTML/JS/CSS that Run402 serves today. No SSR needed, no platform changes.

## What Changes

- **Rewrite `site/` to Astro project structure** (`src/pages/`, `src/components/`, `src/layouts/`) — 11 pages, ~3,300 lines of JS
- **Add `<ClientRouter />` for view transitions** — SPA-like navigation with animated page swaps, no full reloads
- **Create shared layouts and components** — `Portal.astro` layout (nav, footer, theme, auth, i18n), reusable components (EventCard, MemberCard, Toast, etc.)
- **Add Zod schemas for API response validation** — type-safe wrappers around PostgREST calls
- **Introduce Astro build step** — `astro build` → `dist/` → deploy.js collects from `dist/` instead of `site/`
- **Update deploy.js** — add build step, inject env.js post-build, collect from `dist/`
- **Migrate test suite** — update imports and paths for new file structure
- **Add Astro + Vite as dev dependencies** — new build toolchain

No changes to: schema.sql, seed.sql, edge functions, i18n string files, brand.json, RLS config, PostgREST API layer.

## Capabilities

### New Capabilities

- `astro-project-structure`: Astro project setup — config, layouts, component architecture, build pipeline, and the conventions agents follow when adding pages or features
- `view-transitions`: Client-side navigation via Astro's `<ClientRouter />` — page transitions, persistent elements, animation behavior
- `api-type-safety`: Zod schemas for PostgREST responses and shared TypeScript types for API interactions

### Modified Capabilities

- `deploy`: Build step added before file collection; env.js injected into `dist/` post-build; files collected from `dist/` instead of `site/`
- `inline-editing`: Tiptap and contenteditable editing repackaged as Astro client islands (`client:idle`); same UX, different hydration wrapper
- `i18n`: String translation system (`t()` + JSON files) preserved; Astro's built-in i18n routing added for locale-prefixed URLs (`/es/events`)
- `auth`: Google OAuth PKCE flow moved into a `client:load` island component; session management unchanged
- `config-driven-ui`: Runtime config-from-DB pattern preserved; theme injection and nav building move into layout component + client island
- `test-suite`: Test files migrated to new paths; vitest config updated for Astro project structure

## Impact

- **Frontend code**: Complete rewrite of `site/` → `src/`. All 11 HTML pages and ~20 JS files restructured.
- **Build toolchain**: New dev dependencies (astro, @astrojs/check, zod). Vite replaces direct file serving for dev.
- **Deploy pipeline**: deploy.js gains a build step. Deploy time increases by build duration (~5-15s).
- **Agent workflow**: Agents read/write `.astro` files instead of `.html`+`.js`. STRUCTURE.md and CUSTOMIZING.md need updates.
- **Dev experience**: `npm run dev` now runs Astro dev server with HMR instead of a static file server.
- **No backend impact**: Schema, seed, edge functions, PostgREST, RLS — all unchanged.
