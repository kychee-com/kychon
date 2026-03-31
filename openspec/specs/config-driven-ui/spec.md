## ADDED Requirements

### Requirement: Config-driven navigation

`config.js` SHALL read the `nav` key from `site_config` and render navigation items. Each item has `label`, `href`, `icon`, `public`, `auth`, `feature`, and `admin` properties. Items SHALL be filtered based on: feature flags (hide if flag is false), auth state (hide `auth: true` items for anonymous users), and admin role (hide `admin: true` items for non-admins).

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

### Requirement: Theme injection via CSS custom properties

`config.js` SHALL read the `theme` JSONB from `site_config` and set CSS custom properties on `document.documentElement`. Properties SHALL include: `--color-primary`, `--color-primary-hover`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--font-heading`, `--font-body`, `--radius`, `--max-width`.

#### Scenario: Theme colors applied
- **WHEN** `site_config` theme has `primary: "#6366f1"`
- **THEN** `document.documentElement.style` has `--color-primary: #6366f1`
- **THEN** all elements using `var(--color-primary)` render in that color

#### Scenario: Default theme from CSS
- **WHEN** `site_config` theme values are not yet loaded (or missing)
- **THEN** `theme.css` defaults are used

### Requirement: Schema-driven homepage sections

`config.js` SHALL read `sections` rows where `page_slug = 'index'`, ordered by `position`. Each section SHALL be rendered based on its `section_type` (hero, features, cta, stats, testimonials, faq, event-countdown, custom) using the `config` JSONB for content. All sections SHALL start invisible and animate in on scroll via IntersectionObserver (see `scroll-animations` spec). The `stats` section SHALL animate its numbers from 0 on scroll entry. The `hero` section SHALL apply a parallax effect when a `bg_image` is configured (see `hero-parallax` spec).

#### Scenario: Hero section renders with parallax
- **WHEN** a section with `section_type = 'hero'` exists and has a `bg_image` in its config
- **THEN** the homepage shows a hero with heading, subheading, CTA button, and background image
- **THEN** the background image has a parallax scroll effect (moves at 0.3x scroll speed)

#### Scenario: Hero section renders without parallax
- **WHEN** a section with `section_type = 'hero'` exists without a `bg_image`
- **THEN** the hero renders with the gradient fallback and no parallax behavior

#### Scenario: Stats section animates counters
- **WHEN** a section with `section_type = 'stats'` scrolls into view
- **THEN** each stat number counts up from 0 to its target value with easing

#### Scenario: Event countdown section renders
- **WHEN** a section with `section_type = 'event-countdown'` exists and `feature_events` is true
- **THEN** a countdown to the next upcoming event is rendered with days, hours, and minutes

#### Scenario: Features grid renders
- **WHEN** a section with `section_type = 'features'` exists with `columns: 3` and 3 items
- **THEN** a 3-column grid of feature cards is rendered with icons, titles, and descriptions

#### Scenario: Section visibility
- **WHEN** a section has `visible = false`
- **THEN** it is not rendered on the page

#### Scenario: Sections animate on scroll
- **WHEN** any section enters the viewport
- **THEN** it fades in with an upward slide animation (see `scroll-animations` spec)

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

`config.js` SHALL set the page title from `site_config.site_name`, display the logo from `site_config.logo_url`, and set the favicon from `site_config.favicon_url`.

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
