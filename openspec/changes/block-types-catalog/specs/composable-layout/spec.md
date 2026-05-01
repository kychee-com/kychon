## ADDED Requirements

### Requirement: `tagline_strip` block-type

The `BLOCK_TYPES` registry SHALL include a `tagline_strip` entry that renders a full-width text band with no CTA. The block SHALL be `dynamic: false`. Configuration SHALL include `text` (required), `color_scheme` (`'dark' | 'light' | 'primary' | 'accent'`, default `'primary'`), `size` (`'small' | 'medium' | 'large'`, default `'medium'`), `alignment` (`'left' | 'center' | 'right'`, default `'center'`), and optional `icon`. The four `color_scheme` values SHALL map to existing CSS custom-prop sets without introducing new design tokens. The renderer SHALL produce no JavaScript.

#### Scenario: Tagline renders as a full-width band
- **WHEN** a `tagline_strip` block has `text = "Founded 1880"` and `color_scheme = "dark"`
- **THEN** the rendered HTML is a `<section class="block-tagline-strip block-tagline-strip--dark block-tagline-strip--medium">` containing a centered text element

#### Scenario: Color schemes adapt to dark mode
- **WHEN** a `tagline_strip` with `color_scheme = "dark"` renders in dark mode
- **THEN** CSS custom properties for the dark scheme produce readable text against a darker (or otherwise differentiated) background; the section does not appear blank

#### Scenario: Optional icon renders inline
- **WHEN** a `tagline_strip` has `icon = "anchor"`
- **THEN** the rendered HTML contains the anchor icon inline, before the text

### Requirement: `page_banner` block-type

The `BLOCK_TYPES` registry SHALL include a `page_banner` entry intended for `zone = 'header'` with `scope = 'page'`. The block SHALL be `dynamic: false`. Configuration SHALL include `image_url`, `image_alt`, optional `caption_html` (sanitized via the same allowlist as hero foreground caption — `<br>`, `<strong>`, `<em>`, `<a href>` only), `height` (`'small' | 'medium' | 'large' | 'auto'`, default `'medium'`), and optional `overlay_color`. The block SHALL render only on the page whose `slug` matches its `page_slug`.

#### Scenario: Page banner renders above page content
- **WHEN** a `page_banner` exists for `page_slug = 'about', scope = 'page', zone = 'header'`
- **WHEN** the user navigates to `/page.html?slug=about`
- **THEN** the page renders the banner between the global header chrome and the main page content
- **WHEN** the user navigates to a different page
- **THEN** the banner does not render

#### Scenario: Banner heights map to discrete sizes
- **WHEN** a `page_banner` has `height = 'small'`
- **THEN** the banner section has CSS height `200px` (or equivalent design token)
- **WHEN** a `page_banner` has `height = 'auto'`
- **THEN** the banner uses the image's intrinsic aspect ratio (`aspect-ratio: auto`)

#### Scenario: Banner caption is sanitized
- **WHEN** an admin saves a page_banner with `caption_html = "<script>alert(1)</script>Welcome!"`
- **THEN** the rendered output contains `Welcome!` only (script tag stripped by the shared sanitizer)

### Requirement: `link_list` block-type with manual or resources source

The `BLOCK_TYPES` registry SHALL include a `link_list` entry that supports two source modes via `config.source`. When `source = 'manual'`, items are rendered from `config.items[]` directly; the block is statically rendered. When `source = 'resources'`, the renderer emits a hydration skeleton (`dynamic: true` semantics for that instance), and the runtime hydrator fetches from `resources` table filtered by `config.filter` (which carries `category`, `limit`, `order`). The block supports three layouts via `config.layout`: `'bullets'`, `'rows'` (with date column), `'compact'` (inline pills).

#### Scenario: Manual link list renders all configured items
- **WHEN** a `link_list` has `source = 'manual'` and three items in `config.items`
- **THEN** the rendered HTML contains all three items as anchors

#### Scenario: Resources link list hydrates from API
- **WHEN** a `link_list` has `source = 'resources', filter = { category: 'newsletters', limit: 6, order: 'newest' }`
- **THEN** the bake renders a skeleton with `data-block-hydrate="link_list"` and config in `data-config`
- **WHEN** the runtime hydrator runs
- **THEN** it fetches `resources?category=eq.newsletters&order=created_at.desc&limit=6` and replaces the skeleton with the response items

#### Scenario: Empty resources result hides the section
- **WHEN** a `link_list` resources query returns zero items
- **THEN** the section is hidden entirely (`display: none`) rather than showing a heading with empty content

#### Scenario: External items emit security-correct attributes
- **WHEN** a manual item has `external: true` and `href = 'https://example.com'`
- **THEN** the rendered anchor has `target="_blank"` and `rel="noopener noreferrer"` and an external-link icon

#### Scenario: Item badges render inline
- **WHEN** a manual item has `badge = 'PDF'`
- **THEN** the rendered anchor contains an inline pill labeled `PDF` before the label text

### Requirement: `promo_cards` block-type

The `BLOCK_TYPES` registry SHALL include a `promo_cards` entry that renders a CSS-Grid layout of image-card links. The block SHALL be `dynamic: false`. Configuration SHALL include `heading` (optional), `columns` (`2 | 3 | 4`, default `3`), and `items[]` where each item carries `image_url`, `image_alt`, `title`, `title_position` (`'top' | 'bottom'`, default `'top'`), `cta_text`, `cta_href`, optional `overlay_color`. Each card SHALL be a single `<a>` element wrapping the entire card; the CTA inside is visual reinforcement, not a separate link. The grid SHALL be responsive: `columns` collapses to 2 columns at tablet width and 1 column at mobile width.

#### Scenario: 4-column grid renders with responsive collapse
- **WHEN** a `promo_cards` has `columns = 4` with 4 items
- **THEN** the rendered grid has `grid-template-columns: repeat(4, 1fr)` at desktop width
- **THEN** at viewport width ≤ 1024px, the grid collapses to 2 columns
- **THEN** at viewport width ≤ 640px, the grid collapses to 1 column

#### Scenario: Each card is one accessible link
- **WHEN** a `promo_cards` item has `title = "Membership"` and `cta_text = "Click Here to Learn More"`
- **THEN** the rendered card is a single `<a>` element with `aria-label="Membership, Click Here to Learn More"` (or equivalent)
- **THEN** the inner CTA is rendered as a `<span>` (not a nested `<a>`)

#### Scenario: Optional overlay color darkens the image
- **WHEN** a `promo_cards` item has `overlay_color = "rgba(0,0,0,0.4)"`
- **THEN** the card's image area has a semi-transparent overlay layer with that color above the background image

#### Scenario: Missing image_alt produces a build-time warning
- **WHEN** the seed-SQL generator processes a `promo_cards` item with empty `image_alt`
- **THEN** the generator emits a non-fatal warning to stderr identifying the seed and item index

### Requirement: `events_list` block-type

The `BLOCK_TYPES` registry SHALL include an `events_list` entry that fetches events from the database and renders them in one of three layouts. The block SHALL be `dynamic: true`. Configuration SHALL include `heading`, `count` (default `4`), `filter` (`'upcoming' | 'past' | 'this_week'`, with `'featured'` reserved for a future schema addition), `show_image`, `show_location`, `show_time`, `layout` (`'sidebar' | 'grid' | 'list'`, default `'sidebar'`), and `color_scheme`. Each filter SHALL map to a deterministic PostgREST query against the `events` table. Times SHALL render in the visitor's local timezone using `toLocaleString` with locale resolution from `getLocale()`. Empty results SHALL render an inline placeholder (`"No upcoming events."`) rather than hiding the section.

#### Scenario: Upcoming filter queries events from now forward
- **WHEN** an `events_list` has `filter = 'upcoming', count = 4`
- **THEN** the runtime hydrator fetches `events?starts_at=gte.{now}&order=starts_at.asc&limit=4`

#### Scenario: This-week filter queries the next 7 days
- **WHEN** an `events_list` has `filter = 'this_week'`
- **THEN** the hydrator fetches with `starts_at` between `now` and `now + 7 days`

#### Scenario: Three layouts produce distinct DOM structures
- **WHEN** an `events_list` has `layout = 'sidebar'`
- **THEN** the rendered DOM is a vertical list of cards
- **WHEN** an `events_list` has `layout = 'grid'`
- **THEN** the rendered DOM is a responsive grid of 3-up cards
- **WHEN** an `events_list` has `layout = 'list'`
- **THEN** the rendered DOM is a compact rows layout

#### Scenario: Times render in the visitor's timezone
- **WHEN** an event has `starts_at = '2026-05-15T18:00:00Z'`
- **WHEN** a visitor in `America/New_York` views the events_list
- **THEN** the rendered time shows `2:00 PM` (Eastern) or equivalent localized form
- **WHEN** a visitor in `Europe/London` views the same list
- **THEN** the rendered time shows `7:00 PM` (BST) or equivalent

#### Scenario: Empty result shows placeholder
- **WHEN** an `events_list` query returns zero events
- **THEN** the rendered output replaces the skeleton with `<p class="text-muted">No upcoming events.</p>`

#### Scenario: Loading skeleton renders while fetch is in flight
- **WHEN** the bake produces an events_list section
- **THEN** the baked HTML contains `count` placeholder skeleton cards with a CSS pulse animation
- **WHEN** the fetch resolves
- **THEN** the skeleton is replaced with the actual events markup

### Requirement: `slideshow` block-type with a11y and reduced-motion

The `BLOCK_TYPES` registry SHALL include a `slideshow` entry that renders an auto-rotating image carousel with full keyboard, screen reader, and reduced-motion support. The block SHALL be `dynamic: true`. Configuration SHALL include `heading` (optional), `items[]` (each carrying `src`, `alt`, optional `caption`, optional `href`), `auto_rotate_seconds` (default `5`, `0` disables rotation), `show_arrows`, `show_dots`, `aspect_ratio` (default `'16/9'`), `fit` (`'cover' | 'contain'`, default `'cover'`), and `transition` (`'fade' | 'slide'`, default `'fade'`).

The slideshow SHALL pause auto-rotation when (a) any element inside has `:focus-within`, (b) the cursor hovers anywhere over the slideshow, or (c) `document.visibilityState !== 'visible'`. The slideshow SHALL respect `prefers-reduced-motion: reduce` by disabling auto-rotation entirely. Off-screen slides SHALL use `loading="lazy"`. The total inline JavaScript footprint SHALL be ≤ 4 kB minified.

#### Scenario: Slideshow auto-rotates by default
- **WHEN** a slideshow with `auto_rotate_seconds = 5` is hydrated
- **THEN** every 5 seconds the active slide advances to the next slide, wrapping at the end

#### Scenario: Hover pauses rotation
- **WHEN** the cursor enters the slideshow container
- **THEN** the auto-rotate interval is paused
- **WHEN** the cursor leaves
- **THEN** the auto-rotate interval resumes

#### Scenario: Tab visibility pauses rotation
- **WHEN** the browser tab is hidden (`document.visibilityState !== 'visible'`)
- **THEN** the auto-rotate interval is paused
- **WHEN** the tab becomes visible again
- **THEN** rotation resumes

#### Scenario: Reduced-motion disables auto-rotation
- **WHEN** the visitor's OS reports `prefers-reduced-motion: reduce`
- **THEN** no `setInterval` is registered for auto-rotation
- **THEN** transitions between slides are instant (no fade)
- **THEN** navigation works only via user input (arrow keys, dots, arrows)

#### Scenario: Arrow keys navigate when slideshow has focus
- **WHEN** the slideshow has keyboard focus
- **WHEN** the user presses `→`
- **THEN** the next slide becomes active
- **WHEN** the user presses `←`
- **THEN** the previous slide becomes active

#### Scenario: Dots are accessible
- **WHEN** a slideshow has 3 slides
- **THEN** the rendered HTML contains 3 `<button>` dot elements with `aria-label="Slide N of 3"` each
- **THEN** the active dot has `aria-current="true"`
- **WHEN** the user clicks a dot
- **THEN** the corresponding slide becomes active

#### Scenario: Live region announces slide changes
- **WHEN** the active slide changes (by any input)
- **THEN** a polite live region (`aria-live="polite"`) updates with the new slide's caption (or "Slide N of M" if no caption)

#### Scenario: Off-screen slides lazy-load
- **WHEN** a slideshow is hydrated with 5 slides
- **THEN** the first slide's image has `loading="eager"`
- **THEN** slides 2-5 have `loading="lazy"`

#### Scenario: Cleanup clears intervals on swap
- **WHEN** an SPA navigation removes the slideshow element from the DOM
- **THEN** the cleanup hook clears the slideshow's `setInterval` handle, preventing memory leaks

## MODIFIED Requirements

### Requirement: Block-type registry includes chrome and footer types

The `BLOCK_TYPES` registry in `src/lib/blocks.ts` SHALL include, at minimum, the following block types:

**Main-zone:** `hero`, `features`, `cta`, `stats`, `testimonials`, `faq`, `polls` (dynamic), `event_countdown`, `activity_feed` (dynamic), `announcements_feed` (dynamic), `tagline_strip`, `link_list` (dynamic in resources mode), `promo_cards`, `events_list` (dynamic), `slideshow` (dynamic).

**Header-zone:** `nav`, `brand_header`, `sign_in_bar`, `page_banner`.

**Footer-zone:** `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`.

Each entry SHALL define `defaultConfig` providing a working starting point when an admin adds a new block of that type via the picker.

#### Scenario: Picker filters by zoneHints
- **WHEN** an admin opens the block picker in the header zone
- **THEN** the picker shows block types whose `zoneHints` includes `'header'` (`brand_header`, `nav`, `sign_in_bar`, `page_banner`)
- **WHEN** an admin opens the picker in the main zone
- **THEN** the picker shows the long list of main-zone block types

#### Scenario: Each new block-type has a usable defaultConfig
- **WHEN** an admin adds a new `slideshow` block via the picker
- **THEN** the new section's `config` is `BLOCK_TYPES.slideshow.defaultConfig` — a working slideshow with 1-2 placeholder slides and sensible defaults

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
