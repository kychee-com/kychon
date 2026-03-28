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

`config.js` SHALL read `sections` rows where `page_slug = 'index'`, ordered by `position`. Each section SHALL be rendered based on its `section_type` (hero, features, cta, stats, testimonials, faq, custom) using the `config` JSONB for content.

#### Scenario: Hero section renders
- **WHEN** a section with `section_type = 'hero'` exists
- **THEN** the homepage shows a hero with heading, subheading, CTA button, and optional background image from the section's `config`

#### Scenario: Features grid renders
- **WHEN** a section with `section_type = 'features'` exists with `columns: 3` and 3 items
- **THEN** a 3-column grid of feature cards is rendered with icons, titles, and descriptions

#### Scenario: Section visibility
- **WHEN** a section has `visible = false`
- **THEN** it is not rendered on the page

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
