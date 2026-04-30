## MODIFIED Requirements

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
