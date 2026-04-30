## Why

The `/copy-website` skill ported [olddominionboatclub.com](https://www.olddominionboatclub.com/) on 2026-04-30 and Kychon visibly fought ODBC's source: announcements feed appeared on the home page (source has no equivalent), nav was locked above the hero (source places it below), the footer rendered "Powered by Kychon on Run402" instead of the club's address strip. None of this is fixable from seed data alone — the chrome is in code, not data.

Today a Kychon page is part data, part code:

- `<main>` sections are composable rows in the `sections` table.
- `<header>`, `<nav>`, the homepage announcements feed, and `<footer>` are hard-coded in `src/layouts/Portal.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`, and `src/pages/index.astro`.

To represent any real org's site faithfully, the chrome has to be data too — and the renderer for chrome must be the same one that renders main sections, so the same composer (drag-reorder, inline edit, add/remove) governs the entire page.

This change rebuilds the layout substrate so every visible block on every page is a row in `sections`, the renderer is one isomorphic `renderBlock()` shared across build-time bake and runtime hydrate, the homepage announcements feed becomes an optional block, navigation moves out of `site_config.nav` into a `nav` block, and the footer "Powered by Kychon" line becomes one configurable block among five new footer types. There is no installed base to preserve back-compat for — the only constraint is that the three demos (eagles, silver-pines, barrio-unido) render as well as or better than they do today, which they will because they get re-seeded as part of this change.

This change folds in two GitHub issues that share the same root finding: [#51 G_LAYOUT](https://github.com/kychee-com/kychon/issues/51) (the substrate) and [#56 layout: configurable footer](https://github.com/kychee-com/kychon/issues/56) (the footer block toolkit that #51 enables). Sister issues [#52 nav children](https://github.com/kychee-com/kychon/issues/52) and [#53 hero foreground](https://github.com/kychee-com/kychon/issues/53) ship as separate, smaller proposals built on this substrate.

## What Changes

- **Schema.** Add `sections.zone` (`'header' | 'main' | 'footer'`, default `'main'`) and `sections.scope` (`'page' | 'global'`, default `'page'`) with CHECK constraints. One additive migration, fully back-compat at the column level.
- **Block-type registry.** New `src/lib/blocks.ts` defines `renderBlock(section): string` plus a registry mapping each `section_type` to `{ render, defaultConfig, label, icon, dynamic }`. The renderer returns HTML strings (not DOM nodes) so the same code runs at Astro build time (Node) and at runtime (browser).
- **Layout.** `Portal.astro` becomes three zones — header, main, footer — with chrome zones populated by the build-time bake (see below) and main rendering Astro's existing `<slot />`. `src/components/Nav.astro` and `src/components/Footer.astro` are deleted; their behavior moves into block renderers (`nav`, `brand_header`, `sign_in_bar`, `footer_*`).
- **Build-time bake.** New `src/seeds/{kychon,eagles,silver-pines,barrio-unido}.ts` modules export typed `Section[]` for each project. New `scripts/generate-seed-sql.ts` reads the active project's TS seed and writes `seed.sql` (which is now gitignored / generated). `Portal.astro`'s frontmatter imports the same TS seeds and bakes header/footer HTML inline at build time, so chrome paints instantly on first frame with no flicker. Runtime hydrate compares the baked HTML against the live DB and only mutates if they differ.
- **Single SQL for the page.** `index.astro` and `page.astro` switch from "fetch sections for this slug" to a single query that returns chrome + main in one round trip: `WHERE (page_slug = $slug AND scope = 'page') OR scope = 'global' ORDER BY zone, position`.
- **Nav becomes a block.** `site_config.nav` is dropped entirely. The seed places a `nav` block in `zone = 'header', scope = 'global'` whose `config.items` is the array that used to live in `site_config.nav`. `buildNav()` becomes the `nav` renderer; the existing `NavEditor` overlay becomes the `nav` block's edit popover. `#52 nav children` will extend this block's config in a follow-up.
- **Announcements feed becomes a block.** The hard-coded `<#announcements-section>` in `src/pages/index.astro` is removed. The seed inserts an `announcements_feed` block at `zone = 'main', scope = 'page', page_slug = 'index'`. Admins can delete or reposition it like any other block. The block is `dynamic: true` — bake produces a skeleton, JS hydrates from the announcements API.
- **Five new footer block types** (closes #56): `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`. The default `footer_attribution` block is the new home of the "Powered by Kychon" line, kept as a quiet default at the very bottom of every project's footer until an admin removes it.
- **Cross-zone drag.** The sortable engine in `src/components/AdminEditor.astro` is refactored from per-group to document-level. Admins can drag any block between header, main, and footer. Empty zones render a "Drop a block here" placeholder while admin drag is active. On drop into a different zone, the API PATCH updates `{ zone, position }` together. The migration is additive on top of the existing `data-sortable-*` attribute scheme.
- **Scope as an orthogonal property.** Drag changes `zone` and `position` only — never `scope`. The block edit popover gains a `GLOBAL` pill in the header when `scope = 'global'` and a `Make global` / `Make page-only` toggle. When an admin drops a `scope = 'page'` block into a chrome zone (header or footer), a tooltip offers a one-click "Make this appear on every page?" promotion.
- **Re-seeded demos.** `eagles`, `silver-pines`, and `barrio-unido` get their TS seed modules updated to express their full chrome (brand, nav, sign-in bar, footer address, copyright, attribution) as blocks. They re-deploy and render as well as or better than today.
- **ODBC port re-runnable.** As a validation gate, the `/copy-website` skill is re-run against ODBC; the resulting port at `odbc-port.run402.com` must show the nav below the hero, the announcements feed absent, and the footer carrying ODBC's address + copyright lines.

## Capabilities

### New Capabilities

- `composable-layout`: Every block on every page is a row in the `sections` table addressed by `(page_slug, zone, scope, position)`. One isomorphic `renderBlock()` registry serves both build-time bake and runtime hydrate. Admins compose pages — including chrome — via drag-reorder across zones, inline edit, and add/remove from a block-type picker.

### Modified Capabilities

- `database-schema`: Adds `zone` and `scope` columns to `sections`. Reframes seed data: TS seed modules under `src/seeds/` are canonical; `seed.sql` is generated at build time by `scripts/generate-seed-sql.ts`.
- `config-driven-ui`: The nav requirement no longer reads from `site_config.nav` — it reads from a `nav` block in `zone = 'header'`. The schema-driven sections requirement now spans every zone of every page (not just `page_slug = 'index'`). The hero parallax and stats counter requirements still apply but address blocks reached through the new render path.

## Impact

- **New files**: `src/lib/blocks.ts` (block-type registry, ~600 LOC), `src/seeds/types.ts`, `src/seeds/{kychon,eagles,silver-pines,barrio-unido}.ts`, `scripts/generate-seed-sql.ts`.
- **Modified files**: `src/layouts/Portal.astro` (zones + bake), `src/pages/index.astro` (drop hard-coded announcements feed; use `renderBlock`), `src/pages/page.astro` (use `renderBlock`), `src/components/AdminEditor.astro` (multi-group sortable + scope UI), `src/lib/config.ts` (drop `buildNav()`; nav rendering moves to the `nav` block renderer), `schema.sql` (idempotent ALTER for `zone` + `scope`), `package.json` (`build` script chains `generate-seed-sql` before `astro build`).
- **Deleted files**: `src/components/Nav.astro`, `src/components/Footer.astro`, `seed.sql` (becomes generated, gitignored).
- **Dependencies**: None new. Bake uses Astro's existing build-time TS execution; runtime hydrate uses existing fetch + DOM APIs.
- **RLS**: No changes — `sections` already has `public_read` and authenticated writes for admins; new columns inherit those policies.
- **Bundle impact**: `src/lib/blocks.ts` is shared between build-time bake (Node) and runtime hydrate (browser). The browser bundle picks up only the renderers it needs via tree-shaking; net change vs today's inline switch statements is roughly neutral.
- **Demo deploys**: All three demos re-deploy with TS-seeded chrome blocks. Visual parity confirmed via Chrome MCP walkthrough; ODBC re-port confirmed via `/copy-website` skill rerun.
- **Out of scope (separate proposals)**: `#52 nav children` (extends the new `nav` block's `config.items` schema with `children: [...]`), `#53 hero foreground mode` (extends the existing `hero` block's `config` with `mode: 'foreground' | 'background'`).
