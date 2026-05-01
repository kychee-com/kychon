## Why

The composable-layout substrate (just archived) puts every visible block on every page in `sections` as a row addressed by `(page_slug, zone, scope, position)`. But every block today still occupies the full width of its zone — the layout is a single flat column. The 2026-04-30 ODBC port surfaced concrete topologies the substrate cannot yet express:

- An events sidebar (`events_list` block at ~33% width) sitting next to the main column (~66%).
- Two slideshows side-by-side, each at 50% width.
- Three-up rows of half-/third-width announcement cards or feature blocks.

The substrate is one fix away from carrying these layouts: a per-row `column_span` value that tells the renderer how wide a block should be inside its zone. CSS Grid handles the math at runtime; everything else (drag, edit, zone moves, scope toggles) keeps working because columns are a property of a row, not a separate row type.

This change adds that property, wires zones to render as a 6-column grid, and lets admins pick a span on the block edit popover. It deliberately stops short of nested rows / wrapper "row" blocks (Path B) — Path A is enough to render every layout the ODBC port and the three demos need today, and Path B can be added later as a separate change if a real port comes in that Path A can't express. Issue [#65](https://github.com/kychee-com/kychon/issues/65) names that exit criterion.

## What Changes

- **Schema.** Add `sections.column_span` (`TEXT NOT NULL DEFAULT '1' CHECK (column_span IN ('1','1/2','1/3','2/3'))`). One additive idempotent ALTER on top of the substrate.
- **Seed type extension.** `SeedSection` gets an optional `column_span?: ColumnSpan` field. Generator emits the column with `'1'` when omitted, full value when set.
- **Zone rendering.** The main-zone host (`#sections` if present, else `#main-content`) and the footer-zone container become `display: grid; grid-template-columns: repeat(6, 1fr)` on desktop. The header zone keeps its existing flex layout because chrome (brand+nav+sign-in-bar) is naturally horizontal — overriding it with grid would break the nav. Each block in a grid-rendered zone carries `data-column-span` and a CSS rule maps it to a `grid-column: span N` declaration (`'1'` → 6 columns, `'1/2'` → 3, `'1/3'` → 2, `'2/3'` → 4). On tablet (`<= 900px`) the grid drops to 4 columns; on mobile (`<= 600px`) it collapses to 1 column so all blocks stack.
- **Renderer post-process.** `renderBlock` wraps the rendered HTML once (server-agnostic regex on the leading tag) to attach `data-column-span="{value}"` to the outermost element. This keeps the change to `blocks.ts` as a single edit instead of touching every BlockType.render.
- **`supportedSpans` per BlockType.** Each block declares which spans make sense (`['1']` for hero/CTA/announcements full-width, `['1','1/2','1/3','2/3']` for stats/features/testimonials/event_countdown). The picker and span radio surface only the supported choices.
- **Span radio in popover.** The block edit popover (added per-block via `[data-section-edit]`) gets a span radio matching `supportedSpans`. Picking a span PATCHes the row's `column_span` and re-renders the zone. Today's popover doesn't yet exist as a generic per-block surface; this change introduces the minimum needed for the radio (a small "Edit block" affordance per block that opens a popover with span + remove + scope toggle, replacing the inline scope toggle/remove buttons rendered in `adminWrap`).
- **Drag indicator span-aware.** When a block is being dragged, the drop indicator's width matches the dragged block's column span instead of always spanning full-width — visual feedback that doesn't lie.
- **Demo updates.** Each demo seed sets `column_span` on blocks that should sit side-by-side. Coordinated with `block-types-catalog`'s seed edits (their new blocks get spans; ours don't depend on theirs landing first because we use the existing block set).
- **ODBC port re-validation.** With the substrate plus this change, the `/copy-website` skill's port should now produce the events sidebar layout and the side-by-side slideshows the source has. Skill availability TBD per machine; the outcome is the test, not the run command.

## Capabilities

### Modified Capabilities

- `database-schema`: Adds a `column_span` column to `sections` with CHECK constraint and idempotent ALTER.
- `composable-layout`: Adds zone CSS Grid + per-block `data-column-span`, `BlockType.supportedSpans`, span radio in the block edit popover, span-aware drag indicator. The four-tuple-addressed substrate is unchanged; this is a per-row property layered on top.

## Impact

- **New files**: optional `public/css/zone-grid.css` (or zone-grid rules added to `styles.css`); per-change OpenSpec deltas under `openspec/changes/column-span-rows/specs/`.
- **Modified files**: `schema.sql` (one additive ALTER block at the bottom), `src/seeds/types.ts` (new optional field), `scripts/generate-seed-sql.ts` (emit `column_span`), `src/lib/blocks.ts` (add `supportedSpans` to each BlockType + post-process in `renderBlock`), `src/components/AdminEditor.astro` (span radio in popover, drag-indicator width hint), `public/css/styles.css` or new `public/css/zone-grid.css`, demo seed modules under `src/seeds/{eagles,silver-pines,barrio-unido}.ts`.
- **No deletions.**
- **Bundle impact**: small — CSS rules + a regex post-process + a few popover lines. No new runtime dependencies.
- **RLS**: no change; `column_span` inherits the existing `sections` policies.
- **Demo deploys**: re-run `bash deploy-all.sh` after seeds are updated; verify side-by-side rendering survives mobile collapse.
- **Out of scope (deferred per #65)**: a `row` block with nested column children (Path B). Triggered only when a real port surfaces a layout topology Path A cannot express.

## Non-Goals

- **No nested rows / row wrapper blocks.** Path A only.
- **No column-count > 6.** Six is enough to express halves, thirds, quarters, sixths cleanly.
- **No per-zone column overrides.** All three zones use the same 6-column grid.
- **No AI-driven layout suggestions.** Admins pick spans manually via the radio.
