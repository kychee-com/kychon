## MODIFIED Requirements

### Requirement: Config-driven navigation

`config.js` SHALL read the `nav` key from `site_config` and render navigation items. On repeat visits, nav SHALL be rendered immediately from cached `site_config` data without waiting for a network request. If the cached data is stale (older than TTL), a background fetch SHALL update the nav if the data has changed. On first visit (no cache), nav rendering SHALL wait for the API response as before. Each item has `label`, `href`, `icon`, `public`, `auth`, `feature`, and `admin` properties. Items SHALL be filtered based on: feature flags (hide if flag is false), auth state (hide `auth: true` items for anonymous users), and admin role (hide `admin: true` items for non-admins).

#### Scenario: Nav renders immediately from cache
- **WHEN** a page loads and `wl_cache_site_config` exists in localStorage with nav items
- **THEN** navigation links are rendered before any API call completes

#### Scenario: Nav updates after background refresh
- **WHEN** an admin adds a new nav item and a user loads a page with stale cache
- **THEN** navigation initially shows the cached items
- **THEN** after background refresh, the new nav item appears without a page reload

#### Scenario: First visit fetches and caches
- **WHEN** a page loads with no `wl_cache_site_config` in localStorage
- **THEN** navigation waits for the API response (current behavior)
- **THEN** the response is written to cache for subsequent visits

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
