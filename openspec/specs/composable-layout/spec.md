## ADDED Requirements

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

**Main-zone (carried over from existing renderers):** `hero`, `features`, `cta`, `stats`, `testimonials`, `faq`, `polls` (dynamic), `event_countdown`, `activity_feed` (dynamic), `announcements_feed` (dynamic).

**Header-zone:** `nav`, `brand_header`, `sign_in_bar`.

**Footer-zone:** `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`.

Each entry SHALL define `defaultConfig` providing a working starting point when an admin adds a new block of that type via the picker.

#### Scenario: Admin adds a footer address block
- **WHEN** an admin opens the block picker in the footer zone
- **THEN** `footer_address` appears as an option
- **WHEN** the admin selects it
- **THEN** a new sections row is created with `BLOCK_TYPES.footer_address.defaultConfig` as its starting config
- **THEN** the footer renders the new block immediately

#### Scenario: Footer attribution block defaults to Powered-by-Kychon
- **WHEN** the kychon template seed is generated
- **THEN** the seed includes a `footer_attribution` block with `config.text = "Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)"`

#### Scenario: Footer copyright supports auto year
- **WHEN** a `footer_copyright` block has `config.year = 'auto'`
- **THEN** the rendered HTML contains a `<span data-year="auto">` element
- **THEN** an inline script sets the span's text to the current year on page load

### Requirement: `nav` block carries the navigation that used to live in `site_config.nav`

The `site_config.nav` key SHALL be removed from the system. Navigation SHALL be expressed as a `nav` block in `zone = 'header'`. The `nav` block's `config.items` SHALL be the array shape previously stored under `site_config.nav` (each item carries `label`, `href`, `icon`, and optional `public`, `auth`, `feature`, `admin`, `children` properties). The block edit popover SHALL be the editor surface for nav items, replacing the separate nav editor that wrote to `site_config`.

#### Scenario: Site nav comes from a sections row, not site_config
- **WHEN** a Kychon page loads
- **THEN** the navigation in the header zone is rendered by `BLOCK_TYPES.nav.render` against the `nav` block's `config.items`
- **THEN** no code path reads `site_config.nav`

#### Scenario: Admin edits nav via the block popover
- **WHEN** an admin clicks the edit affordance on the `nav` block in the header
- **THEN** a popover opens with the nav items as editable rows (label, href, visibility flags, drag-reorder)
- **WHEN** the admin saves
- **THEN** the system PATCHes the `nav` block's `config.items`

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
