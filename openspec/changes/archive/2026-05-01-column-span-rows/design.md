## Context

The composable-layout substrate makes every visible block a row in `sections` keyed by `(page_slug, zone, scope, position)`. The renderer is one isomorphic `renderBlock(section, ctx): string` that runs at Astro build time (Node) and at runtime (browser); zones (`header`, `main`, `footer`) are container divs filled by string concatenation of rendered blocks.

The substrate solves the "chrome is data, not code" problem but leaves blocks rendered in a single column. Real organizations' sites — including ODBC, the demo ports we already tried — need rows with side-by-side blocks (events sidebar next to main column, two slideshows half-and-half, three-up announcement cards). Today the only way to express that is to fork the renderer per block, which defeats the substrate.

Key constraints driving this design:

- **One-edit-to-renderer.** Six other proposals are in flight in parallel worktrees that touch `src/lib/blocks.ts`. We need to add a per-block `data-column-span` attribute without touching every individual `BlockType.render`. A post-process step in `renderBlock` is one place to edit; per-block changes are N places.
- **Seed-time and DB-time parity.** Build-time bake reads typed seeds; runtime reads `sections` rows. Both must surface the column span. Seed type gains an optional field; DB column gains the CHECK-constrained string.
- **The substrate's drag/edit/scope UI must keep working.** Spans don't change zones, scopes, or positions — they're orthogonal to those.
- **No nested layout this round.** GitHub issue #65 explicitly defers Path B (nested row/column blocks). Path A's exit criterion is "a port whose layout topology Path A cannot express"; we have not seen one yet.
- **Mobile-first collapse.** Side-by-side becomes stacked below 600px. The CSS Grid does the work — no JS responsive logic.

## Goals / Non-Goals

**Goals:**

- Every block carries a `column_span` value addressed by `(page_slug, zone, scope, position, column_span)`.
- Zones render as a 6-column grid on desktop. Spans of `'1'`, `'1/2'`, `'1/3'`, `'2/3'` map to `span 6 / span 3 / span 2 / span 4`.
- Build-time bake and runtime hydrate produce identical HTML — both attach `data-column-span` via the same `renderBlock` post-process.
- Each `BlockType` declares `supportedSpans?` so the picker and span radio show only the choices that make sense for that block (full-width-only blocks like `hero` have `['1']`).
- Admins pick a span via a small radio in the block edit popover; the change PATCHes the row and re-renders the zone.
- Drag indicator's width tracks the dragged block's span — visual feedback matches reality.
- Mobile (<= 600px) stacks every block to full width.

**Non-Goals:**

- **No `row` block with nested children.** Path B is deferred.
- **No fractional spans beyond `'1'`, `'1/2'`, `'1/3'`, `'2/3'`.** These four cover halves, thirds, two-thirds, full — every layout the demos and the ODBC port need.
- **No span enforcement at the seed-type level.** The DB CHECK is the source of truth for valid values.
- **No per-zone grid overrides.** Header/main/footer all use the same 6-column grid.
- **No automatic span balancing.** If an admin drags four `'1/3'` blocks into one zone (12 columns vs the 6-column grid), CSS Grid wraps to a second row — that's expected, not a bug.

## Decisions

### 1. `column_span` as a CHECK-constrained string

**Decision**: One column on `sections`:

```sql
DO $$ BEGIN
  ALTER TABLE sections ADD COLUMN column_span TEXT NOT NULL DEFAULT '1'
    CHECK (column_span IN ('1', '1/2', '1/3', '2/3'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
```

**Why a string (not a number, not 1–6 fractions, not an ENUM)**:

- `'1/2'` reads as a half-width block to humans editing seeds; `3` (over a 6-column grid) does not.
- Adding a new value (`'1/4'` if we ever want quarters) is one CHECK extension, not a type ALTER.
- Strings round-trip through PostgREST/JSON without coercion gotchas.

**Why exactly four values**: halves, thirds, two-thirds, full cover every layout in the demos and the ODBC port. Quarters are nice-to-have but absent from real targets; a fifth value would expand the radio surface without obvious payoff. Add later if a port needs it.

**Why default `'1'`**: existing rows (substrate landed already; some demos have ~50 blocks each) need to keep rendering full-width. `'1'` matches today's behavior bit-for-bit.

### 2. The 6-column grid (main + footer; header keeps flex)

**Decision**: Main and footer zone containers become a CSS Grid; the header zone keeps its existing flex layout:

```css
/* Main zone host (Astro pages render <main id="main-content"> with an
   inner <div id="sections">). When #sections exists, it's the grid host;
   otherwise the main element itself is). */
#sections,
main#main-content:not(:has(#sections)) {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1.5rem;
}

/* Footer zone container — the .container child of [data-zone="footer"]. */
[data-zone="footer"] > .container {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1.5rem;
}

/* Span mapping — applies to any descendant carrying data-column-span. */
[data-column-span="1"]   { grid-column: span 6; }
[data-column-span="1/2"] { grid-column: span 3; }
[data-column-span="1/3"] { grid-column: span 2; }
[data-column-span="2/3"] { grid-column: span 4; }

@media (max-width: 900px) {
  #sections,
  main#main-content:not(:has(#sections)),
  [data-zone="footer"] > .container {
    grid-template-columns: repeat(4, 1fr);
  }
  [data-column-span="1"]   { grid-column: span 4; }
  [data-column-span="1/2"] { grid-column: span 2; }
  [data-column-span="1/3"] { grid-column: span 4; }  /* drop to full width on tablet */
  [data-column-span="2/3"] { grid-column: span 4; }
}

@media (max-width: 600px) {
  #sections,
  main#main-content:not(:has(#sections)),
  [data-zone="footer"] > .container {
    grid-template-columns: 1fr;
  }
  [data-column-span] { grid-column: span 1; }
}
```

**Why 6 columns on desktop**: 6 = LCM(2, 3) — halves and thirds resolve to whole numbers (3 + 3, 2 + 2 + 2, 2 + 4). 12 columns would also work but doubles CSS for no payout.

**Why 4 columns on tablet**: a half stays a half (2/4); thirds collapse to full so a "third + sidebar" pattern doesn't squeeze into unreadable widths.

**Why 1 column on mobile**: a 320px viewport can't honestly render two columns of useful content. Side-by-side becomes stacked; readability beats density.

**Why header is exempt**: the header chrome (`brand_header` + `nav` + `sign_in_bar`) lives in `.nav .container { display: flex }` today, which gives the brand/nav/sign-in row its content-driven horizontal layout. Forcing the header into a 6-col grid would either (a) break that layout when chrome blocks default to `'1'` (each takes a full row) or (b) require the chrome blocks to declare their own `column_span` per project, which is ergonomic dead weight. Header chrome blocks still receive `data-column-span="1"` for the rare cases an admin moves them into a grid-rendered zone.

### 3. Post-process in `renderBlock`, not per-BlockType

**Decision**: Add `data-column-span` via a single regex pass on the rendered HTML in `renderBlock`:

```ts
export function renderBlock(section: Section, ctx: BlockRenderContext): string {
  const type = BLOCK_TYPES[section.section_type];
  if (!type) return '';
  if (section.visible === false) return '';
  const html = type.render(section, ctx);
  return applyColumnSpan(html, section.column_span ?? '1');
}

function applyColumnSpan(html: string, span: ColumnSpan): string {
  if (!span || span === '1') {
    return html.replace(/^(\s*<[a-zA-Z][^>]*?)(\/?\s*>)/, '$1 data-column-span="1"$2');
  }
  return html.replace(/^(\s*<[a-zA-Z][^>]*?)(\/?\s*>)/, `$1 data-column-span="${span}"$2`);
}
```

**Why a regex over the leading tag**: every renderer's output starts with one outer element (`<section …>`, `<div …>`, `<a …>`, `<button …><div …>` for nav, etc.). Slotting an attribute into that tag is a deterministic edit that doesn't require parsing.

**Why not require each BlockType.render to inject the attribute**: six parallel pills are touching every BlockType.render right now (block-types-catalog adds blocks, hero-foreground-mode and brand-identity-fields modify hero/brand_header config, etc.). Each per-render edit creates a merge conflict. One post-process is one merge.

**Why default `'1'` even when not specified**: emitting the attribute every time keeps the grid/CSS uniform and lets selector specificity win over any defaults; absence-vs-presence asymmetry would break attribute-based queries.

**Edge case — `nav` returns multiple top-level elements**: `nav.render` returns `<button …>…</button><div …>…</div><button …>…</button>` (toggle + links + edit btn). The regex applies the attribute to the first element only; that's fine because the nav lives in the header zone where the column span is the whole-zone default `'1'` anyway. Renderers that emit multi-element output should always be `'1'`-spannable; this is a soft contract documented in `BlockType.supportedSpans`.

### 4. `supportedSpans` per BlockType

**Decision**: Add an optional field to the `BlockType` interface:

```ts
export type ColumnSpan = '1' | '1/2' | '1/3' | '2/3';

export interface BlockType {
  // …existing fields…
  supportedSpans?: ColumnSpan[];
}
```

**Classification** (the source of truth, applied to existing blocks):

| Block type           | supportedSpans                  | Reason                                                                                  |
|----------------------|---------------------------------|-----------------------------------------------------------------------------------------|
| `hero`               | `['1']`                         | Hero is the page banner — half-width hero looks broken.                                 |
| `cta`                | `['1']`                         | CTA centers content; squeezed CTA loses its visual punch.                              |
| `announcements_feed` | `['1', '2/3']`                  | Full-width default; `'2/3'` lets it sit next to a `'1/3'` event sidebar.                |
| `activity_feed`      | `['1', '1/3', '2/3']`           | Often a sidebar adjacent to announcements.                                              |
| `event_countdown`    | `['1', '1/3', '1/2']`           | Often a small badge alongside other content.                                            |
| `polls`              | `['1', '1/2']`                  | Side-by-side polls are common in club sites.                                            |
| `features`           | `['1', '1/2', '1/3', '2/3']`    | Inherent grid; works at any width.                                                      |
| `stats`              | `['1', '1/2', '1/3', '2/3']`    | Number badges resize cleanly.                                                           |
| `testimonials`       | `['1', '1/2', '1/3', '2/3']`    | Card grid scales cleanly.                                                               |
| `faq`                | `['1', '1/2']`                  | Half-width FAQ + half-width related block is a common pattern.                          |
| `custom`             | `['1', '1/2', '1/3', '2/3']`    | Whatever HTML the admin wrote — assume it's responsive.                                 |
| `nav`                | `['1']`                         | Header chrome that holds the whole nav row.                                             |
| `brand_header`       | `['1']`                         | Brand chrome anchors the header.                                                        |
| `sign_in_bar`        | `['1']`                         | Header chrome.                                                                          |
| `footer_address`     | `['1', '1/2', '1/3']`           | Often appears next to other footer columns.                                             |
| `footer_links`       | `['1', '1/2', '1/3', '2/3']`    | Multi-column link layout is the whole point.                                            |
| `footer_copyright`   | `['1']`                         | Always full-width by convention.                                                        |
| `footer_social`      | `['1', '1/3']`                  | Often a sidebar at the bottom.                                                          |
| `footer_attribution` | `['1']`                         | Final line of footer chrome.                                                            |

**Why declare per-type, not allow-all**: a half-width hero looks broken; the picker should not offer it. Constraining the radio at the BlockType level prevents bad layouts before they happen, without the database needing per-type CHECKs.

**Default when `supportedSpans` is omitted**: `['1', '1/2', '1/3', '2/3']` (all four). New blocks added by sister proposals don't have to opt in to be flexible.

### 5. The block edit popover

**Decision**: Add a per-block edit affordance that opens a popover containing the span radio + scope toggle + remove button. The existing inline `admin-section-actions` (rendered today inside `adminWrap` and on hero/footer blocks via per-renderer code) gets replaced by a single `[data-section-edit]` button per block; the popover surfaces the controls that used to be inline.

```ts
// In each renderer's adminWrap / hero / footer-block construction:
const editBtn = sid != null && ctx.admin
  ? `<button class="admin-section-edit-btn" data-section-edit="${sid}" title="Edit block">⚙️</button>`
  : '';
```

The popover (created in AdminEditor) reads:

- The block's `column_span` from the row
- The block's `supportedSpans` from `BLOCK_TYPES[type]`
- The block's `scope` from the row

…and renders:

- A radio of supported spans (preselected by current value)
- A `Make global` / `Make page-only` toggle (preselected by current scope)
- A `Remove block` danger button

PATCHes happen on radio change / toggle click / remove click. Cache busts and a `wl-content-rendered` event fire so the zone re-renders.

**Why a popover instead of inline radio**: the radio takes 4 buttons + a label (~120px wide). Inline, it crowds the block. Popover surfaces it on demand and keeps the same ergonomics for scope/remove that already exist.

**Why combine edit, span, scope, remove into one popover**: they're all "this block" actions. Three separate UI affordances per block (scope toggle button + remove ×) clutter the page; one cog icon opens a single panel.

### 6. Drag indicator span-aware width

**Decision**: When `dragstart` fires on a block, read its `data-column-span` and write the matching span class onto the drop indicator (`admin-drop-indicator`). The CSS for the indicator declares span-aware widths matching the zone-grid rules.

```css
.admin-drop-indicator { grid-column: span 6; height: 4px; … }
.admin-drop-indicator[data-column-span="1/2"] { grid-column: span 3; }
.admin-drop-indicator[data-column-span="1/3"] { grid-column: span 2; }
.admin-drop-indicator[data-column-span="2/3"] { grid-column: span 4; }
```

**Why span-aware indicator**: a full-width indicator under a `'1/3'` block lies — the dropped block won't take that width. Matching the dragged block's span makes the preview honest.

**Why not also re-flow siblings**: CSS Grid does that automatically when the new element lands. The indicator only needs to look right at the moment of preview.

### 7. Cross-zone drop preserves span (not reset)

**Decision**: When a block moves between zones via drag, its `column_span` is preserved. The PATCH payload sends `{ zone, position }`; `column_span` is untouched.

**Why preserve**: if an admin drags a `'1/2'` polls block from main to footer, they probably want it half-width in the footer too. Resetting to `'1'` would be a surprise.

**Edge case — full-width block dragged into a half-width row**: CSS Grid wraps to a new row. Visible but ugly. Admin can fix via the popover. Not a blocker.

### 8. Seed-type extension

**Decision**: Add an optional field to `SeedSection`:

```ts
export type ColumnSpan = '1' | '1/2' | '1/3' | '2/3';

export interface SeedSection {
  // …existing fields…
  column_span?: ColumnSpan;
}
```

The generator emits `column_span` when set, defaults to `'1'` otherwise. The deletion-key (idempotency tuple) does not include `column_span` — re-running the generator on a seed that adds spans to existing rows updates them in-place via a separate UPDATE pass:

```sql
-- Existing INSERT … WHERE NOT EXISTS guards rows by (page_slug, zone, scope, section_type, position).
-- Spans live alongside but are not part of the identity.
UPDATE sections SET column_span = '1/2'
  WHERE page_slug = 'index' AND zone = 'main' AND scope = 'page' AND section_type = 'features' AND position = 2;
```

The generator emits one trailing `UPDATE … WHERE …` per seed row whose `column_span` is set to a non-default value. The UPDATE is idempotent (running twice with the same value is a no-op).

**Why not include `column_span` in the identity tuple**: it changes meaning to "two rows with different spans at the same position are different blocks," which is wrong — they're two configurations of the same block. Identity stays `(page_slug, zone, scope, section_type, position)`.

**Why an UPDATE pass**: existing rows already exist on deployed databases (substrate landed). The INSERT … WHERE NOT EXISTS skips them; without an UPDATE, the seed's span would never apply.

## Risks / Trade-offs

### A. The post-process regex is a contract, not a parser

`renderBlock` assumes every block returns HTML starting with `<{tag} …>`. If a renderer ever returns plain text or a comment first, the attribute won't attach. Mitigation: the regex's no-op behavior (no replacement) means nothing breaks visually — the block just renders without the data attribute, and the CSS falls back to `[data-column-span="1"]`'s default span. Also, a snapshot test (Phase 8.3 below) catches the case where any registered block's output doesn't match the leading-tag pattern.

### B. Mid-row hero ergonomics

If an admin sets a hero block's span to `'1'` (default) but drags it next to a `'1/3'` block, the hero takes a full row of its own (CSS Grid wraps). Functionally fine; visually the admin might expect the hero to share the row. We rely on `supportedSpans: ['1']` for hero to communicate the intent: "hero only goes full-width." The popover hides other choices.

### C. UPDATE pass on every deploy

Deploys re-run the generator; the UPDATE re-asserts spans for every row whose seed has one. Cheap (single-row UPDATEs, indexable WHERE clauses), but it does mutate the DB on every deploy. Trade-off: drift between seed and DB is impossible. Admins editing spans live still work — their PATCH overwrites until the next deploy, then the seed reasserts. For demos this is a feature (resets are good); for forks editing seeds is expected.

### D. Span radio coupling to popover roll-out

This change introduces the per-block edit popover as a new UI surface. Sister proposals expecting a popover (none today, but block-types-catalog will eventually add one for block-type-specific config) need to coordinate. The popover is an orthogonal addition; conflicts are merge-mechanical, not semantic.

### E. Six-other-pills conflict surface

- `block-types-catalog` adds new entries to `BLOCK_TYPES`. We add `supportedSpans` to existing entries. Merge per-entry should be clean (different fields, same record).
- `embed-block` adds one new BlockType. Sets its own `supportedSpans`. No conflict.
- `nav-nested-children`, `hero-foreground-mode`, `brand-identity-fields` modify nav/hero/brand_header config. Our edits add `supportedSpans` to those entries. Merge should be field-level clean.
- `theme-system-audit` modifies font/CSS injection. Independent.

Demo-seed edits (Phase 6) DO overlap with `block-types-catalog`'s seed edits — both add/modify rows in `eagles.ts` etc. Strategy: do seed edits LAST after block-types-catalog has merged its new blocks, so the demos already have `events_list` etc. to span.

## Migration / Rollout

This is additive at every level. No data migration risk.

1. Phase 1 — schema migration. Idempotent. Existing rows acquire `column_span = '1'`.
2. Phase 2 — wire CSS Grid in zones + post-process in `renderBlock`. Renders are unchanged for default `'1'` blocks; new blocks rendered with `data-column-span` paint at the right width.
3. Phase 3 — `supportedSpans` on BlockTypes. Pure metadata; no behavior change until the popover reads it.
4. Phase 4 — popover with span radio. Admin-only; hidden from members.
5. Phase 5 — drag-indicator polish. Visual only.
6. Phase 6 — re-seed demos with spans on the blocks that should sit side-by-side. Re-deploy via `bash deploy-all.sh`.
7. Phase 7 — re-port ODBC if the skill is available; verify the events sidebar and side-by-side slideshow layouts now render.
8. Phase 8 — docs + CI.

Each phase is deployable on its own. Phases 1–3 are invisible to users.
