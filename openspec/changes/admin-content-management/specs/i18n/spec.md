## ADDED Requirements

### Requirement: Sections fetch includes a translation JOIN when locale is non-default

When `page-render.ts` fetches sections for a page and the active locale is not the default (`'en'`), the query SHALL LEFT JOIN `section_translations` on `(section_id = sections.id AND language = $locale)`. The merged config SHALL be computed as `deepMerge(section.config, translation.config)` where `translation.config` is the partial JSONB from the matching `section_translations` row. When the locale is the default, no JOIN is performed and base configs are used directly.

#### Scenario: Non-default locale triggers the translation JOIN
- **WHEN** a page is rendered with `locale = 'es'`
- **THEN** the sections query includes a LEFT JOIN on `section_translations` filtered to `language = 'es'`

#### Scenario: Default locale skips the translation JOIN
- **WHEN** a page is rendered with `locale = 'en'` (the default)
- **THEN** the sections query does not join `section_translations`
- **AND** base `sections.config` values are passed directly to `renderBlock()`

#### Scenario: Deep-merge preserves untranslated fields from base config
- **WHEN** a translation config has `{ "heading": "Bienvenidos" }` and the base config has `{ "heading": "Welcome", "bg_image": "/hero.jpg", "cta_href": "/join" }`
- **THEN** the merged config passed to `renderBlock()` is `{ "heading": "Bienvenidos", "bg_image": "/hero.jpg", "cta_href": "/join" }`
