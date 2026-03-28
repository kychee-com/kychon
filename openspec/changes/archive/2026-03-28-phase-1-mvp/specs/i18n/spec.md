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

`i18n.js` SHALL fetch locale files from `/custom/strings/{lang}.json` on demand. The current locale SHALL be determined by: `localStorage` preference > `brand.json` `defaultLanguage` > `"en"`. Locale data SHALL be cached in memory after first fetch.

#### Scenario: Initial load fetches locale
- **WHEN** the page loads with no stored preference and `defaultLanguage` is `"en"`
- **THEN** `/custom/strings/en.json` is fetched and cached

#### Scenario: User switches language
- **WHEN** a user selects Portuguese in the language picker
- **THEN** `/custom/strings/pt.json` is fetched (if not cached)
- **THEN** the preference is saved to `localStorage`
- **THEN** all translatable UI elements on the page update

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
