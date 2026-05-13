## Purpose

Kychon's frontend UI is driven by `sections` rows and `site_config` values so navigation, page composition, theme, branding, feature flags, translations, and visual polish can update from configuration and cache without code edits.
## Requirements
### Requirement: Config-driven navigation

The nav config SHALL include items for events, resources, forum, and committees, each gated by their respective feature flag. Kychon-owned navigation hrefs SHALL use clean public paths when a clean public path exists.

#### Scenario: Events nav item shown when enabled
- **WHEN** `feature_events` is true
- **THEN** the nav includes an "Events" link to `/events`

#### Scenario: Forum nav item hidden when disabled
- **WHEN** `feature_forum` is false
- **THEN** the nav does not include a "Forum" link

#### Scenario: Legacy configured nav href is canonicalized
- **WHEN** stored navigation config contains a Kychon-owned href such as `/events.html`
- **THEN** rendered navigation uses `/events`
- **AND** it does not render `/events.html` as the public href

<!-- Phase 2 additions: added requirements -->

### Requirement: Theme injection via CSS custom properties

`src/lib/config.ts` SHALL read the `theme` JSONB from `site_config` and set CSS custom properties on `document.documentElement`. On repeat visits, theme SHALL be applied immediately from cached data. Properties SHALL include: `--color-primary`, `--color-primary-hover`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--font-heading`, `--font-body`, `--radius`, `--max-width`.

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

`src/pages/page.astro` SHALL build a generic `page.html` route. Given a `?slug=about` query parameter, it SHALL fetch the `pages` row with that slug and render its `content`. It SHALL also fetch associated `sections` and render them.

#### Scenario: Custom page renders
- **WHEN** a user visits `page.html?slug=about`
- **THEN** the page title and content from the `pages` row are displayed
- **THEN** any associated sections are rendered below

#### Scenario: Auth-gated custom page
- **WHEN** a page has `requires_auth = true` and the user is not logged in
- **THEN** the user is redirected to login

### Requirement: Site branding from config

`src/lib/config.ts` SHALL set the page title from `site_config.site_name`, display the logo from `site_config.logo_url`, and set the favicon from `site_config.favicon_url`. On repeat visits, branding SHALL be applied immediately from cached data.

#### Scenario: Branding applied instantly from cache
- **WHEN** a page loads with cached `site_config` containing branding data
- **THEN** `document.title`, logo, and favicon are set before any network request completes

#### Scenario: Branding applied on load
- **WHEN** any page loads
- **THEN** `document.title` includes the site name
- **THEN** the header shows the logo image
- **THEN** the favicon link element points to the configured URL

<!-- Phase 2 additions -->

### Requirement: Config-driven navigation

The nav config SHALL include items for events, resources, forum, and committees, each gated by their respective feature flag. Kychon-owned navigation hrefs SHALL use clean public paths when a clean public path exists.

#### Scenario: Events nav item shown when enabled
- **WHEN** `feature_events` is true
- **THEN** the nav includes an "Events" link to `/events`

#### Scenario: Forum nav item hidden when disabled
- **WHEN** `feature_forum` is false
- **THEN** the nav does not include a "Forum" link

#### Scenario: Legacy configured nav href is canonicalized
- **WHEN** stored navigation config contains a Kychon-owned href such as `/events.html`
- **THEN** rendered navigation uses `/events`
- **AND** it does not render `/events.html` as the public href

<!-- Phase 2 additions: added requirements -->

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

When `site_config` is read from cache in `src/lib/config.ts`, the init function SHALL check for a hero background image URL in the cached sections data or site_config. If found, it SHALL inject a `<link rel="preload" as="image" href="...">` tag into `<head>` immediately, before any API calls complete. This allows the browser to start downloading the hero image in parallel with data fetches.

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

### Requirement: Theme injection supports source interaction state tokens

`site_config.theme` SHALL support optional source interaction-state tokens in addition to the existing base theme tokens. The theme injector SHALL map supported interaction tokens onto CSS custom properties on `document.documentElement` or scoped style elements before copied-theme blocks render.

Supported interaction tokens SHALL include hover and focus state values for background, text, icon, border, shadow, transform, transition duration, and transition easing. The system SHALL provide reusable defaults for buttons, CTA links, cards, nav links, social icons, carousel controls, and hover-reveal panels. Blocks MAY override theme-level interaction tokens through their own structured config.

#### Scenario: Hover token is injected
- **WHEN** `site_config.theme` contains a button hover background token
- **THEN** the theme injector sets the corresponding CSS custom property
- **THEN** buttons or CTAs using that token render the configured hover background

#### Scenario: Focus token is injected
- **WHEN** `site_config.theme` contains a focus outline or focus color token
- **THEN** keyboard focus states use the configured token
- **THEN** the focus state remains visible

#### Scenario: Block override wins over theme default
- **WHEN** a copied-theme block config contains an interaction override for a specific hover color or transform
- **THEN** that block uses the override
- **THEN** other blocks continue to use the theme-level interaction token

#### Scenario: Missing interaction tokens fall back safely
- **WHEN** `site_config.theme` does not define copied-theme interaction tokens
- **THEN** existing Kychon hover/focus/transition styling remains in effect
- **THEN** no copied-theme block requires interaction tokens to render

### Requirement: Theme injection supports source header and nav presentation tokens

`site_config.theme` SHALL support optional header/nav presentation tokens for copied themes. Supported tokens SHALL include header height or padding, logo max height/width, nav font family/size/weight, nav link spacing, nav background, dropdown background, dropdown border, dropdown shadow, chevron color, active/hover colors, mobile breakpoint, mobile menu background, and mobile menu spacing.

These tokens SHALL be available to the `nav` and `brand_header` blocks through CSS custom properties or scoped style data. Missing tokens SHALL fall back to the existing Kychon header/nav presentation.

#### Scenario: Header footprint tokens apply
- **WHEN** `site_config.theme` contains header padding and logo max-height tokens
- **THEN** the header and brand/logo render with those source-like dimensions
- **THEN** the nav remains in normal document flow unless overlay behavior is explicitly configured

#### Scenario: Dropdown presentation tokens apply
- **WHEN** `site_config.theme` contains dropdown background, border, shadow, and transition tokens
- **THEN** source-configured nav dropdowns use those visual tokens
- **THEN** keyboard and pointer dropdown behavior remains unchanged

#### Scenario: Mobile menu presentation tokens apply
- **WHEN** `site_config.theme` contains mobile menu background and spacing tokens
- **WHEN** the nav menu is opened at the mobile breakpoint
- **THEN** the mobile menu renders with those source-like values
- **THEN** inactive links remain readable

### Requirement: Theme token application is cache-friendly

Copied-theme interaction and header/nav tokens SHALL follow the existing cache-first theme application model. When cached `site_config` contains copied-theme tokens, the system SHALL apply those tokens before network refresh so returning visitors do not see a flash of generic Kychon hover/nav styling.

#### Scenario: Returning visitor gets copied-theme tokens before fetch
- **WHEN** a returning visitor loads a copied-theme site with cached `site_config.theme`
- **THEN** copied-theme interaction and header/nav tokens are applied before the fresh config request completes
- **THEN** the first rendered hover/nav state uses copied-theme values rather than generic defaults

#### Scenario: Fresh config refresh updates copied-theme tokens
- **WHEN** an admin changes copied-theme interaction or nav tokens
- **WHEN** another visitor's stale cache is refreshed
- **THEN** the new tokens are applied after the refresh without a full page reload
