## MODIFIED Requirements

### Requirement: Config-driven navigation
The navigation SHALL be built by the ConfigProvider island at runtime from the `site_config.nav` array. Nav items SHALL be filtered by feature flags, auth state, and admin role — same logic as current `config.js`, now in the ConfigProvider island.

The Nav component SHALL render a static HTML shell at build time (empty nav list). The ConfigProvider island SHALL populate it at runtime after fetching config.

#### Scenario: Nav updates when feature flag changes
- **WHEN** an admin enables `feature_forum` in site_config via SQL
- **THEN** the Forum nav item appears on the next page load (no rebuild needed)

#### Scenario: Nav persists across view transitions
- **WHEN** a user navigates between pages
- **THEN** the nav is not re-fetched or re-rendered
- **AND** the active item updates to match the current URL

### Requirement: Theme injection via CSS custom properties
The ConfigProvider island SHALL read `site_config.theme` and inject CSS custom properties onto `document.documentElement`, preserving the stale-while-revalidate cache pattern (5-minute TTL in localStorage, background refresh if stale).

#### Scenario: Theme applied from DB without rebuild
- **WHEN** an admin changes `theme.primary_color` in site_config via SQL
- **THEN** the new color appears on the next page load (within 5 minutes due to cache)
- **AND** no Astro rebuild is required

#### Scenario: Dark mode toggle preserved
- **WHEN** a user toggles dark mode
- **THEN** CSS custom properties for dark mode override the theme values
- **AND** the preference persists in localStorage across sessions

### Requirement: Schema-driven homepage sections
The homepage SHALL render sections from the `sections` table, same as today. Section data is fetched at runtime by a client island. Section types (hero, features, cta, stats, testimonials, faq, event-countdown, custom) SHALL each have a corresponding Astro component.

#### Scenario: New section added via SQL
- **WHEN** an agent inserts a new section row in the `sections` table
- **THEN** it appears on the homepage on the next page load
- **AND** no Astro rebuild is required

### Requirement: Generic page renderer
The `page.astro` page SHALL render dynamic pages from the `pages` table using the `?slug=` query parameter pattern. Page content is fetched at runtime by a client island.

#### Scenario: Custom page loaded by slug
- **WHEN** a user visits `/page.html?slug=about`
- **THEN** the page content for slug "about" is fetched from the `pages` table
- **AND** rendered inside the Portal layout
