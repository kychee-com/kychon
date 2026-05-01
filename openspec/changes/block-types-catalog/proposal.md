## Why

The `/copy-website` skill ported [olddominionboatclub.com](https://www.olddominionboatclub.com/) on 2026-04-30 against the substrate composable-layout introduces. Six block-type gaps surfaced from that port — visible-on-the-rendered-site mismatches that the skill couldn't fix because the source patterns simply don't exist in Kychon's block registry:

- **Promo cards** (G3): the canonical 4-up image-card grid linking to Membership / Events / Store / Tap Room — the most distinctive section of the homepage and the primary navigation channel for non-member visitors.
- **Events list** (G4): an "UPCOMING EVENTS" sidebar listing the next four events with title + date + location, rendered alongside the main hero column.
- **Slideshow** (G6): two carousels running in parallel — gallery photos + event flyers — auto-rotating on a timer.
- **Link list** (G9): a "News Updates" panel with curated bullet links to PDFs and meeting minutes, the "what's new from leadership this week" surface.
- **Tagline strip** (G10): a dark full-width band reading "A Proud Part of Alexandria's History Since 1880" — heritage branding between functional sections.
- **Page banner** (G11): per-page banner images at the top of every interior page (Marina, About, Foundation) — visual continuity across the site.

These six are all schema-additive on the [composable-layout](../composable-layout/proposal.md) substrate — each is a new entry in the `BLOCK_TYPES` registry. They share the same pattern (renderer + defaultConfig + admin UI + ODBC verification) but vary in renderer complexity from trivial (`tagline_strip`, ~30 lines) to medium (`slideshow`, ~150 lines including vanilla JS rotation).

This change is the "fill in the toolkit" pass that follows composable-layout: once the substrate is live, six new block types make Kychon capable of representing the canonical Wild Apricot member-org homepage faithfully. Closes [#54 promo_cards](https://github.com/kychee-com/kychon/issues/54), [#55 events_list](https://github.com/kychee-com/kychon/issues/55), [#57 slideshow](https://github.com/kychee-com/kychon/issues/57), [#60 link_list](https://github.com/kychee-com/kychon/issues/60), [#61 tagline_strip](https://github.com/kychee-com/kychon/issues/61), [#62 page_banner](https://github.com/kychee-com/kychon/issues/62).

`embed` (#59) is excluded here and lives in its own [embed-block](../embed-block/proposal.md) proposal because of its security envelope (CSP, iframe sandboxes, provider registry).

## What Changes

- **Six new entries in `BLOCK_TYPES`** in `src/lib/blocks.ts`, each with `render`, `defaultConfig`, `label`, `icon`, `dynamic`, optional `zoneHints`. No schema migration; this is config-additive at the data layer.
- **`promo_cards`** — CSS-Grid responsive card grid, 2/3/4 columns. Each item: `image_url`, `image_alt`, `title`, `title_position` (`'top' | 'bottom'`), `cta_text`, `cta_href`, optional `overlay_color`. Whole card is one `<a>`; CTA button is visual reinforcement, not a separate link. Required `image_alt` per item with a build-time warning if missing.
- **`events_list`** — `dynamic: true`. Three layouts: `sidebar` (vertical card list), `grid` (responsive 3-up cards), `list` (compact rows). Filters: `upcoming` (default), `past`, `featured`, `this_week`. Configurable `count`, `show_image`, `show_location`, `show_time`, `color_scheme`. Times render in visitor's local timezone. Empty state hides the section entirely; loading skeleton during fetch.
- **`slideshow`** — vanilla-JS auto-rotating carousel, ≤4kB inline JS. Pause on hover/`:focus-within`/`document.visibilityState !== 'visible'`. Honors `prefers-reduced-motion: reduce`. Arrow keys navigate when focused. Dots are clickable + screen-reader-announced via `aria-live="polite"`. Lazy-loads off-screen images.
- **`link_list`** — two source modes. `'manual'`: hand-curated `items[]`. `'resources'`: pulls latest N from `resources` table filtered by category, `dynamic: true`. Three layouts: `bullets`, `rows` (with date column), `compact` (inline pills). Optional per-item `badge` (`'PDF'`, `'NEW'`, `'MEMBERS'`), `external` flag, `date`.
- **`tagline_strip`** — pure HTML+CSS, no JS. Full-width band with single centered text line. Four `color_scheme` values mapping to existing CSS custom-prop sets: `dark`, `light`, `primary`, `accent`. Optional inline icon. Vertical padding via `size` (`small`/`medium`/`large`).
- **`page_banner`** — per-page banner image rendered as a page-scoped block in `zone='header', scope='page'`. Config: `image_url`, `image_alt`, `caption_html` (sanitized like hero foreground caption), `height` (`'small'`/`'medium'`/`'large'`/`'auto'`), optional `overlay_color`. The "Path B" approach from the issue — uses composable-layout's substrate rather than adding columns to `pages`.
- **Demo updates.** Each demo (eagles, silver-pines, barrio-unido) gains at least three new block types in its TS seed to exercise the new types and validate the rendering on real devices: silver-pines gets a `promo_cards` row + `events_list` sidebar + `tagline_strip`; eagles gets a `page_banner` on its About page + a `slideshow` on its home; barrio-unido gets a `link_list` (resources-mode) for sermon archives + a `tagline_strip`.
- **ODBC port re-validation.** Re-running `/copy-website` against ODBC after this change should produce a homepage faithful to the source: 4-up promo cards, events sidebar, two side-by-side slideshows (the side-by-side requires [G_GRID](https://github.com/kychee-com/kychon/issues/65) — to be filed; tracked separately).

## Capabilities

### Modified Capabilities

- `composable-layout`: extends the `BLOCK_TYPES` registry with six new entries. The catalog requirement that already enumerates the registry's contents grows; per-block rendering requirements are added per type.

## Impact

- **New files**: none beyond the registry extensions in `src/lib/blocks.ts`. Optional `public/css/blocks-{slideshow,promo-cards,etc}.css` files if styles balloon; v1 keeps everything in the existing CSS files.
- **Modified files**: `src/lib/blocks.ts` (six new registry entries), `src/components/AdminEditor.astro` (block picker reflects new options; per-block edit popovers handle the new config schemas), `src/seeds/{eagles,silver-pines,barrio-unido}.ts` (demo content updates), `tests/blocks-{type}.test.ts` (one test file per new type).
- **Dependencies**: none new. Slideshow uses native DOM APIs only.
- **Bundle impact**: ~5kB total renderer code across all six types (template-literal HTML strings, mostly inline). ~4kB inline slideshow JS, loaded only when a slideshow block is present (deferred via `data-block-hydrate="slideshow"`). ~2-3kB CSS for slideshow + promo_cards layouts.
- **Hard dep**: ships only after [composable-layout](../composable-layout/proposal.md) lands. Without the substrate, there is no `BLOCK_TYPES` registry to extend.
- **Soft dep**: side-by-side rendering of two slideshows or events-sidebar-next-to-main requires [G_GRID](https://github.com/kychee-com/kychon/issues/65) (to be filed). Each block in this proposal renders correctly stacked vertically; horizontal layout is a separate substrate addition.
