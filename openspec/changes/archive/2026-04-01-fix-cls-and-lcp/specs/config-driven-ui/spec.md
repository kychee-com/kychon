## ADDED Requirements

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
