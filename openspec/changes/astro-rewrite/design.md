## Context

Kychon is a 90%-complete community portal running on Run402 (static files + PostgREST + edge functions). The frontend is ~3,300 lines of vanilla JS across 11 HTML pages and ~20 JS modules. No build step — files are served directly from S3.

The architecture is deliberately simple for AI agents, but three pain points have emerged: full page reloads on navigation, no component reuse (agents copy-paste boilerplate per page), and no build-time validation (agent errors surface only at runtime).

Astro SSG addresses all three while outputting the same static HTML/JS/CSS that Run402 serves today. The backend (schema, edge functions, PostgREST, RLS) is completely untouched.

## Goals / Non-Goals

**Goals:**

- SPA-like page transitions via Astro's `<ClientRouter />` (no full reloads)
- Shared layouts and components that agents compose rather than copy
- Build-time type checking for `.astro` files and Zod-validated API responses
- Preserve the runtime config-from-DB pattern (SQL changes take effect without rebuild)
- Preserve the Run402 deploy model (static files + functions + migrations)
- Maintain feature parity with the current vanilla implementation
- Keep the agent-friendly "one file per page" mental model

**Non-Goals:**

- SSR, Actions, or Server Islands (Run402 has no persistent server runtime)
- Changing the PostgREST API layer or database schema
- Adding new features (this is a rewrite, not an enhancement)
- React/Vue/Svelte islands (use vanilla `.astro` components + plain JS islands)
- Astro Content Collections for portal data (data lives in Postgres, not markdown files)
- Astro DB (we use Run402's Postgres)

## Decisions

### 1. SSG-only output mode with `build.format: 'file'`

Astro builds to static HTML/JS/CSS in `dist/`. Using `build.format: 'file'` outputs `dist/events.html` instead of `dist/events/index.html`, matching Run402's current URL structure.

**Why not SSR?** Run402 serves static files from S3. There's no persistent Node process. SSR would require hosting elsewhere (Cloudflare, Vercel) and splitting the stack. The benefits of SSR (Actions, Server Islands, middleware auth) aren't worth the infrastructure complexity — our JS payload is already tiny and auth is client-side.

**Why not `build.format: 'directory'`?** Run402 serves files at their exact path. `events/index.html` would need directory index resolution, which may not be configured. `events.html` works today and continues to work.

### 2. Runtime config, not build-time config

The `site_config` table is fetched at runtime by client-side JS, same as today. Theme CSS variables, nav structure, feature flags, and branding are all applied on page load from the DB.

**Alternative considered:** Fetch config at build time in `.astro` frontmatter. Rejected because: (a) config changes would require a rebuild, breaking the "80% customization via SQL" story; (b) every portal deploy would need a unique build, complicating Kychon Studio.

**Implementation:** A `ConfigProvider` island (`client:load`) runs early in the layout, fetches `site_config`, injects CSS vars, builds nav, and exposes config to other islands via a shared module.

### 3. Islands for interactivity, not framework components

Interactive elements (RSVP buttons, forum reply forms, admin editor, search/filter, auth flows) become `.astro` components with `client:*` directives. They use plain JS internally — no React, Vue, or Svelte.

**Hydration strategy per component:**

| Component | Directive | Rationale |
|-----------|-----------|-----------|
| ConfigProvider (theme, nav) | `client:load` | Must run immediately to avoid FOUC |
| Auth (OAuth, session) | `client:load` | Must check session before rendering |
| Search/filter (directory, resources) | `client:visible` | Only needed when scrolled into view |
| RSVP buttons | `client:visible` | Not above fold |
| Forum reply form | `client:visible` | Interactive but not urgent |
| Admin editor (Tiptap) | `client:idle` | Heavy; load after page settles |
| Toast notifications | `client:idle` | Triggered by actions, not immediate |
| Language switcher | `client:idle` | Low priority interaction |

### 4. Shared layout with slot-based composition

One primary layout — `Portal.astro` — wraps all portal pages:

```
Portal.astro
├── <head> (meta, theme.css, styles.css, env.js)
├── <ClientRouter /> (view transitions)
├── <Nav /> (static HTML, populated by ConfigProvider island)
├── <slot /> (page content)
├── <Footer />
├── <Toast client:idle />
├── <ConfigProvider client:load />
└── <AuthProvider client:load />
```

Pages become minimal:

```astro
---
import Portal from '../layouts/Portal.astro';
---
<Portal title="Events">
  <EventList client:load />
</Portal>
```

Agents adding a new page need ONE file with ONE layout import. No boilerplate to get wrong.

### 5. Zod schemas for API type safety

Define Zod schemas for PostgREST responses in `src/schemas/`:

```
src/schemas/
├── event.ts      (Event, EventRSVP)
├── member.ts     (Member, MemberTier)
├── forum.ts      (Category, Topic, Reply)
├── config.ts     (SiteConfig, Theme, NavItem)
└── index.ts      (re-exports)
```

The existing `api.js` wrapper gets typed variants:

```typescript
// src/lib/api.ts
import { z } from 'astro/zod';
import { EventSchema } from '../schemas/event';

export async function getEvents() {
  const data = await api.get('events?order=start_date.asc');
  return z.array(EventSchema).parse(data);
}
```

Build fails if the schema doesn't match the code that uses it. Agents get compile-time errors instead of runtime surprises.

### 6. i18n: Astro routing + existing t() function

Two layers working together:

- **Astro i18n routing** — generates locale-prefixed pages (`/es/events.html`, `/en/events.html`). Configured in `astro.config.mjs` with `prefixDefaultLocale: false` so English URLs stay clean (`/events.html`).
- **String translations** — the existing `t()` function and `strings/*.json` files are preserved. Loaded at runtime by the ConfigProvider island. No change to how translations work.

This is the pragmatic split: Astro handles routing, the existing system handles string lookup.

### 7. File structure mapping

```
CURRENT                          ASTRO
───────                          ─────
site/                            src/
  index.html                       pages/index.astro
  events.html                      pages/events.astro
  event.html                       pages/event.astro
  directory.html                   pages/directory.astro
  profile.html                     pages/profile.astro
  resources.html                   pages/resources.astro
  forum.html                       pages/forum.astro
  committees.html                  pages/committees.astro
  admin.html                       pages/admin.astro
  admin-members.html               pages/admin-members.astro
  admin-settings.html              pages/admin-settings.astro
  join.html                        pages/join.astro
  page.html                        pages/page.astro

  js/config.js (481 lines)        layouts/Portal.astro
                                   + components/ConfigProvider.astro
                                   + components/Nav.astro
  js/auth.js                       components/AuthProvider.astro
  js/api.js                        lib/api.ts
  js/i18n.js                       lib/i18n.ts
  js/events.js                     components/EventList.astro
                                   + components/EventCard.astro
  js/forum.js (515 lines)          components/Forum.astro
                                   + components/TopicList.astro
                                   + components/ReplyThread.astro
  js/admin-editor.js               components/AdminEditor.astro
  js/toast.js                      components/Toast.astro
  js/accessibility.js              components/A11yToolbar.astro
  js/animations.js                 (built into components)

  css/theme.css                    styles/theme.css
  css/styles.css                   styles/global.css
                                   + scoped styles in components

  custom/brand.json                public/custom/brand.json
  custom/strings/*.json            public/custom/strings/*.json

functions/                         functions/ (unchanged)
schema.sql                         schema.sql (unchanged)
seed.sql                           seed.sql (unchanged)
```

### 8. Deploy pipeline change

```
CURRENT:  deploy.js → collect site/ → app.json → run402 deploy
ASTRO:    deploy.js → astro build → inject env.js → collect dist/ → app.json → run402 deploy
```

deploy.js changes:
1. Add `execSync('npx astro build')` before file collection
2. Write `env.js` to `dist/js/` instead of `site/js/`
3. Change `collectFiles('site', 'site')` to `collectFiles('dist', 'dist')`

Everything else (functions, schema, seed, RLS, manifest) unchanged.

### 9. Dev server

`npm run dev` runs `astro dev` — Vite-based dev server with HMR, instant feedback. Currently there's no dev server (files are served statically or via a local HTTP server).

The dev server needs the PostgREST API. Options:
- Point at a deployed Run402 project's API (simplest, use a dev/staging project)
- `env.js` loaded as a public static file in `public/js/env.js` during dev

## Risks / Trade-offs

**[Build step adds latency to deploy]** → Astro builds are fast (typically 2-10s for a static site this size). Total deploy time goes from ~5s to ~15s. Acceptable.

**[Agents must learn `.astro` syntax]** → `.astro` files are HTML with a JS frontmatter block. Astro publishes `llms.txt` and `llms-full.txt`. Agent onboarding is reading STRUCTURE.md + CUSTOMIZING.md (which we update). Mitigated by the syntax being close to HTML.

**[View Transitions have browser support gaps]** → Astro's `<ClientRouter />` provides a polyfill. Falls back gracefully to full page loads in unsupported browsers.

**[config.js was a 481-line god module]** → Splitting it across layout + ConfigProvider + Nav + i18n lib is actually a risk reduction. But it must be done carefully to preserve the stale-while-revalidate caching and theme injection behavior.

**[Tiptap CDN loading changes]** → Currently loaded from esm.sh at runtime. In Astro, it can be an npm dependency bundled by Vite into the admin island, or kept as a dynamic import from esm.sh. Bundling is cleaner; CDN is lighter for non-admin builds. Decision: bundle via npm (simpler for agents).

**[Test migration could break coverage]** → All 205+ tests need import path updates. Run tests after migration to verify. Coverage thresholds stay at 85%.

## Open Questions

1. **Should `page.astro` (generic page renderer) use dynamic routing (`[slug].astro`) or keep the query param pattern (`page.astro?slug=about`)?** Dynamic routing is more Astro-idiomatic but requires knowing all slugs at build time (or SSR). Query param pattern works in SSG with client-side fetch. Leaning toward query param to stay SSG-compatible.

2. **How should i18n locale pages be generated?** Option A: Duplicate all pages under `src/pages/es/*.astro` (tedious, lots of files). Option B: Use Astro's `getStaticPaths()` to generate locale variants from a single page file. Option B is cleaner but needs exploration.

3. **Should marketing pages (`site/marketing/`) also move to Astro?** They're a separate static site. Could be a separate Astro project or pages in the same project under a different layout. Defer to a separate change.
