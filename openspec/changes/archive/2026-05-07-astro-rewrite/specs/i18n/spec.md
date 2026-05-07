## ADDED Requirements

### Requirement: Astro i18n routing for locale-prefixed URLs
The Astro config SHALL define i18n routing with `prefixDefaultLocale: false`. The default locale (English) SHALL have unprefixed URLs (`/events.html`). Other locales SHALL have prefixed URLs (`/es/events.html`).

Pages for non-default locales SHALL be generated at build time using Astro's i18n routing or duplicated page structure under locale directories.

#### Scenario: English URLs have no prefix
- **WHEN** a user visits `/events.html`
- **THEN** the page loads in English

#### Scenario: Spanish URLs have locale prefix
- **WHEN** a user visits `/es/events.html`
- **THEN** the page loads with Spanish locale set
- **AND** the `t()` function returns Spanish translations

## MODIFIED Requirements

### Requirement: Translation function t(key, vars)
The `t(key, vars)` function SHALL be implemented in `src/lib/i18n.ts` (moved from `site/js/i18n.js`). It SHALL:
- Accept a dot-separated key and optional variables for interpolation
- Support plural forms via `_one` suffix when `vars.count === 1`
- Load locale strings from `/custom/strings/{lang}.json` on demand
- Cache loaded strings in localStorage with a 24-hour TTL
- Fall back to English when a key is missing in the current locale
- Determine current locale from: localStorage preference > config.default_language > "en"

The function's behavior is unchanged. Only the file location and module format change (from global script to ES module export).

#### Scenario: Translation with interpolation
- **WHEN** code calls `t('events.count', { count: 5 })`
- **THEN** it returns the translated string with `5` substituted for `{count}`

#### Scenario: Locale strings cached across navigations
- **WHEN** a user navigates between pages via view transitions
- **THEN** locale strings are NOT re-fetched (cached in memory and localStorage)
- **AND** the `t()` function returns translations instantly from cache
