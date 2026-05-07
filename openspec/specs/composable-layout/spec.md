## Purpose

Every visible block on every Kychon page — including chrome (header, navigation, footer) and main content — is a row in the `sections` table addressed by `(page_slug, zone, scope, position, column_span)`. One isomorphic `renderBlock()` registry serves both the build-time bake and the runtime hydrate. Admins compose pages — including chrome — through drag-reorder across zones, inline edit, span selection, and add/remove from a block-type picker.
## Requirements
### Requirement: Every visible block on every page is a row in `sections`

Every paintable element on every Kychon page — including chrome (header, navigation, footer) and main content — SHALL be expressed as a row in the `sections` table addressed by the four-tuple `(page_slug, zone, scope, position)`. No chrome SHALL be hard-coded in `.astro` layout or component files.

The `zone` column SHALL accept `'header'`, `'main'`, or `'footer'` and place the block in the correspondingly-named container of every page.

The `scope` column SHALL accept `'page'` or `'global'`. A `scope = 'page'` block SHALL render only on the page whose `slug` matches the row's `page_slug`. A `scope = 'global'` block SHALL render on every page regardless of `page_slug`.

#### Scenario: Header chrome is data, not code
- **WHEN** the layout component is read
- **THEN** it does not import `Nav.astro` or `Footer.astro`
- **THEN** it contains zone wrapper containers (`#zone-header`, `#zone-footer`) populated by the block renderer

#### Scenario: A global block renders on every page
- **WHEN** a `nav` block is seeded with `zone = 'header', scope = 'global', page_slug = '*'`
- **THEN** every page (home, custom pages, events, directory, etc.) renders that nav in its header zone

#### Scenario: A page-scoped block renders only on its page
- **WHEN** an `announcements_feed` block is seeded with `zone = 'main', scope = 'page', page_slug = 'index'`
- **THEN** the home page renders the feed
- **THEN** other pages do not render it

#### Scenario: Removing chrome means deleting a block
- **WHEN** an admin removes the `announcements_feed` block on the home page
- **THEN** the home page no longer shows announcements (no code change required)

### Requirement: A single isomorphic `renderBlock()` registry serves both build and runtime

The system SHALL define a block-type registry at `src/lib/blocks.ts` that maps every supported `section_type` to a block handler. Each handler SHALL expose `render(section, ctx): string`, `defaultConfig`, `label`, `icon`, `dynamic` (boolean), and optional `zoneHints`. The same `render()` function SHALL be invoked at Astro build time (Node, in `Portal.astro` frontmatter) and at runtime (browser, in the page hydrator). `render()` SHALL return an HTML string to make build-time and runtime symmetric.

#### Scenario: Bake and runtime use the same renderer
- **WHEN** the build runs and produces baked chrome HTML
- **THEN** the bake calls `renderBlock(section, ctx)` from `src/lib/blocks.ts`
- **WHEN** the runtime hydrate fires and replaces zone HTML
- **THEN** the runtime calls the same `renderBlock(section, ctx)` from the same module

#### Scenario: Unknown block type renders nothing
- **WHEN** a `sections` row has a `section_type` not present in the registry
- **THEN** `renderBlock()` returns an empty string and emits a console warning

#### Scenario: Dynamic blocks emit a skeleton at bake time
- **WHEN** `renderBlock()` is called with a block whose registry entry has `dynamic: true`
- **THEN** the returned HTML is a skeleton with `data-block-hydrate="{section_type}"` attributes
- **WHEN** the runtime hydrator runs after page load
- **THEN** the skeleton is replaced with content fetched from the block's data source

### Requirement: Pages render from a single SQL query covering all zones

Every page renderer SHALL fetch all blocks for the page in one query that returns chrome and main together:

```
sections?or=(and(page_slug.eq.{slug},scope.eq.page),scope.eq.global)&order=zone.asc,position.asc
```

The result SHALL be split by `zone` and rendered into the matching zone container. The system SHALL maintain an index `(zone, scope, page_slug, position)` on `sections` to back this query.

#### Scenario: One round trip per page
- **WHEN** a page loads
- **THEN** a single PostgREST request returns header, main, and footer blocks
- **THEN** the renderer dispatches each result to its zone container by inspecting the `zone` field

#### Scenario: Per-page chrome override
- **WHEN** a `nav` block exists with `scope = 'page', page_slug = 'about'` AND a different `nav` block exists with `scope = 'global'`
- **WHEN** the user navigates to `/page.html?slug=about`
- **THEN** both blocks are returned by the query
- **THEN** the renderer picks the page-scoped one for the header zone (precedence: page-scoped within the same zone wins over global)

### Requirement: Build-time bake of chrome zones produces instant first paint

The Astro build SHALL bake the active project's `zone = 'header'` and `zone = 'footer'` blocks into the page HTML at build time. The bake SHALL read the project's typed seed module via `getActiveProjectSeed()` (resolving from `KYCHON_PROJECT` env, defaulting to `'kychon'`), filter to chrome zones, render each block via `renderBlock(section, { admin: false, locale: 'en' })`, and inject the resulting HTML into the zone wrappers using Astro's `set:html`. The runtime hydrator SHALL compare the live database state to the baked HTML and replace zone contents only when they differ.

#### Scenario: Cold visit paints chrome instantly
- **WHEN** a first-time visitor loads any page on a deployed Kychon site
- **THEN** the header and footer paint with their full content on the first frame, with no skeleton or flicker

#### Scenario: Bake matches DB on a freshly-seeded project
- **WHEN** the project is freshly deployed and no admin edits have occurred
- **THEN** the runtime hydrator finds bake HTML equal to DB-rendered HTML
- **THEN** the runtime does not mutate zone HTML

#### Scenario: Admin edits show on next reload
- **WHEN** an admin edits a chrome block (e.g. footer copyright text)
- **WHEN** another visitor loads the page after that edit
- **THEN** the cold paint shows the older baked content
- **THEN** the runtime hydrate replaces it with the live DB content within one paint

### Requirement: localStorage cache layer between bake and DB

The runtime page renderer SHALL cache the most recent successful sections fetch per page slug under `wl_cache_sections_{slug}` in localStorage. On subsequent loads, the cache SHALL be applied immediately after the bake (overwriting bake output if cache differs) and before the network fetch. After the network fetch resolves, the cache SHALL be updated and the DOM SHALL be re-rendered if the network response differs from the cache. Cache TTL and stale-check rules SHALL match those of `wl_cache_site_config`.

#### Scenario: Returning visitor with cache sees instant fresh content
- **WHEN** a returning visitor loads a page they have visited before
- **THEN** the bake paints first
- **THEN** the cached sections override the bake within the same frame if they differ

#### Scenario: Cold visitor with no cache sees bake until network resolves
- **WHEN** a visitor with empty localStorage loads a page
- **THEN** the bake paints first
- **THEN** the network fetch resolves and updates the DOM if the live state differs from bake

### Requirement: Cross-zone drag in `AdminEditor` moves blocks between zones

The drag-to-reorder engine in `src/components/AdminEditor.astro` SHALL support dragging blocks across zone boundaries. Admins SHALL be able to move any `[data-sortable-id]` block from header to main to footer (or any other combination). On drop into a zone different from the source, the system SHALL PATCH the block with both the new `zone` value and a recomputed `position`.

The system SHALL render a "Drop a block here" placeholder inside any empty zone container while admin drag is active. The placeholder SHALL NOT be visible to non-admins.

#### Scenario: Admin drags a section from main to footer
- **WHEN** an admin drags a block whose source row has `zone = 'main'`
- **WHEN** the drop target is inside the `#zone-footer` container
- **THEN** the system PATCHes `{ zone: 'footer', position: <new> }`
- **THEN** the block renders in the footer on next page load

#### Scenario: Empty zone shows drop placeholder during drag
- **WHEN** a zone container is empty AND admin drag is active (`body.admin-dragging` class present)
- **THEN** the empty zone shows a "Drop a block here" placeholder

#### Scenario: Empty zone is invisible to non-admins
- **WHEN** a non-admin loads a page and a zone happens to be empty
- **THEN** the zone has zero visible UI

### Requirement: `scope` is an explicit, drag-independent property

Drag operations SHALL change `zone` and `position` only. Drag SHALL NOT modify `scope`. Admins SHALL change `scope` explicitly via the block edit popover, which SHALL display a `GLOBAL` pill in its header when the block has `scope = 'global'` and SHALL provide a toggle `Make global` / `Make page-only`.

When an admin drops a `scope = 'page'` block into a chrome zone (`'header'` or `'footer'`), the system SHALL surface a transient tooltip above the dropped block reading `"This now appears here only. Make it appear on every page?"` with a `Make global` button. The tooltip SHALL auto-dismiss after 5 seconds. Clicking `Make global` SHALL PATCH `scope = 'global'`. Ignoring the tooltip SHALL leave the block as `scope = 'page'`.

#### Scenario: Admin sees scope on the chrome block they edit
- **WHEN** an admin clicks an edit affordance on a global footer block
- **THEN** the popover header shows a `GLOBAL` pill
- **THEN** the popover contains a `Make page-only` button

#### Scenario: Saving a global edit toasts the consequence
- **WHEN** an admin saves an edit to a `scope = 'global'` block
- **THEN** a toast appears reading `"Saved — appears on all pages"`

#### Scenario: Cross-zone-into-chrome surfaces the promotion tooltip
- **WHEN** an admin drops a `scope = 'page'` block into a header or footer zone
- **THEN** a tooltip appears with `"This now appears here only. Make it appear on every page?"`
- **WHEN** the admin clicks `Make global`
- **THEN** the system PATCHes `scope = 'global'`

#### Scenario: Tooltip auto-dismisses without forcing a choice
- **WHEN** the cross-zone-into-chrome tooltip is shown and 5 seconds pass without interaction
- **THEN** the tooltip dismisses itself and the block remains `scope = 'page'`

### Requirement: Block-type registry includes chrome and footer types

The `BLOCK_TYPES` registry in `src/lib/blocks.ts` SHALL include, at minimum, the following block types:

**Main-zone:** `hero`, `features`, `cta`, `stats`, `testimonials`, `faq`, `polls` (dynamic), `event_countdown`, `activity_feed` (dynamic), `announcements_feed` (dynamic), `embed`.

**Header-zone:** `nav`, `brand_header`, `sign_in_bar`.

**Footer-zone:** `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`.

Each entry SHALL define `defaultConfig` providing a working starting point when an admin adds a new block of that type via the picker.

#### Scenario: Embed block defaultConfig represents a safe starting state
- **WHEN** an admin adds a new embed block via the picker
- **THEN** the new section's `config` is `{ provider: 'youtube', params: {}, height: '320px', responsive: true }` or similar — a known-safe verified provider with empty params, NOT the generic iframe with trust pre-acknowledged

#### Scenario: Admin adds a footer address block
- **WHEN** an admin opens the block picker in the footer zone
- **THEN** `footer_address` appears as an option

#### Scenario: Footer attribution block defaults to Powered-by-Kychon
- **WHEN** the kychon template seed is generated
- **THEN** the seed includes a `footer_attribution` block with `config.text = "Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)"`

#### Scenario: Footer copyright supports auto year
- **WHEN** a `footer_copyright` block has `config.year = 'auto'`
- **THEN** the rendered HTML contains a `<span data-year="auto">` element
- **THEN** an inline script sets the span's text to the current year on page load

### Requirement: `nav` block carries the navigation that used to live in `site_config.nav`

The `site_config.nav` key SHALL be removed from the system. Navigation SHALL be expressed as a `nav` block in `zone = 'header'`. The `nav` block's `config.items` SHALL be an array of nav items, each carrying `label`, `href`, `icon`, optional `public`, `auth`, `feature`, `admin` properties, AND an optional `children: NavItem[]` field that recursively contains nav items. When `children` is present and non-empty, the item SHALL be rendered as a hover/focus dropdown trigger; when `children` is absent, empty, or undefined, the item SHALL render as today's flat nav link. The block edit popover SHALL be the editor surface for nav items, replacing the separate nav editor that wrote to `site_config`. The popover SHALL support adding, removing, editing, and drag-reordering child items (scoped within their parent's `children` array).

#### Scenario: Site nav comes from a sections row, not site_config
- **WHEN** a Kychon page loads
- **THEN** the navigation in the header zone is rendered by `BLOCK_TYPES.nav.render` against the `nav` block's `config.items`
- **THEN** no code path reads `site_config.nav`

#### Scenario: Admin edits nav via the block popover
- **WHEN** an admin clicks the edit affordance on the `nav` block in the header
- **THEN** a popover opens with the nav items as editable rows (label, href, visibility flags, drag-reorder)
- **WHEN** the admin saves
- **THEN** the system PATCHes the `nav` block's `config.items`

#### Scenario: Flat nav configs continue to work
- **WHEN** a `nav` block has items with no `children` field set
- **THEN** the rendered nav is flat — each item is an `<a class="nav-link">` with no chevron and no dropdown

#### Scenario: An item with children renders as a dropdown trigger
- **WHEN** a `nav` block has an item `{ label: 'Marina', children: [{ label: 'Layout', href: '/marina/layout' }, { label: 'How-To', href: '/marina/howto' }] }`
- **THEN** the rendered HTML contains a chevron toggle: `<button class="nav-chevron-toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="..."`
- **THEN** the rendered HTML contains an `<ul class="nav-dropdown" role="menu" hidden>` with two `<li role="none"><a role="menuitem" href>...</a></li>` children
- **THEN** if the parent also has `href` set, an additional `<a class="nav-link" href={href}>` is rendered alongside the chevron

#### Scenario: Hover opens the dropdown on pointer devices
- **WHEN** a user with a pointer device hovers a parent nav item with children
- **THEN** the dropdown becomes visible (CSS-driven via `@media (hover: hover) and (pointer: fine)`)
- **THEN** `aria-expanded` is updated to `"true"` by the runtime handler

#### Scenario: Focus opens the dropdown for keyboard users
- **WHEN** a keyboard user tabs to the chevron of a parent nav item
- **WHEN** the user presses `↓` (Down arrow) or `Enter`
- **THEN** the dropdown opens and focus moves to the first menu item

#### Scenario: Keyboard navigation inside an open dropdown
- **WHEN** a user presses `↓` while focus is on a menu item
- **THEN** focus moves to the next menu item (wrapping at the end)
- **WHEN** a user presses `↑`
- **THEN** focus moves to the previous menu item (wrapping at the start)
- **WHEN** a user presses `Enter` or `Space` on a menu item
- **THEN** the link is activated and the menu closes

#### Scenario: Escape closes the menu and returns focus
- **WHEN** a dropdown is open with a menu item focused
- **WHEN** the user presses `Escape`
- **THEN** the dropdown closes
- **THEN** focus returns to the chevron trigger

#### Scenario: Tab advances out of the menu
- **WHEN** a dropdown is open with a menu item focused
- **WHEN** the user presses `Tab`
- **THEN** the dropdown closes
- **THEN** focus advances to the next top-level nav item

#### Scenario: Click outside closes any open dropdown
- **WHEN** a dropdown is open
- **WHEN** the user clicks anywhere outside the dropdown subtree (and outside the chevron)
- **THEN** the dropdown closes

#### Scenario: Mobile renders inline expansion, not hover fly-out
- **WHEN** the viewport matches `@media (hover: none) or (max-width: 768px)`
- **WHEN** a user taps the parent of a nav item with children
- **THEN** the dropdown expands inline below the parent (not absolutely positioned)
- **THEN** the chevron rotates 180° via CSS transform
- **THEN** child items are indented to indicate hierarchy

#### Scenario: Recursive children render at depth ≥ 2
- **WHEN** a `nav` block has a parent item whose child has its own `children` array
- **THEN** the rendered HTML supports a second-level dropdown
- **THEN** keyboard and pointer handling work the same way at every depth

#### Scenario: Removing a parent in the editor prompts about its children
- **WHEN** an admin clicks the remove affordance on a parent nav item that has children
- **THEN** the editor prompts: `"Remove this item and its N children?"`
- **WHEN** the admin confirms
- **THEN** the parent and its entire subtree are removed from `config.items`

### Requirement: Typed seed modules are the canonical source for default content

Each forkable Kychon project SHALL have a typed seed module under `src/seeds/{project}.ts` exporting a `ProjectSeed` object. The seed SHALL describe `site_config`, `sections` (including chrome blocks expressing the project's full chrome), `membership_tiers`, and any default `pages`. The build pipeline SHALL generate `seed.sql` by running `scripts/generate-seed-sql.ts` against the active project's seed module before invoking `astro build`.

#### Scenario: Build pipeline generates seed.sql
- **WHEN** `npm run build` is invoked
- **THEN** `scripts/generate-seed-sql.ts` runs first and writes `seed.sql`
- **THEN** `astro build` runs second
- **WHEN** the deploy script is invoked
- **THEN** it reads the freshly-generated `seed.sql`

#### Scenario: A type error in a seed is caught at build time
- **WHEN** a developer introduces a TS error in `src/seeds/eagles.ts` (e.g. a block with an invalid `zone` value)
- **THEN** `tsx scripts/generate-seed-sql.ts` exits non-zero with the TS error
- **THEN** the build fails before `astro build` runs

#### Scenario: Active project is selected by env var
- **WHEN** the build runs with `KYCHON_PROJECT=eagles`
- **THEN** the generator reads `src/seeds/eagles.ts`
- **THEN** the bake in `Portal.astro` reads the same module

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

### Requirement: `embed` block-type with provider routing

The `BLOCK_TYPES` registry SHALL include an `embed` entry that renders a third-party iframe via a registered provider. The block SHALL be `dynamic: false` (renderer emits the iframe markup directly; no API fetch). Configuration SHALL include `heading` (optional), `provider` (one of the registered provider ids), `params` (provider-specific parameter object validated against the provider's `paramsSchema`), `height` (used for non-responsive providers), `responsive` (boolean), and — for the `iframe` provider only — `trust_acknowledged` (boolean, defaulting `false` until the admin opts in).

The renderer SHALL dispatch to the provider's `buildSrc(params)` to construct the iframe URL. The renderer SHALL emit `<iframe>` with the provider's declared `sandbox` attribute, `loading="lazy"`, and a `title` attribute derived from `heading` or the provider label. The renderer SHALL refuse to emit the iframe and SHALL emit a visible error placeholder if (a) the provider is not in the registry, (b) `buildSrc` throws, or (c) the provider is `iframe` and `trust_acknowledged !== true`.

#### Scenario: YouTube embed renders with provider URL
- **WHEN** an embed block has `provider = 'youtube', params = { video_id: 'abcd1234' }`
- **THEN** the rendered HTML contains `<iframe src="https://www.youtube.com/embed/abcd1234" sandbox="allow-scripts allow-same-origin allow-presentation" loading="lazy" ...>`

#### Scenario: Weather embed renders with location param
- **WHEN** an embed block has `provider = 'weather', params = { location: 'Alexandria, VA', units: 'imperial', days: 5 }`
- **THEN** the rendered iframe `src` is built by the weather provider's `buildSrc` from those params

#### Scenario: Iframe provider without trust acknowledgment renders error
- **WHEN** an embed block has `provider = 'iframe', params = { src: 'https://example.com' }, trust_acknowledged = false`
- **THEN** the rendered HTML is an error placeholder (`<section class="block-embed block-embed--error">`)
- **THEN** no `<iframe>` element is emitted

#### Scenario: Unknown provider renders error
- **WHEN** an embed block has `provider = 'unregistered'`
- **THEN** the renderer emits the error placeholder identifying the unknown provider

#### Scenario: Responsive video providers use aspect-ratio
- **WHEN** an embed block has `provider = 'youtube'` and `responsive: true`
- **THEN** the rendered section uses CSS `aspect-ratio: 16 / 9` so the iframe scales fluidly with viewport width

#### Scenario: Fixed-height non-responsive providers use config.height
- **WHEN** an embed block has `provider = 'calendly'` and `height: '700px'`
- **THEN** the rendered iframe has style `height: 700px`

### Requirement: Embed block edit popover routes by provider

The embed block's edit popover in `AdminEditor` SHALL render a provider selector at the top. Selecting a provider SHALL render a params form generated from the provider's `paramsSchema`. The form SHALL render appropriate input types (`text`, `number`, `select`) per schema entry, with required-field markers and inline help text.

For YouTube and Vimeo providers, the popover SHALL include a helper button that extracts the video ID from a pasted URL. For the `iframe` provider, the popover SHALL render the trust-acknowledgment gate and SHALL disable the Save button until the admin checks the "I trust {hostname}" checkbox.

#### Scenario: Provider selector drives the params form
- **WHEN** an admin opens the embed block popover and selects `vimeo`
- **THEN** the params form shows a single `video_id` text input (per the vimeo provider's paramsSchema)

#### Scenario: YouTube URL helper extracts video ID
- **WHEN** an admin clicks the "Paste URL" helper and pastes `https://www.youtube.com/watch?v=abcd1234`
- **THEN** the `video_id` field is auto-filled with `abcd1234`

#### Scenario: Trust gate hostname matches src
- **WHEN** an admin selects the iframe provider and types `https://example.com/widget`
- **THEN** the trust checkbox label reads "I trust example.com"
- **WHEN** the admin changes the URL to `https://other.com/widget`
- **THEN** the checkbox label updates to "I trust other.com"
- **THEN** any prior check is cleared (the admin must re-acknowledge for the new host)

### Requirement: Block registry includes copied-theme fidelity block types

The `BLOCK_TYPES` registry SHALL include copied-theme fidelity block support. At minimum, it SHALL include `image_accordion` and `shape_divider` block types, and the existing `slideshow` block SHALL support the rich carousel configuration required by `copied-theme-fidelity`.

Each copied-theme block type SHALL define `render(section, ctx)`, `defaultConfig`, `label`, `icon`, `dynamic`, `zoneHints`, and `supportedSpans` where appropriate. The defaults SHALL render a safe editable starting point when an admin adds the block through the picker.

#### Scenario: Admin can add image accordion
- **WHEN** an admin opens the main-zone block picker
- **THEN** `image_accordion` appears as an available block type
- **WHEN** the admin adds it
- **THEN** the new section uses the block's structured `defaultConfig`

#### Scenario: Admin can add shape divider
- **WHEN** an admin opens the main-zone block picker
- **THEN** `shape_divider` appears as an available block type
- **WHEN** the admin adds it
- **THEN** the new section uses the block's structured `defaultConfig`

#### Scenario: Shape divider can render full width
- **WHEN** a `shape_divider` block is rendered in a zone where the source design requires full-width section transition
- **THEN** the block can opt out of the normal constrained `.container` wrapper
- **THEN** the divider spans the intended viewport or zone width

#### Scenario: Existing block rendering remains registry-based
- **WHEN** `image_accordion`, `shape_divider`, or rich `slideshow` sections render at build time or runtime
- **THEN** they render through `renderBlock(section, ctx)` and the `BLOCK_TYPES` registry

### Requirement: Nav block supports source-imported presentation and behavior

The `nav` block's config SHALL support optional source-imported presentation and behavior fields while preserving the existing `config.items` navigation model. These fields SHALL cover header footprint, logo/header sizing hooks, source typography, nav spacing, parent/child colors, chevron styling, dropdown width/offset/shadow/border, transition timing, desktop hover/focus behavior, mobile breakpoint, and mobile open/closed layout behavior.

The nav renderer SHALL scope source-imported presentation to the nav block using data attributes and CSS custom properties. Missing presentation/behavior fields SHALL fall back to current Kychon nav behavior.

#### Scenario: Existing nav config still renders
- **WHEN** a `nav` block only has `config.items`
- **THEN** the nav renders with existing flat/nested Kychon behavior
- **THEN** no source-imported presentation fields are required

#### Scenario: Source-imported dropdown styling applies
- **WHEN** a `nav` block has dropdown presentation config for colors, border, shadow, width, offset, chevron, and transition timing
- **THEN** the rendered nav exposes scoped variables or data attributes for those values
- **THEN** dropdown children render with the configured source-like presentation

#### Scenario: Source mobile closed layout does not overlay content
- **WHEN** a `nav` block configures a mobile breakpoint and closed layout behavior that keeps nav links hidden
- **WHEN** the page is rendered at or below that breakpoint
- **THEN** closed nav links are not visible
- **THEN** the closed nav does not cover the hero or first content block unless overlay behavior is explicitly configured

#### Scenario: Source mobile open layout expands predictably
- **WHEN** a user opens the mobile hamburger menu for a source-configured `nav` block
- **THEN** nav links and dropdown children use the configured mobile open layout
- **THEN** inactive links remain readable against the configured menu background

### Requirement: Copied-theme block editors expose structured config

Admin editing SHALL provide type-specific config editors for copied-theme blocks and rich carousel settings. The generic section edit popover SHALL continue to handle width, scope, and remove. Type-specific editors SHALL handle structured arrays, SVG layers, source presentation fields, and interaction settings without requiring raw JSON editing.

At minimum, editors SHALL support:

- rich carousel settings on `slideshow`
- panel editing on `image_accordion`
- path/layer/orientation editing on `shape_divider`
- presentation/behavior editing on `nav`

#### Scenario: Generic popover routes to copied-theme editor
- **WHEN** an admin opens the section edit popover for `image_accordion`, `shape_divider`, `slideshow`, or `nav`
- **THEN** the popover exposes a settings action for that block's structured config
- **WHEN** the admin opens settings
- **THEN** a type-specific editor appears

#### Scenario: Type-specific editor saves structured config
- **WHEN** an admin changes panel, layer, carousel, or nav presentation fields in a type-specific editor
- **THEN** the system PATCHes the section's `config` JSON with structured values
- **THEN** `wl_cache_sections_*` entries are invalidated
- **THEN** `wl-content-rendered` is dispatched so the rendered block updates

#### Scenario: Inline editing still works for simple fields
- **WHEN** an `image_accordion` panel title or rich carousel heading is exposed as inline editable text
- **THEN** inline editing updates the corresponding nested structured config path
- **THEN** the type-specific editor remains able to edit the same config after reload

### Requirement: Copied-theme blocks participate in column spans and zones

Copied-theme block types SHALL participate in the existing column-span and zone system. Blocks SHALL declare supported spans matching their layout needs, and rendering SHALL attach `data-column-span` through the existing `renderBlock` post-process.

#### Scenario: Full-width-only copied-theme block constrains span picker
- **WHEN** a copied-theme block type declares `supportedSpans: ['1']`
- **THEN** its section edit popover renders only the full-width option

#### Scenario: Accordion can use normal grid spans
- **WHEN** an `image_accordion` block declares multiple supported spans
- **THEN** the span picker shows only those supported spans
- **THEN** the rendered block flows through the existing zone grid rules

#### Scenario: Shape divider preserves span and full-bleed behavior
- **WHEN** a `shape_divider` section is moved or re-rendered
- **THEN** the section preserves its configured span
- **THEN** full-bleed rendering remains controlled by the block type rather than ad hoc wrapper markup

