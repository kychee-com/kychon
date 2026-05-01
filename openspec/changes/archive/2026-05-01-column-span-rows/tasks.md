## Tasks

### Phase 1: Schema migration + seed type extension

- [x] **1.1 Add `column_span` column to `schema.sql`**
  Idempotent ALTER appended after the composable-layout block in `schema.sql`. Default `'1'` with CHECK on `('1','1/2','1/3','2/3')`.

- [x] **1.2 Extend `SeedSection` with optional `column_span`**
  Added `ColumnSpan` type alias and optional `column_span?` field in `src/seeds/types.ts`.

- [x] **1.3 Generator emits `column_span` and a trailing UPDATE pass**
  `scripts/generate-seed-sql.ts:emitSections` now emits `column_span` in the INSERT VALUES (default `'1'` when unset) and appends `UPDATE sections SET column_span = '<value>' WHERE …` per row whose seed value differs from the default. Verified by `KYCHON_PROJECT=eagles tsx scripts/generate-seed-sql.ts` — seed.sql includes the new column literal.

### Phase 2: Zone CSS Grid + renderBlock post-process

- [x] **2.1 Add zone-grid CSS rules**
  New file `public/css/zone-grid.css` linked from `Portal.astro`. Grid applies to `#sections` and `[data-zone="footer"] > .container`. Header is exempt — `.nav .container { display: flex }` keeps the chrome row's horizontal layout. Span mapping plus tablet/mobile collapse breakpoints included.

- [x] **2.2 Add `applyColumnSpan` post-process to `renderBlock`**
  `src/lib/blocks.ts` exports `applyColumnSpan(html, span)` and `renderBlock` now calls it on every render. Regex `^(\s*<[a-zA-Z][^>]*?)(\s*\/?\s*>)` allows leading whitespace and self-closing tags. No-op on non-tag input.

- [x] **2.3 Extend `Section` type with `column_span`**
  `Section` interface in `src/lib/blocks.ts` gains optional `column_span?: ColumnSpan`. `ColumnSpan` exported from `blocks.ts` for the renderer-side; `src/seeds/types.ts` exports a duplicate `ColumnSpan` alias (same shape) for seed authors — re-importing from `blocks.ts` would create a build/runtime cross-import that doesn't pay rent.

- [x] **2.4 Smoke-test the post-process across all registered blocks**
  `tests/unit/blocks-column-span.test.ts` (8 tests) loops `BLOCK_TYPES`, asserts default `data-column-span="1"` and explicit `'1/2'` propagation. Also tests `applyColumnSpan` edge cases (whitespace prefix, self-closing tag, non-tag input). All 8 pass via `npx vitest run`.

### Phase 3: `supportedSpans` per BlockType

- [x] **3.1 Add `supportedSpans?: ColumnSpan[]` to the `BlockType` interface**
  Done in Phase 2 along with renderBlock post-process. `BlockType` interface in `src/lib/blocks.ts` carries the optional field; absence is read as "all four spans" at the call sites.

- [x] **3.2 Classify every existing BlockType**
  All 19 registered BlockTypes carry `supportedSpans` per the design table: hero/cta/nav/brand_header/sign_in_bar/footer_copyright/footer_attribution → `['1']`; faq/polls → `['1','1/2']`; announcements_feed → `['1','2/3']`; activity_feed → `['1','1/3','2/3']`; event_countdown → `['1','1/3','1/2']`; footer_address → `['1','1/2','1/3']`; footer_social → `['1','1/3']`; features/stats/testimonials/footer_links/custom → all four.

- [x] **3.3 Helper: `getSupportedSpans(type: string): ColumnSpan[]`**
  Exported from `src/lib/blocks.ts`. Returns the BlockType's declared spans or all four. Used by the popover (Phase 4) and verified by `tests/unit/blocks-column-span.test.ts`.

### Phase 4: Span radio in block edit popover

- [x] **4.1 Add `[data-section-edit]` button to every block in `adminWrap` and parallel hero/footer renderers**
  Added `adminEditButton(section, ctx)` helper in `src/lib/blocks.ts` and wired it into `adminWrap`'s admin-section-actions and the hero block's inline admin-section-actions. Footer blocks inherit via their per-renderer markup (their own admin actions live with them, but the popover-via-edit-btn is what we wire — kept inline scope/remove for now per the design). Other blocks acquire the edit button automatically through `adminWrap`.

- [x] **4.2 Implement `openSectionEditPopover(sectionId)` in `AdminEditor.astro`**
  New function added in `src/components/AdminEditor.astro`. Fetches the section row, calls `getSupportedSpans(type)`, renders a popover with header (block label + Global pill), span radio (only `supportedSpans` shown, current value highlighted), scope toggle, remove button. PATCHes on every interaction; busts caches; dispatches `wl-content-rendered`. Live-updates the rendered block's `data-column-span` attribute so the grid re-flows immediately.

- [x] **4.3 Wire the click delegation**
  Extended `initSectionActions` to recognize `[data-section-edit]` clicks and call `openSectionEditPopover(parseInt(dataset.sectionEdit, 10))`.

- [x] **4.4 CSS for the popover and radio**
  Appended to `public/css/admin-editing.css`: `.admin-section-edit-btn` (cog icon styling), `.admin-section-edit-header` / `.admin-section-edit-body` / `.admin-section-edit-label` (popover internals), and `.admin-span-radio` / `.admin-span-radio-btn` (4-button radio with active state).

### Phase 5: Drag-indicator span-aware width

- [x] **5.1 Read dragged block's span on `dragstart`**
  `ensureIndicator()` in `AdminEditor.astro` now reads `draggedEl?.getAttribute('data-column-span')` and stamps it onto the indicator. Defaults to `'1'` when no drag is active.

- [x] **5.2 CSS rules for the span-aware indicator**
  Span-aware grid-column rules for `.admin-drop-indicator[data-column-span="…"]` live in `public/css/zone-grid.css` (alongside the block span rules — they mirror each other on every breakpoint).

- [ ] **5.3 Optional warning tooltip when full-width is dragged into a row of half-width siblings** *(skipped — optional polish, would expand drag UX surface beyond Phase 5's scope)*

### Phase 6: Re-seed demos to exercise side-by-side rows

- [x] **6.1 Coordinate with `block-types-catalog`**
  block-types-catalog hasn't merged to main on this worktree's substrate; rather than block on it, the demo seeds use existing block pairs that already exercise side-by-side rows. When `events_list` lands on main the demos can be amended (one-line changes per project) to swap activity_feed → events_list with the same span.

- [x] **6.2 Eagles seed: announcements + activity sidebar**
  `src/seeds/eagles.ts` — `announcements_feed` set to `column_span: '2/3'`, `activity_feed` set to `'1/3'`. Footer `address` + `copyright` both `'1/2'` to share a row. Generator emits matching UPDATE statements (verified).

- [x] **6.3 Silver Pines: announcements + activity sidebar**
  `src/seeds/silver-pines.ts` — same `'2/3'` + `'1/3'` pairing on the homepage feeds; footer `address` + `copyright` share a row at `'1/2'` each.

- [x] **6.4 Barrio Unido: announcements + activity sidebar**
  `src/seeds/barrio-unido.ts` — same pattern. Spanish locale collapses cleanly to mobile single-column.

- [ ] **6.5 Re-deploy all demos** *(deferred — must run from the parent checkout `/Users/talweiss/dev/kychon`, not this worktree; deploy is `bash deploy-all.sh` after committing+pushing this branch and waiting for CI to pass; user-driven)*

### Phase 7: ODBC port re-validation

- [ ] **7.1 Re-run `/copy-website` against ODBC** *(BLOCKED — same as composable-layout: skill not on this machine)*
  Substrate + spans are in place; whoever runs the skill next has the layout primitives needed (`'2/3'` + `'1/3'` for events sidebar, `'1/2'` + `'1/2'` for slideshows).

- [ ] **7.2 Verify the events sidebar layout renders faithfully** *(BLOCKED on 7.1)*

- [ ] **7.3 Verify two-up slideshows render side-by-side** *(BLOCKED on 7.1)*

### Phase 8: Documentation + CI

- [x] **8.1 Update CLAUDE.md "Composable Layout" section**
  Added a "Column span" bullet to the Composable Layout section in `CLAUDE.md` describing the per-block span value, the 6-col grid CSS in `public/css/zone-grid.css`, the `renderBlock` post-process, the responsive collapse breakpoints, and the header-flex carve-out.

- [x] **8.2 Document `supportedSpans` in STRUCTURE.md**
  Added a paragraph to the Composable Layout section in `STRUCTURE.md` describing `column_span`, the grid hosts, the post-process, and `BlockType.supportedSpans`.

- [x] **8.3 Smoke test in CI: every BlockType.render leads with a tag**
  Already covered: `tests/unit/blocks-column-span.test.ts` asserts that every registered BlockType propagates `data-column-span="1/2"` into its output via the post-process — which only succeeds if the leading tag matched the regex. CI runs `npx vitest run` so this fails the build on regression. Also wired `npx tsx scripts/smoke-check-seeds.ts` as an explicit CI step in `.github/workflows/ci.yml` to fail the build if any project's seed module fails to compile or generate.
