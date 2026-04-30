## Context

Kychon's three demos (eagles, silver-pines, barrio-unido) are the only deployed instances. There are no real users yet. The `/copy-website` skill exercise on 2026-04-30 against [olddominionboatclub.com](https://www.olddominionboatclub.com/) surfaced that the engine's hard-coded chrome — header, nav, homepage announcements feed, footer — can't represent real org sites' layouts. The fork required to fix it was visible at four levels (announcements appearing where the source has nothing; nav locked above the hero where the source places it below; footer fixed at "Powered by Kychon" instead of the club's address strip) but the underlying root cause is single: chrome is in code.

Key constraints driving this design:

- **Astro SSG with `build.format: 'file'`.** All pages are static HTML at build time, hydrated client-side. Build-time work happens in Astro frontmatter (Node) or in a pre-build script. Runtime work happens in `<script>` blocks.
- **PostgREST PATCH replaces JSONB columns.** A single change to a block's config requires read-modify-write, which `AdminEditor` already handles for `data-editable-json` paths via `data-editable-config` snapshots ([AdminEditor.astro:330+](src/components/AdminEditor.astro)).
- **Existing in-flight change `admin-inline-editing` is at task 6.2 (visual verification).** Its single-group sortable engine is the foundation we extend to multi-group. Its `data-editable-*` attribute scheme already supports JSONB paths and is used by every existing block-type renderer.
- **Three-layer cache pattern from `config-driven-ui` is the right model for chrome.** `site_config` already paints from localStorage cache before the network responds; chrome blocks should follow the same pattern, with build-time bake adding a fourth layer below the cache.
- **Run402 deploy is `npx tsx scripts/deploy.ts` invoking `r.deploy.apply()`.** Adding a pre-build step to generate `seed.sql` from TS modules is straightforward; the deploy itself doesn't need to change.

## Goals / Non-Goals

**Goals:**

- Every block on every page is a row in `sections`. No chrome is hard-coded in `.astro` files.
- One `renderBlock()` registry serves both build-time bake and runtime hydrate.
- `seed.sql` is generated from typed TS seed modules; type errors in seeds are caught at build time, not deploy time.
- Chrome paints instantly on first frame (build-time bake) with no flicker, even on cold visits with empty localStorage.
- Admins compose entire pages — including chrome — using the existing block-type composer (drag, edit, add, remove).
- Cross-zone drag works: a block can move from main to footer or vice versa.
- `scope` (page vs global) is a separate, explicit property, not a side effect of which zone a block lives in.
- The three demos render as well as or better than today after re-seeding.
- The ODBC port re-runs end-to-end via `/copy-website` and produces a faithful render (nav below hero, no announcements feed, ODBC footer).

**Non-Goals:**

- **Multi-page builder UI.** Admins compose one page at a time. Cross-page templates (e.g. "create a new page from this template") are out of scope.
- **Block-type plugin system.** The block registry is a TS module — extending it requires a code change, not a runtime plugin install. Custom block types are a forking concern, not a runtime customization concern.
- **A/B testing or draft/publish.** Live edit, save immediately. Demo hourly resets remain the safety net.
- **Full back-compat with the pre-change `site_config.nav` shape externally.** Internal forks would have to migrate; we have no external forks to worry about.
- **Animated chrome transitions.** Chrome is `transition:persist` — it stays put across SPA nav. Block animations within zones (the existing scroll-in animation for main sections) are unchanged but not extended to chrome.

## Decisions

### 1. `zone` and `scope` as orthogonal columns on `sections`

**Decision**: Two new columns, both with CHECK constraints and safe defaults:

```sql
DO $$ BEGIN
  ALTER TABLE sections ADD COLUMN zone TEXT NOT NULL DEFAULT 'main'
    CHECK (zone IN ('header', 'main', 'footer'));
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE sections ADD COLUMN scope TEXT NOT NULL DEFAULT 'page'
    CHECK (scope IN ('page', 'global'));
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sections_zone_scope_slug ON sections (zone, scope, page_slug, position);
```

**Why**: The four-tuple `(page_slug, zone, scope, position)` fully addresses any block's render location. `zone` is geometry (which container does this paint into); `scope` is reach (does this block apply to one page or every page). They're independent: a global block can live in any zone (a global header is typical, but a global hero is also valid for a marketing-style site); a page-scoped block can live in any zone (a per-page nav override is a real use case). Combining them into a single column conflates two unrelated decisions and forces awkward UI. Keeping them separate makes the cross-zone drag question (zone changes) and the global toggle question (scope changes) two independent, non-confusing actions.

**Why CHECK and not ENUM**: CHECK constraints are easier to extend (add a value with one ALTER) and don't require a separate type ALTER step. Three values aren't a long list.

### 2. The single SQL query

**Decision**: Every page renders from one query:

```sql
SELECT *
FROM sections
WHERE (page_slug = $current_slug AND scope = 'page')
   OR scope = 'global'
ORDER BY zone, position;
```

**Why**: One round trip instead of N. Today's code does separate fetches for sections-on-this-page; chrome (currently hard-coded) does no fetch but `site_config` does its own fetch. Collapsing into one query simplifies the renderer, reduces TTFB-to-content, and makes the zone-grouped result trivially renderable: split by `zone` field, render each group into its container.

**Index**: `(zone, scope, page_slug, position)` covers the WHERE clause and the ORDER BY without sorting on the client.

**Caveat**: This query returns blocks for all three zones. The renderer is responsible for splitting by zone and dispatching to the right container. That's a few lines of grouping logic; the alternative (three queries, one per zone) is worse.

### 3. `renderBlock()` returns HTML strings, not DOM nodes

**Decision**: New `src/lib/blocks.ts`:

```ts
export interface BlockRenderContext {
  admin: boolean;
  locale: string;
  // anything else needed by all renderers — kept small
}

export interface BlockType {
  render: (section: Section, ctx: BlockRenderContext) => string;
  defaultConfig: Record<string, unknown>;
  label: string;
  icon: string;
  dynamic: boolean;        // true = bake skeleton, JS hydrates from API at runtime
  zoneHints?: ('header' | 'main' | 'footer')[]; // suggested zones in the picker
}

export const BLOCK_TYPES: Record<string, BlockType> = { /* ... */ };

export function renderBlock(section: Section, ctx: BlockRenderContext): string {
  const type = BLOCK_TYPES[section.section_type];
  if (!type) return '';
  return type.render(section, ctx);
}
```

**Why string and not DOM**: The renderer must run at build time (Node, in Astro frontmatter) for the chrome bake AND at runtime (browser) for hydration. Strings are universally portable; DOM APIs aren't (no `document` in Node without a polyfill, and `happy-dom`/`jsdom` for build-time would be infrastructure we don't need). Today's renderers in [index.astro:117+](src/pages/index.astro#L117) already use template literals — moving them into `blocks.ts` is mostly relocation.

**Dynamic blocks**: `polls`, `activity_feed`, `announcements_feed` need API data the bake doesn't have. Their `render()` returns a skeleton (`<div class="skeleton" data-block-hydrate="polls">…</div>`) and a separate `hydrate(el, ctx)` function (called only at runtime) replaces the skeleton with real content. This is the pattern today — we're just formalizing it.

**Event handlers**: Bake produces inert HTML. After bake injection or runtime DOM replacement, `AdminEditor.bindEditableElements()` and the various poll/activity hydrators wire up handlers. The `wl-content-rendered` event already exists for this purpose.

### 4. Build-time bake from typed TS seed modules

**Decision**: Seeds become typed TS modules under `src/seeds/`:

```ts
// src/seeds/types.ts
export interface SeedSection {
  page_slug: string;
  zone: 'header' | 'main' | 'footer';
  scope: 'page' | 'global';
  section_type: string;
  config: Record<string, unknown>;
  position: number;
  visible?: boolean;
}

export interface ProjectSeed {
  site_config: Record<string, unknown>;
  sections: SeedSection[];
  membership_tiers?: TierSeed[];
  pages?: PageSeed[];
  // …
}
```

```ts
// src/seeds/eagles.ts
import type { ProjectSeed } from './types';

export const seed: ProjectSeed = {
  site_config: { /* … */ },
  sections: [
    { page_slug: '*', zone: 'header', scope: 'global', section_type: 'brand_header',
      config: { /* … */ }, position: 1 },
    { page_slug: '*', zone: 'header', scope: 'global', section_type: 'nav',
      config: { items: [/* … */] }, position: 2 },
    { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'hero',
      config: { /* … */ }, position: 1 },
    // …
    { page_slug: '*', zone: 'footer', scope: 'global', section_type: 'footer_attribution',
      config: { text: 'Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)' },
      position: 99 },
  ],
};
```

A pre-build script `scripts/generate-seed-sql.ts` reads the active project's seed module (selected via `KYCHON_PROJECT` env var, defaulting to `kychon`) and emits `seed.sql`. `seed.sql` is gitignored. `package.json`'s `build` chains it: `"build": "tsx scripts/generate-seed-sql.ts && astro build"`.

**Why TS over JSON (Option B from explore)**: type-safety on every config object. Block schemas evolve (new fields, renamed fields); breaking a seed becomes a build error, not a deploy-time SQL failure. IDE refactors propagate. The "JSON portability" argument doesn't apply — we have no external consumers; seeds are an internal artifact.

**Why `page_slug = '*'` for global**: lets a single seed entry express "this lives on every page." `scope = 'global'` is the renderer-side rule; `page_slug = '*'` is a seed-time convention that the generator translates into per-page rows OR — better — a single row that the renderer matches against every page. Keep the single-row approach: `WHERE … OR scope = 'global'` already handles the broadcast in the runtime query, and the bake reads global blocks once and embeds them in every page's HTML.

**Why generated `seed.sql` and not direct DB writes from TS**: Run402's `r.deploy.apply()` takes `seed.sql` content. We follow the existing contract; we just generate that content from a typed source instead of hand-writing it.

### 5. The bake itself

**Decision**: `Portal.astro` frontmatter:

```astro
---
import { getActiveProjectSeed } from '../seeds';
import { renderBlock } from '../lib/blocks';

const seed = getActiveProjectSeed(); // resolves KYCHON_PROJECT env
const ctx = { admin: false, locale: 'en' }; // bake context: never admin, default locale

const headerHtml = seed.sections
  .filter(s => s.zone === 'header')
  .sort((a, b) => a.position - b.position)
  .map(s => renderBlock(s, ctx))
  .join('');

const footerHtml = seed.sections
  .filter(s => s.zone === 'footer')
  .sort((a, b) => a.position - b.position)
  .map(s => renderBlock(s, ctx))
  .join('');
---
<!DOCTYPE html>
<html>
  <head>…</head>
  <body>
    <div id="zone-header" data-zone="header" set:html={headerHtml} transition:persist></div>
    <main id="main-content" class="page-content"><slot /></main>
    <div id="zone-footer" data-zone="footer" set:html={footerHtml} transition:persist></div>
    <!-- … providers, AdminEditor, scripts -->
  </body>
</html>
```

**Why bake header and footer but not main**: Chrome is the same on every page (modulo per-page overrides, handled at runtime). Baking it inline gives instant first paint on cold visits. `<main>` content varies per page and is already handled by each page's existing render path; baking it would require the bake to know every page's content, which is more infra than the win warrants.

**`set:html` and trust**: The bake source is our own TS seed, not user input. `set:html` is appropriate.

**`transition:persist` on zone wrappers**: SPA navigation between Astro pages preserves the zone wrappers; their inner content is replaced by runtime hydration only when the live DB differs from the bake. This is the same approach Nav.astro/Footer.astro use today.

### 6. Runtime hydrate flow

**Decision**: On every page load:

```ts
// src/lib/blocks.ts (runtime side)
export async function hydratePage(slug: string) {
  const cached = readCache(slug);              // localStorage layer
  const fresh = await fetchSections(slug);     // network layer
  writeCache(slug, fresh);

  for (const zone of ['header', 'main', 'footer'] as const) {
    const container = document.getElementById(`zone-${zone}`);
    if (!container) continue;

    const blocks = fresh.filter(s => s.zone === zone).sort(byPosition);
    const newHtml = blocks.map(s => renderBlock(s, ctx)).join('');

    if (newHtml !== container.innerHTML) {
      container.innerHTML = newHtml;
    }
  }

  hydrateDynamicBlocks();   // wires up polls, announcements_feed, activity_feed
  bindAdminEditing();       // wires up data-editable-* handlers if admin
}
```

**Layer order on cold visit**: bake → DB. localStorage is empty.
**Layer order on warm visit**: bake → cache (instant override if cache differs) → DB.
**Layer order on admin-edit-then-navigate**: optimistic DOM update → cache update → PATCH → on next page load, cache reads as fresh.

**Why compare HTML and skip mutation when equal**: avoids needless reflow on every nav. The bake matches DB ~100% of the time on freshly-deployed projects, so most navigations skip the zone replacement entirely.

**Why one fetch and not separate per-zone**: see Decision 2.

### 7. Nav-as-block, kill `site_config.nav`

**Decision**: `site_config.nav` is removed entirely. The seed inserts a `nav` block in `zone = 'header', scope = 'global'`. The block's `config.items` is the same array shape the old `site_config.nav` held. `buildNav()` in `src/lib/config.ts` is deleted; its logic moves into the `nav` renderer in `blocks.ts`. The existing `NavEditor` overlay (from `admin-inline-editing` tasks) is rebound as the `nav` block's edit popover — same UX, different storage path.

**Why the cleaner break**: With no installed base, preserving `site_config.nav` as a fallback is dead weight. Two storage paths for the same data invite drift. The block edit popover replaces the special-case nav editor with a uniform mechanism (every block has an edit popover; nav is just one).

**Migration**: zero-downtime irrelevant — we re-seed all three demos as part of this change. The TS seed for each demo includes the `nav` block; `seed.sql` regenerates from there.

**`#52 nav children` follow-up**: extends the `nav` block's `config.items` schema with optional `children: [...]` arrays. Independent of this change; the substrate is ready for it on day one.

### 8. Cross-zone drag

**Decision**: Refactor `AdminEditor.astro`'s sortable engine from per-group to document-level:

- Drag handlers attach once at `document` level, not per `[data-sortable-group]`.
- `dragstart` records the source zone from `el.closest('[data-zone]')`.
- `dragover` tracks the current target zone from the event target's `closest('[data-zone]')`.
- The drop indicator can render across any zone container.
- On drop into a different zone: PATCH `{ zone: <target>, position: <new> }` together. If the target zone is empty, position becomes 1.
- Empty zones get a "Drop a block here" placeholder rendered only while `document.body.classList.contains('admin-dragging')`.

**Why one document-level handler**: simpler than coordinating drop targets across multiple containers. Each zone container still has `data-zone` so the dispatch logic is direct.

**Optimistic UI**: move the element in the DOM immediately on drop, PATCH async, revert on failure with a toast. Same pattern as today's single-group reorder.

**Limit**: only blocks live in zones — the engine doesn't move arbitrary elements. `[data-sortable-id]` constraint is unchanged.

### 9. Scope as an orthogonal property, not a drag side-effect

**Decision**: Drag changes `zone` and `position` only. `scope` is changed via the block edit popover, where:

- A `GLOBAL` pill renders in the popover header when `section.scope === 'global'`.
- A toggle `Make global` / `Make page-only` flips `scope`. Confirmation toast describes the consequence ("Saved — appears on all pages" / "Saved — appears on this page only").
- When an admin drags a `scope = 'page'` block into a chrome zone (header or footer), a transient tooltip surfaces above the dropped block: `"This now appears here only. Make it appear on every page?"` with a `Make global` button. Click promotes scope; ignore leaves it page-scoped. The tooltip auto-dismisses after 5 seconds.

**Why orthogonal**: scope and zone solve different problems. Auto-flipping scope on cross-zone drop is presumptuous (per-page chrome overrides are valid — e.g., a different nav on a marketing landing page). Always preserving page scope is invisible (admins drop into footer, get confused why it doesn't appear elsewhere). The tooltip threads the needle: predictable default, discoverable promotion.

**Why a `GLOBAL` pill**: an admin editing the footer copyright on `/page.html?slug=about` is editing a row that affects every page. Without a visible pill, this is a foot-gun. The pill plus the save toast ("Saved — appears on all pages") makes the model legible exactly when stakes are high.

### 10. Announcements feed becomes a `dynamic: true` block

**Decision**: New block type `announcements_feed`. Renderer emits a skeleton (`<div data-block-hydrate="announcements_feed"><!-- skeleton cards --></div>`). Runtime hydrator (`hydrateAnnouncementsFeed(el)`) fetches `announcements?…` and replaces the skeleton with real cards, including admin create/pin/delete handlers.

**Why a block, not chrome**: announcements are main content, not chrome. They belong in `zone = 'main', scope = 'page', page_slug = 'index'` by default seeding. Calling them chrome (as the GitHub issue's first cut suggested) was a quirk of "we hard-coded it in `index.astro`," not a design intent.

**Effect**: admins can delete the announcements feed on a club site that doesn't want one. They can drag it to other pages. They can hide it. None of this is possible today.

### 11. Five footer block types

**Decision**: New block types, all `dynamic: false`:

| Block type | Config keys |
|---|---|
| `footer_address` | `name`, `address_lines[]`, `phone`, `email`, `hours` |
| `footer_links` | `columns[]` where each column is `{ heading, items: [{ label, href }] }` |
| `footer_copyright` | `year` (`'auto'` or string), `org_name`, `admin_contact_label`, `admin_contact_href` |
| `footer_social` | `icons[]` where each icon is `{ platform, href }` (platform is one of a known set: facebook, instagram, x, etc.) |
| `footer_attribution` | `text` (markdown-link friendly) — defaults to `"Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)"` |

**Default seeding**: every demo's seed includes a `footer_attribution` block at high position (paint it last in the footer). Other footer blocks are added per project as needed; the kychon template ships with just attribution.

**Year auto**: `year: 'auto'` → renderer emits `<span data-year="auto">…</span>`. A small inline script sets the current year once on page load (no hydration round trip). Same pattern works at build time (frontmatter) so the bake is correct.

## Risks / Trade-offs

### A. Build-time bake adds infrastructure

The seed-generator + Layout bake is ~150 lines of new build pipeline code. Trade-off: in exchange we get instant chrome on cold visits — a perceptible UX win, especially on slow networks. Without bake, the alternative is a localStorage-only cache that has to fall back to a skeleton on first-ever visit.

### B. The TS seed module is now load-bearing

Forking Kychon now requires editing TS, not just SQL. Mitigation: each `src/seeds/{project}.ts` is small (~50–150 lines), well-typed, with comments. The block registry's `defaultConfig` provides starting points for any block. We document the seed module shape in `STRUCTURE.md` (out of scope for this change but a follow-up).

### C. The block registry becomes a god-module

`src/lib/blocks.ts` will be the longest module in `src/lib/`. Trade-off: it's the single source of truth for "what blocks Kychon supports," which is a deliberate centralization. Splitting into `src/lib/blocks/{nav,hero,footer-address,…}.ts` is a refactor we can do once it's bothering us, not preemptively.

### D. Cross-zone drag introduces drag complexity not all admins will need

Most admins will never drag chrome between zones. Trade-off: the engine becomes ~80 lines more complex for an edge case. But the alternative ("move to header / main / footer" menu items) feels worse — it surfaces zone as a UI concept admins have to mentally track, while drag makes it spatial and obvious.

### E. The bake and the live DB can diverge

If an admin edits chrome on a deployed project, the bake (frozen at build time) is now stale. The runtime hydrate detects this, replaces the zone HTML, and writes to localStorage — but the gap between cold-paint (bake) and hydrate (DB) is visible if the divergence is large. Trade-off: cold paint is instant but stale, then snaps to fresh; this is the same pattern as `site_config` cache today. Acceptable.

### F. Empty-zone placeholder UX

When admin drags out the last block in a zone, the zone becomes invisible. The "Drop a block here" placeholder needs to render *only during admin drag* — otherwise we'd show admin-only drop targets to non-admins. Implementation: a body-level `admin-dragging` class toggled by `dragstart` / `dragend`, scoped CSS `body.admin-dragging [data-zone]:empty::before { content: 'Drop here'; … }`. Self-contained.

### G. `transition:persist` interaction

Astro's view transitions persist the zone wrapper across navigations but the inner HTML can be replaced. We need to ensure runtime hydrate's `innerHTML` replacement happens after `astro:after-swap` so it doesn't fight the transition. The hydrate flow already keys off `astro:after-swap`; this is a documented pattern.

### H. The `announcements_feed` block's poll/dynamic dependencies

The current `index.astro` `renderAnnouncements()` fetches polls per announcement. As a block, that logic moves into `hydrateAnnouncementsFeed()`. The dependency on `feature_polls` flag and on the polls API persists; we're relocating, not redesigning.

## Migration / Rollout

This is a clean cutover, not a phased migration. We have three demos and no users.

1. Land the schema migration (zone + scope + index).
2. Land the blocks library + TS seed modules + seed-generator.
3. Land the Portal.astro bake + runtime hydrate.
4. Land the AdminEditor multi-group sortable + scope UI.
5. Re-seed each demo (eagles, silver-pines, barrio-unido) with chrome blocks. Re-deploy each.
6. Visual verify every demo via Chrome MCP.
7. Re-run `/copy-website` against ODBC; verify the port renders the source faithfully.
8. Delete `Nav.astro`, `Footer.astro`, `buildNav()`, all references to `site_config.nav`.

The order matters: schema first (forward-compatible — old code still works because new columns have safe defaults), then blocks library (additive), then bake (replaces the HTML output of Layout but the runtime path still works against the existing DB), then admin tooling (additive). Each phase is deployable in isolation.
