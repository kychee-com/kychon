## ADDED Requirements

### Requirement: section_translations stores per-locale partial config overrides

The `section_translations` table SHALL store a partial config JSONB for each `(section_id, language)` pair. The config SHALL contain only the translatable fields — non-translatable fields (image URLs, hrefs, numeric values, layout settings) SHALL NOT be stored. Rows SHALL cascade-delete when the parent `sections` row is deleted.

#### Scenario: Translation row stores only translated fields
- **WHEN** an admin saves a Spanish translation for a hero block with only `heading` and `cta_text` translated
- **THEN** the `section_translations` row has `config = { "heading": "Bienvenidos", "cta_text": "Más información" }`
- **AND** the row does not include `bg_image`, `cta_href`, or other non-translatable fields

#### Scenario: Deleting a section cascades its translations
- **WHEN** a `sections` row is deleted
- **THEN** all `section_translations` rows for that section_id are also deleted

### Requirement: BlockType registry declares translatableFields for each block type

The `BlockType` interface in `src/lib/blocks.ts` SHALL include an optional `translatableFields?: string[]` field. Each block definition SHALL declare the dot-path strings identifying its translatable text fields. Non-translatable blocks (custom_html, embed, shape_divider, dynamic feed blocks) SHALL declare an empty array or omit the field. Array fields SHALL use the notation `items[].fieldName`.

Declared translatable fields per block type:
- `hero`: `['heading', 'subheading', 'cta_text']`
- `features`: `['items[].title', 'items[].desc']`
- `cta`: `['heading', 'text', 'cta_text']`
- `stats`: `['items[].label']`
- `testimonials`: `['items[].name', 'items[].role', 'items[].text']`
- `faq`: `['items[].question', 'items[].answer']`
- `nav`: `['items[].label', 'items[].children[].label']`
- `footer_copyright`: `['text', 'admin_contact_label']`
- `footer_links`: `['columns[].heading', 'columns[].items[].label']`
- `footer_address`: `['name', 'street', 'city', 'phone', 'email']`
- `footer_attribution`: `['text']`
- `tagline_strip`: `['text']`
- `page_banner`: `['heading', 'subheading']`
- `promo_cards`: `['cards[].tag', 'cards[].title', 'cards[].description']`
- `image_accordion`: `['panels[].title', 'panels[].description', 'panels[].cta_label']`
- `custom_html`, `embed`, `shape_divider`, all dynamic blocks: `[]`

#### Scenario: Block with translatable fields has a non-empty translatableFields array
- **WHEN** the `BLOCK_TYPES.hero` registry entry is read
- **THEN** `translatableFields` is `['heading', 'subheading', 'cta_text']`

#### Scenario: Non-translatable block has an empty or absent translatableFields
- **WHEN** the `BLOCK_TYPES.embed` registry entry is read
- **THEN** `translatableFields` is `[]` or undefined

### Requirement: Page render merges section_translations at the active locale

`src/lib/page-render.ts` SHALL LEFT JOIN `section_translations` on `(section_id = s.id AND language = $locale)` in the sections fetch. When a translation row is present, the renderer SHALL deep-merge `{ ...section.config, ...translation.config }` before passing config to `renderBlock()`. Array fields SHALL be merged by index: `translation.config.items[i]` is spread over `section.config.items[i]`, with untranslated array items falling back to their base config values. When no translation row is present the base `section.config` is used unchanged.

#### Scenario: Translated hero block renders in the active locale
- **WHEN** the page is rendered with `locale = 'es'` and a `section_translations` row exists for the hero block in `es`
- **THEN** the rendered hero shows the Spanish heading and CTA text
- **AND** the untranslated bg_image and cta_href from the base config are preserved

#### Scenario: Block with no translation falls back to base config
- **WHEN** the page is rendered with `locale = 'es'` and no `section_translations` row exists for a features block
- **THEN** the rendered features block shows the English base config text

#### Scenario: Array items merge by index
- **WHEN** a translation config has `items: [{ title: "Item 1 ES" }]` and the base config has `items: [{ title: "Item 1", desc: "Desc 1" }, { title: "Item 2", desc: "Desc 2" }]`
- **THEN** item 0 renders with `{ title: "Item 1 ES", desc: "Desc 1" }` (translated title, base desc)
- **AND** item 1 renders with `{ title: "Item 2", desc: "Desc 2" }` (fully from base — translation has no item 1)

#### Scenario: English (default) locale skips the JOIN
- **WHEN** the page is rendered with the default locale (`en`)
- **THEN** no section_translations JOIN is performed and base configs are used directly

### Requirement: BlockTranslationEditor provides field-by-field translation editing

When an admin is in translation mode (non-default language selected in admin bar) and clicks a block's edit affordance, a `Dialog` (shadcn) SHALL open showing the block's translatable fields in a two-column layout: left column shows the field label and source (English) value as read-only; right column shows a `Textarea` pre-filled with the existing translation for that field (empty if none). Saving SHALL UPSERT the `section_translations` row via `sections.translate`. The Dialog SHALL handle both flat fields and array fields (rendered as grouped rows per item index).

#### Scenario: Translation editor shows source and translation side-by-side
- **WHEN** an admin in translation mode clicks the edit affordance on a hero block
- **THEN** a Dialog opens with rows for heading, subheading, and cta_text
- **AND** each row shows the English source text and a Textarea for the translated value

#### Scenario: Existing translation pre-fills the textarea
- **WHEN** a `section_translations` row already exists for the block in the active locale
- **THEN** the Textarea for each field is pre-filled with the stored translation

#### Scenario: Saving translation upserts the section_translations row
- **WHEN** an admin fills in translations and clicks "Save {lang} translation"
- **THEN** a `sections.translate` API call UPSERTs the `section_translations` row with the partial config containing only the translated fields

#### Scenario: Array block shows items grouped by index
- **WHEN** a features block with 3 items is opened in translation mode
- **THEN** the Dialog shows 3 groups, each with title and desc fields for that item index

### Requirement: "Translate with AI" fills all fields automatically

The `BlockTranslationEditor` Dialog SHALL include a "✨ Translate with AI" `Button`. Clicking it SHALL call the existing `translate-text.js` edge function for each translatable field value, filling all Textarea inputs with the AI-generated translations. The admin can then review and edit before saving.

#### Scenario: AI fill populates all empty translation fields
- **WHEN** an admin clicks "Translate with AI" with all fields empty
- **THEN** all Textarea inputs are filled with AI-generated translations in the active locale

#### Scenario: AI fill overwrites existing translations
- **WHEN** an admin clicks "Translate with AI" when some fields already have translations
- **THEN** all fields are replaced with fresh AI-generated content
- **AND** the admin can revert by closing without saving

#### Scenario: Loading state shown during AI translation
- **WHEN** the AI translation is in progress
- **THEN** the button shows a `Loader2` spinner and is disabled

### Requirement: Add Language dialog updates `site_config.languages_enabled` (no platform deploy required)

The "+ Add language..." item in the admin bar language switcher SHALL open a `Dialog` with a `Select` listing the `LOCALE_POOL` filtered to exclude entries already in `site_config.languages_enabled`. Confirming SHALL UPSERT `site_config` key `'languages_enabled'` to append the new language code to the array. The language switcher SHALL then include the new language immediately — no deploy required, no platform API call. The Run402 gateway already accepts the locale because it was pre-declared in `spec.i18n.locales` at deploy time (kitchen-sink pattern, see design.md Decision 9).

The Select's source list (the available locales to add) SHALL be a Kychon-side constant exposing the same 50-entry `LOCALE_POOL` used by `buildI18nSpec` in `scripts/_lib.ts`, with human-readable display labels mapped per code (e.g. `'es' → 'Español'`, `'zh-Hant' → '繁體中文'`).

Removing a language is symmetric: an admin SHALL be able to remove an entry from `languages_enabled` via the language switcher (e.g. a delete affordance per row in the dropdown, or a "Manage languages" sub-action). Removal does NOT delete `section_translations` rows for that locale — the rows linger so the admin can re-enable without re-translating. The render-path enabled check (see i18n spec) ensures visitors with cookies for the removed locale fall back to the default-locale content.

#### Scenario: Add Language is a runtime-only operation (no deploy)
- **WHEN** an admin selects "Français" in the Add Language dialog and confirms
- **THEN** `site_config.languages_enabled` is upserted to include `'fr'`
- **AND** no Run402 platform API is called (no `r.project(id).apply(...)`, no deploy)
- **AND** the language switcher immediately lists Français on the next render

#### Scenario: French visitor sees French content immediately after add (no deploy)
- **WHEN** an admin adds `'fr'` to `languages_enabled` and then translates a hero block to French via the BlockTranslationEditor
- **WHEN** a visitor with `Cookie: wl_locale=fr` then loads the page
- **THEN** the gateway resolves `ctx.locale = 'fr'` (it's in the pre-allocated `spec.i18n.locales` pool)
- **AND** the render path JOINs `section_translations` and serves the French translation
- **AND** no deploy occurred between the admin's actions and the visitor's request

#### Scenario: Already-enabled languages are excluded from the picker
- **WHEN** the portal already has `languages_enabled: ["en", "es"]`
- **THEN** the Add Language dialog's Select does not include English or Español

#### Scenario: Pool-absent languages are NOT in the picker
- **WHEN** an admin opens the Add Language dialog and the `LOCALE_POOL` is the 50-entry standard pool
- **THEN** locales outside the pool (e.g. very-long-tail codes like `'haw'` for Hawaiian) do not appear
- **AND** if a portal needs a locale outside the pool, the resolution path is to expand `LOCALE_POOL` in `scripts/_lib.ts` and redeploy (or wait for `run402-private#413` to ship a runtime-mutable mechanism)

#### Scenario: Removing a language hides it from the switcher but preserves translations
- **WHEN** an admin removes `'es'` from `languages_enabled`
- **THEN** the language switcher no longer lists Español
- **AND** `section_translations` rows with `language = 'es'` are retained (not deleted)
- **AND** the render path's enabled check ensures visitors with `Cookie: wl_locale=es` see default-locale content (the JOIN is skipped per the i18n spec)
- **AND** re-adding `'es'` later restores the full Spanish UX without re-translating
