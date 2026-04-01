## MODIFIED Requirements

### Requirement: Locale loading on demand

`i18n.js` SHALL fetch locale files from `/custom/strings/{lang}.json` on demand. Locale data SHALL be cached in localStorage (in addition to the existing in-memory cache) under key `wl_cache_i18n_{lang}` with a 24-hour TTL. On repeat visits, `loadLocale()` SHALL read strings from localStorage synchronously and set them immediately, then fetch fresh strings in the background if the cache is stale. The current locale SHALL be determined by: `localStorage` preference > `site_config.default_language` > `"en"`.

#### Scenario: Strings served from localStorage cache
- **WHEN** `loadLocale('en')` is called and `wl_cache_i18n_en` exists in localStorage with valid data
- **THEN** strings are available via `t()` immediately without a network request

#### Scenario: First visit fetches and caches strings
- **WHEN** `loadLocale('en')` is called and no cache exists for `en`
- **THEN** `/custom/strings/en.json` is fetched from the server
- **THEN** the response is stored in localStorage under `wl_cache_i18n_en`

#### Scenario: Stale cache triggers background refresh
- **WHEN** `loadLocale('pt')` is called and `wl_cache_i18n_pt` was cached more than 24 hours ago
- **THEN** cached strings are used immediately for rendering
- **THEN** a background fetch retrieves fresh strings
- **THEN** if strings have changed, the cache is updated (page reload picks up new strings)

#### Scenario: User switches language
- **WHEN** a user selects Portuguese in the language picker
- **THEN** `/custom/strings/pt.json` is fetched (if not cached)
- **THEN** the preference is saved to `localStorage`
- **THEN** all translatable UI elements on the page update

#### Scenario: brand.json fallback removed
- **WHEN** `loadLocale()` is called with no explicit language and no `site_config.default_language`
- **THEN** it defaults to `'en'` without fetching `brand.json`
