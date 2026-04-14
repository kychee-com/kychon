## ADDED Requirements

### Requirement: t() translation function

`i18n.js` SHALL export a global `t(key, vars)` function. It SHALL return the translated string for the current locale, falling back to the English string if the key is missing. Interpolation SHALL replace `{placeholder}` with values from the `vars` object.

#### Scenario: Simple translation
- **WHEN** `t('nav.home')` is called with locale `pt`
- **THEN** it returns the Portuguese translation for `nav.home`

#### Scenario: Missing key falls back to English
- **WHEN** `t('nav.settings')` is called with locale `pt` and the key is missing in `pt.json`
- **THEN** it returns the English value from `en.json`

#### Scenario: Interpolation
- **WHEN** `t('welcome.greeting', { name: 'Maria' })` is called
- **THEN** `{name}` in the string is replaced with "Maria"

### Requirement: Plural support via _one suffix

For plurals, `t(key, { count: N })` SHALL use `key_one` when `count === 1` and `key` otherwise.

#### Scenario: Singular form
- **WHEN** `t('members.count', { count: 1 })` is called
- **THEN** it uses the `members.count_one` key (e.g., "1 member")

#### Scenario: Plural form
- **WHEN** `t('members.count', { count: 5 })` is called
- **THEN** it uses the `members.count` key (e.g., "5 members")

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

### Requirement: Language picker visibility

The language picker in profile settings SHALL only be shown when `brand.json` lists more than one language in the `languages` array.

#### Scenario: Single language hides picker
- **WHEN** `brand.json` has `languages: ["en"]`
- **THEN** no language picker is shown

#### Scenario: Multiple languages shows picker
- **WHEN** `brand.json` has `languages: ["en", "pt"]`
- **THEN** a language picker dropdown is shown in profile settings

### Requirement: RTL support

When a locale's JSON includes `_meta.direction: "rtl"`, the `<html>` element SHALL have its `dir` attribute set to `"rtl"`.

#### Scenario: Arabic locale sets RTL
- **WHEN** the locale is set to `ar` and `ar.json` has `_meta.direction: "rtl"`
- **THEN** `document.documentElement.dir` is set to `"rtl"`
