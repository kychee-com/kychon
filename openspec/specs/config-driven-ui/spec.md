## ADDED Requirements

### Requirement: Config-driven navigation

Navigation SHALL be rendered from a `nav` block stored in the `sections` table at `zone = 'header'`. The block's `config.items` SHALL be an array where each item carries `label`, `href`, `icon`, and optional `public`, `auth`, `feature`, `admin`, and `children` properties. Items SHALL be filtered based on: feature flags (hide if flag is false), auth state (hide `auth: true` items for anonymous users), and admin role (hide `admin: true` items for non-admins). On repeat visits, navigation SHALL be rendered immediately from the cached `sections` data (per-slug `wl_cache_sections_{slug}` and global `wl_cache_sections__global`) without waiting for a network request. If the cached data is stale, a background fetch SHALL update the nav if the data has changed. On first visit (no cache), navigation SHALL paint from the build-time bake of the chrome zones.

The system SHALL NOT read navigation data from `site_config.nav`. The `site_config.nav` key SHALL NOT be seeded by the generator and SHALL be removed from any pre-existing database during this change's rollout.

#### Scenario: Nav renders instantly from build-time bake on cold visit
- **WHEN** a first-time visitor (empty localStorage) loads a Kychon page
- **THEN** the header zone is populated by build-time-baked HTML for the `nav` block on the first frame

#### Scenario: Nav renders immediately from cache on warm visit
- **WHEN** a returning visitor loads a page and `wl_cache_sections__global` exists with a `nav` block
- **THEN** navigation links are rendered before any API call completes

#### Scenario: Nav updates after background refresh
- **WHEN** an admin adds a new nav item and another visitor loads a page with stale cache
- **THEN** navigation initially shows the cached items
- **THEN** after the background refresh, the new nav item appears without a page reload

#### Scenario: Feature flag hides nav item
- **WHEN** `feature_forum` is `false` in `site_config`
- **THEN** the nav item with `feature: "feature_forum"` is not rendered

#### Scenario: Auth-gated nav item hidden for anonymous
- **WHEN** a user is not logged in
- **THEN** nav items with `auth: true` are not shown

#### Scenario: Admin nav items visible to admins only
- **WHEN** a user with `role = 'admin'` loads the page
- **THEN** nav items with `admin: true` are shown
- **WHEN** a user with `role = 'member'` loads the page
- **THEN** nav items with `admin: true` are hidden

#### Scenario: site_config.nav is no longer read
- **WHEN** any rendering path executes
- **THEN** no code reads `site_config.nav`
- **THEN** removing `site_config.nav` from the database has no effect on navigation

### Requirement: Theme injection via CSS custom properties

`config.js` SHALL read the `theme` JSONB from `site_config` and set CSS custom properties on `document.documentElement`. On repeat visits, theme SHALL be applied immediately from cached data. Properties SHALL include: `--color-primary`, `--color-primary-hover`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--font-heading`, `--font-body`, `--radius`, `--max-width`.

#### Scenario: Theme applied instantly from cache
- **WHEN** a page loads with cached `site_config` containing theme data
- **THEN** CSS custom properties are set before the first paint

#### Scenario: Theme colors applied
- **WHEN** `site_config` theme has `primary: "#6366f1"`
- **THEN** `document.documentElement.style` has `--color-primary: #6366f1`
- **THEN** all elements using `var(--color-primary)` render in that color

#### Scenario: Default theme from CSS
- **WHEN** `site_config` theme values are not yet loaded (or missing) and no cache exists
- **THEN** `theme.css` defaults are used

### Requirement: Schema-driven page composition

The system SHALL render every page (home, custom pages, events, directory, etc.) by fetching `sections` rows for that page in a single query that returns chrome and main blocks together (`page_slug = $current_slug AND scope = 'page'` OR `scope = 'global'`), grouping the result by `zone`, and dispatching each block to the matching zone container via `renderBlock(section, ctx)`. The schema-driven model SHALL apply to chrome zones (`'header'`, `'footer'`) as well as main content (`'main'`). Each section SHALL be rendered based on its `section_type` using the registry in `src/lib/blocks.ts` and the `config` JSONB for content. Main-zone sections SHALL start invisible and animate in on scroll via IntersectionObserver (see `scroll-animations` spec). Chrome-zone sections SHALL paint immediately with no scroll animation. The `stats` section SHALL animate its numbers from 0 on scroll entry. The `hero` section SHALL apply a parallax effect when a `bg_image` is configured (see `hero-parallax` spec).

#### Scenario: Single fetch covers all zones
- **WHEN** a page loads
- **THEN** one PostgREST request returns blocks for all three zones
- **THEN** the renderer groups results by `zone` and renders each group into its container

#### Scenario: Chrome zones paint without scroll animation
- **WHEN** the runtime hydrate replaces a header or footer zone's HTML
- **THEN** the new HTML is visible immediately, with no `section-visible` opacity ramp

#### Scenario: Main-zone sections animate on scroll as before
- **WHEN** a main-zone section enters the viewport
- **THEN** it acquires `section-visible` and animates in (existing scroll-animations behavior)

#### Scenario: Hero section renders with parallax
- **WHEN** a section with `section_type = 'hero'` exists in `zone = 'main'` and has a `bg_image` in its config
- **THEN** the homepage shows a hero with heading, subheading, CTA button, and background image
- **THEN** the background image has a parallax scroll effect (moves at 0.3x scroll speed)

#### Scenario: Hero section renders without parallax
- **WHEN** a section with `section_type = 'hero'` exists without a `bg_image`
- **THEN** the hero renders with the gradient fallback and no parallax behavior

#### Scenario: Stats section animates counters
- **WHEN** a section with `section_type = 'stats'` scrolls into view
- **THEN** each stat number counts up from 0 to its target value with easing

#### Scenario: Event countdown section renders
- **WHEN** a section with `section_type = 'event_countdown'` exists and `feature_events` is true
- **THEN** a countdown to the next upcoming event is rendered with days, hours, and minutes

#### Scenario: Features grid renders
- **WHEN** a section with `section_type = 'features'` exists with `columns: 3` and 3 items
- **THEN** a 3-column grid of feature cards is rendered with icons, titles, and descriptions

#### Scenario: Section visibility
- **WHEN** a section has `visible = false`
- **THEN** it is not rendered on the page

#### Scenario: Per-page chrome override
- **WHEN** a page-scoped block exists in a chrome zone for the current page AND a global block exists for the same zone
- **THEN** the page-scoped block takes precedence and renders in that zone for the current page only
- **THEN** other pages still render the global block in that zone

### Requirement: Schema-driven custom pages

`page.html` SHALL be a generic page renderer. Given a `?slug=about` query parameter, it SHALL fetch the `pages` row with that slug and render its `content`. It SHALL also fetch associated `sections` and render them.

#### Scenario: Custom page renders
- **WHEN** a user visits `page.html?slug=about`
- **THEN** the page title and content from the `pages` row are displayed
- **THEN** any associated sections are rendered below

#### Scenario: Auth-gated custom page
- **WHEN** a page has `requires_auth = true` and the user is not logged in
- **THEN** the user is redirected to login

### Requirement: Site branding from config

`config.js` SHALL set the page title from `site_config.site_name`, display the logo from `site_config.logo_url`, and set the favicon from `site_config.favicon_url`. On repeat visits, branding SHALL be applied immediately from cached data.

#### Scenario: Branding applied instantly from cache
- **WHEN** a page loads with cached `site_config` containing branding data
- **THEN** `document.title`, logo, and favicon are set before any network request completes

#### Scenario: Branding applied on load
- **WHEN** any page loads
- **THEN** `document.title` includes the site name
- **THEN** the header shows the logo image
- **THEN** the favicon link element points to the configured URL

<!-- Phase 2 additions -->
## MODIFIED Requirements

### Requirement: Config-driven navigation

The nav config SHALL include items for events, resources, forum, and committees, each gated by their respective feature flag.

#### Scenario: Events nav item shown when enabled
- **WHEN** `feature_events` is true
- **THEN** the nav includes an "Events" link to `/events.html`

#### Scenario: Forum nav item hidden when disabled
- **WHEN** `feature_forum` is false
- **THEN** the nav does not include a "Forum" link

## ADDED Requirements

### Requirement: Feature flags for new modules

The seed data SHALL include feature flags: `feature_events` (default true), `feature_resources` (default true), `feature_forum` (default false), `feature_committees` (default false). AI feature flags: `feature_ai_moderation`, `feature_ai_translation`, `feature_ai_insights`, `feature_ai_onboarding` (all default false).

#### Scenario: Events enabled by default
- **WHEN** a fresh deployment runs seed.sql
- **THEN** `feature_events` is `true` in site_config

#### Scenario: AI features disabled by default
- **WHEN** a fresh deployment runs seed.sql
- **THEN** all `feature_ai_*` flags are `false` in site_config

### Requirement: Content translation display

Pages that display announcements, events, or page content SHALL check the `content_translations` table for a translation matching the user's current locale. If a translation exists, it SHALL be displayed instead of the original content.

#### Scenario: Translated announcement shown
- **WHEN** a user with locale `pt` views an announcement that has a Portuguese translation in content_translations
- **THEN** the translated title and body are displayed

#### Scenario: Original shown when no translation exists
- **WHEN** a user with locale `pt` views content with no Portuguese translation
- **THEN** the original content is displayed

<!-- visual-polish-batch-2 additions -->
## ADDED Requirements

### Requirement: Glassmorphic navigation bar

The sticky navigation bar SHALL use `backdrop-filter: blur(12px)` with a semi-transparent background (`rgba(255,255,255,0.8)` in light mode) to create a frosted-glass effect. The solid background color SHALL remain as a fallback for browsers that do not support `backdrop-filter`.

#### Scenario: Nav over scrolled content
- **WHEN** the user scrolls and content passes behind the sticky nav
- **THEN** the content is visible as a blurred backdrop through the semi-transparent nav

#### Scenario: Browser does not support backdrop-filter
- **WHEN** the browser does not support `backdrop-filter`
- **THEN** the nav renders with a solid background color (existing fallback)

### Requirement: Gradient text on hero heading

The hero section `h1` SHALL display a text gradient using `background-clip: text` with colors derived from `--color-primary` and `--color-primary-hover`. The gradient SHALL use a 135-degree angle matching the hero section's background gradient direction.

#### Scenario: Hero heading renders with gradient
- **WHEN** a hero section is displayed
- **THEN** the h1 text shows a gradient from `--color-primary` to `--color-primary-hover`
- **THEN** the gradient adapts to any portal's theme colors

### Requirement: Hero image preloading from cached config

When `site_config` is read from cache in `config.js`, the init function SHALL check for a hero background image URL in the cached sections data or site_config. If found, it SHALL inject a `<link rel="preload" as="image" href="...">` tag into `<head>` immediately, before any API calls complete. This allows the browser to start downloading the hero image in parallel with data fetches.

#### Scenario: Cached config has hero image
- **WHEN** `site_config` is loaded from localStorage cache and contains a sections entry with a hero `bg_image`
- **THEN** a `<link rel="preload" as="image">` tag is injected into `<head>` with the image URL
- **THEN** the browser begins downloading the image before the sections API call completes

#### Scenario: No cached config (first visit)
- **WHEN** no cached `site_config` exists (cold load)
- **THEN** no preload tag is injected (hero image loads after sections fetch, as before)

#### Scenario: Hero section has no background image
- **WHEN** cached config exists but the hero section has no `bg_image`
- **THEN** no preload tag is injected
