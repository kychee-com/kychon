## ADDED Requirements

### Requirement: Main and footer zones render as a 6-column responsive grid

The main-zone container (`#sections` when present, otherwise `#main-content`) and the footer-zone container (`[data-zone="footer"] > .container`) SHALL render as a CSS Grid with `grid-template-columns: repeat(6, 1fr)` on viewports above 900px wide. On viewports between 600px and 900px the grid SHALL drop to 4 columns. On viewports at or below 600px the grid SHALL collapse to a single column so all blocks stack vertically.

The header zone is intentionally exempt: its existing flex layout (`.nav .container { display: flex }`) gives `brand_header`, `nav`, and `sign_in_bar` a natural horizontal arrangement that 6-col grid would not improve. Header chrome blocks all carry `data-column-span="1"` for the rare cases when they DO end up in a grid-rendered zone (e.g. an admin drags a brand block to the footer), but the header zone itself stays flex.

#### Scenario: Desktop renders 6-column grid in main and footer

- **WHEN** a viewport wider than 900px loads any Kychon page
- **THEN** the main-zone host (`#sections` if present, else `#main-content`) computes `grid-template-columns: repeat(6, 1fr)`
- **THEN** the footer-zone container computes `grid-template-columns: repeat(6, 1fr)`

#### Scenario: Tablet collapses to 4-column grid

- **WHEN** a viewport between 600px and 900px loads any Kychon page
- **THEN** the main- and footer-zone containers compute `grid-template-columns: repeat(4, 1fr)`

#### Scenario: Mobile stacks every block

- **WHEN** a viewport at or below 600px loads any Kychon page
- **THEN** the main- and footer-zone containers compute `grid-template-columns: 1fr`
- **THEN** every block in every grid-rendered zone takes the full viewport width regardless of its `data-column-span` value

#### Scenario: Header zone keeps its flex layout

- **WHEN** any viewport size loads any Kychon page
- **THEN** the header zone container (`.nav .container`) computes `display: flex` (unchanged from before this change)
- **THEN** chrome blocks (`brand_header`, `nav`, `sign_in_bar`) flow horizontally per the existing flex rules

### Requirement: Every rendered block carries `data-column-span`

`renderBlock(section, ctx)` SHALL post-process the registered renderer's output by injecting a `data-column-span="<value>"` attribute into the leading element's opening tag. The value SHALL be `section.column_span` when set, defaulting to `'1'` when unset.

The injection SHALL happen once in `renderBlock`, NOT in each `BlockType.render`. Per-renderer changes are out of scope.

#### Scenario: Default rendered block carries span="1"

- **WHEN** `renderBlock` is called with a section whose `column_span` is unset
- **THEN** the returned HTML's leading tag has `data-column-span="1"`

#### Scenario: Explicit span propagates into the attribute

- **WHEN** `renderBlock` is called with `section.column_span = '1/2'`
- **THEN** the returned HTML's leading tag has `data-column-span="1/2"`

#### Scenario: Renderer output starting with whitespace still gets the attribute

- **WHEN** a registered renderer returns `'   <section …>'` (leading whitespace)
- **THEN** the post-process attaches the attribute to the `<section>` tag

#### Scenario: Build-time bake and runtime hydrate both attach the attribute

- **WHEN** `Portal.astro`'s frontmatter bakes header chrome via `renderBlock`
- **THEN** the baked HTML carries `data-column-span` on each block's leading tag
- **WHEN** `page-render.ts`'s runtime hydrate replaces zone HTML via `renderBlock`
- **THEN** the runtime HTML carries the same attribute

### Requirement: CSS maps `data-column-span` to grid spans

Selectors SHALL map each legal span value to a `grid-column: span N` declaration:

- `[data-column-span="1"]` SHALL span 6 columns at desktop, 4 at tablet, 1 on mobile.
- `[data-column-span="1/2"]` SHALL span 3 columns at desktop, 2 at tablet, 1 on mobile.
- `[data-column-span="1/3"]` SHALL span 2 columns at desktop, 4 (full row) at tablet, 1 on mobile.
- `[data-column-span="2/3"]` SHALL span 4 columns at desktop, 4 (full row) at tablet, 1 on mobile.

#### Scenario: Half-width block sits next to a half-width sibling

- **WHEN** two blocks in the same zone both have `data-column-span="1/2"`
- **WHEN** the viewport is wider than 900px
- **THEN** they sit side-by-side in one grid row, each taking 3 of 6 columns

#### Scenario: Two-thirds main column sits next to one-third sidebar

- **WHEN** an `announcements_feed` block has `data-column-span="2/3"` AND an `events_list` block has `data-column-span="1/3"` in the same zone, in adjacent positions
- **WHEN** the viewport is wider than 900px
- **THEN** announcements takes columns 1–4 and events takes columns 5–6 in a single grid row

#### Scenario: Mobile collapses both blocks to full width

- **WHEN** the viewport is at or below 600px
- **THEN** any block, regardless of its `data-column-span`, takes the full viewport width
- **THEN** blocks stack vertically in their row's reading order

### Requirement: `BlockType.supportedSpans` constrains the picker and span radio

Each `BlockType` SHALL declare an optional `supportedSpans?: ColumnSpan[]` array. When omitted, all four spans (`'1'`, `'1/2'`, `'1/3'`, `'2/3'`) are considered supported. The block edit popover's span radio SHALL render only the values listed in `supportedSpans`. The block-type picker SHALL NOT use `supportedSpans` to filter types — it filters by `zoneHints` only.

#### Scenario: Hero block is full-width-only

- **WHEN** an admin opens the edit popover on a `hero` block
- **THEN** the span radio renders only the `'1'` (full-width) option

#### Scenario: Features block supports all four spans

- **WHEN** an admin opens the edit popover on a `features` block
- **THEN** the span radio renders four options: `'1'`, `'1/2'`, `'1/3'`, `'2/3'`

#### Scenario: A block type with `supportedSpans` undefined defaults to all four

- **WHEN** an admin opens the edit popover on a block whose `BlockType` does not declare `supportedSpans`
- **THEN** the span radio renders four options (all spans)

### Requirement: Block edit popover surfaces span, scope, and remove

Every block in admin mode SHALL render a `[data-section-edit]` button. Clicking the button SHALL open a popover containing:

1. A span radio reflecting the block's `BlockType.supportedSpans`, with the row's current `column_span` preselected.
2. A scope toggle (`Make global` / `Make page-only`) reflecting the row's current `scope`.
3. A `Remove block` button.

Each interaction SHALL PATCH the relevant column on the `sections` row, bust the `wl_cache_sections_*` localStorage entries, and dispatch a `wl-content-rendered` event so `page-render.ts` re-renders the zone.

#### Scenario: Admin changes span via the popover

- **WHEN** an admin clicks the `'1/2'` span button in the popover for an `announcements_feed` block
- **THEN** the system PATCHes `sections?id=eq.<id>` with `{ column_span: '1/2' }`
- **THEN** the page caches are invalidated and the zone re-renders with the new width

#### Scenario: Removing a block in the popover deletes the row

- **WHEN** an admin clicks `Remove block` in the popover and confirms
- **THEN** the system DELETEs `sections?id=eq.<id>`
- **THEN** the block is removed from the zone

#### Scenario: Scope toggle in popover matches the inline button's behavior

- **WHEN** an admin toggles `Make global` in the popover
- **THEN** the system PATCHes `{ scope: 'global' }` and shows a toast `Saved — appears on all pages`

### Requirement: Drag indicator width matches the dragged block's span

When admin drag begins on a block with `data-column-span="<value>"`, the drop indicator (`.admin-drop-indicator`) SHALL acquire the same `data-column-span` attribute and SHALL render at the same width via the zone-grid CSS rules.

#### Scenario: Dragging a half-width block shows a half-width indicator

- **WHEN** an admin drags a block whose `data-column-span="1/2"`
- **THEN** the drop indicator renders at half the zone's row width on desktop

#### Scenario: Dragging a full-width block shows a full-width indicator

- **WHEN** an admin drags a block whose `data-column-span="1"`
- **THEN** the drop indicator spans the full zone row

### Requirement: Cross-zone drag preserves `column_span`

When a block moves between zones via drag, the system SHALL preserve its `column_span`. The PATCH payload on cross-zone drop SHALL include only `{ zone, position }` — NOT `column_span`.

#### Scenario: Half-width block moved from main to footer keeps its span

- **WHEN** an admin drags a `'1/2'`-span block from `zone='main'` to `zone='footer'`
- **THEN** the system PATCHes `{ zone: 'footer', position: <new> }`
- **THEN** the row's `column_span` is unchanged
- **THEN** the block renders at half the footer zone's row width on desktop
