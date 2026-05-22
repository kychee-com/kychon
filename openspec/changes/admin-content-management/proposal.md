## Why

Kychon's founding principle is "the page IS the admin" — admins edit their live website directly, no separate backend. Today that principle breaks down across five gaps: there is no persistent way to navigate between pages or create new ones, images have no reusable library, array-type block configs (accordion, features, FAQ) have no edit UI, block content cannot be translated per-locale, and the embed block covers only 7 providers. This change closes all five gaps in one cohesive delivery.

## What Changes

- **Admin bar**: a sticky 36px bar injected above every page for admins — page navigation, new-page creation, block picker shortcut, language/translation mode switcher, and preview toggle. No chrome for non-admins.
- **Page management**: create pages from the admin bar via a Dialog (title, slug, nav + auth options); slug auto-generated, uniqueness-checked. Delete with a destructive confirmation. `pages.create`/`pages.delete` gain nav-block side-effects (auto-insert/remove the matching nav item).
- **Media library**: backed directly by Run402 v1.50 storage — **no Kychon-side shadow table**. `upload-asset.js` writes filename + uploader via `assets.put` `metadata` opts and uses `exifPolicy: 'strip'` (privacy default for end-user-uploaded photos). The picker calls `media.list`, a thin wrapper over `r.project(id).assets.list({ sort: 'createdAt:desc', prefix: 'images/' })`. `data-editable-image` now opens a two-pane Dialog (library grid + upload/preview) instead of a bare file picker. **Pre-existing storage assets appear in the library automatically** — no re-upload required (v1.50 reads from `internal.blobs` directly).
- **Block translation**: new `section_translations` table stores per-locale partial config overrides. `BlockType` gains `translatableFields` (dot-paths). The sections query LEFT JOINs translations and deep-merges at render time. Admin bar language switcher activates translation mode; a `BlockTranslationEditor` Dialog shows source / translation pairs per field with AI-fill.
- **Block list editor**: `BlockType` gains `editorType` (`inline` / `list` / `custom`). `list` blocks (features, testimonials, FAQ, image accordion, promo cards, slideshow, footer links, footer social) get a `BlockListEditor` Popover with drag-to-reorder, inline item expand, add, and delete — saving the full config in one PATCH.
- **Embed provider expansion**: add Spotify, SoundCloud, Eventbrite, Google Forms, Typeform (5 new verified providers). Add `referrerpolicy="strict-origin-when-cross-origin"` to all iframe renders.
- **shadcn additions**: install `scroll-area` and `popover`.

## Capabilities

### New Capabilities

- `admin-bar`: Persistent sticky bar visible only to admins. Owns page navigation, new-page creation trigger, block picker shortcut, language/translation mode switcher (hidden when single-language), preview toggle, and exit.
- `page-management`: Admin CRUD for portal pages — create with slug sanitise + uniqueness check, delete with cascade + nav side-effect. `pages.create`/`pages.delete` in `kychon-api.js` lifted to custom handlers.
- `media-library`: `upload-asset.js` writes per-key metadata (`filename`, `uploaded_by` member id) + EXIF policy via `r.project(id).assets.put` opts; `media.list` / `media.delete` are thin wrappers over `r.project(id).assets.{list,delete}`; `MediaPicker` Dialog replaces the bare file-input trigger on `data-editable-image`. No Kychon DB table for media — Run402 v1.50's `internal.blobs` is the source of truth.
- `block-translation`: `section_translations` table + `translatableFields` registry on each `BlockType` + render-time deep-merge + `BlockTranslationEditor` Dialog + Add Language Dialog + `sections.translate` / `sections.getTranslation` API operations.
- `block-list-editor`: `editorType` registry on each `BlockType` + `BlockListEditor` Popover for all `list`-type blocks.

### Modified Capabilities

- `composable-layout`: `BlockType` interface gains two new fields (`editorType`, `translatableFields`); every block definition updated. No requirement changes to zone/scope/column-span behaviour.
- `inline-editing`: `data-editable-image` trigger changes from direct file-picker to `MediaPicker` Dialog. Existing `data-editable` and `data-editable-rich` behaviours unchanged.
- `i18n`: render path gains a LEFT JOIN on `section_translations` and a deep-merge step when locale is non-default. Public-facing behaviour (locale switching, `t()`, RTL) unchanged.
- `database-schema`: one new table (`section_translations`) and its indexes added to `schema.sql`. **No** `media_assets` table — media metadata lives in Run402's `internal.blobs.metadata` (caller-provided JSONB) and the v1.49/v1.50 intrinsic columns (`width_px`, `height_px`, `blurhash`, `image_format`, `image_info`, `image_exif`).
- `embed` (via composable-layout): 5 new providers in `embed-providers.ts`; `referrerpolicy` attribute added to iframe renderer. Existing provider contracts unchanged.

## Impact

- **New files**: `src/components/kychon/AdminBarIsland.tsx`, `src/components/AdminBar.astro`, `src/components/kychon/MediaPickerIsland.tsx`, `src/components/kychon/BlockListEditorIsland.tsx`, `src/components/kychon/BlockTranslationEditorIsland.tsx`, `src/components/kychon/AddLanguageIsland.tsx`
- **Modified files**: `src/layouts/Portal.astro` (inject AdminBar), `src/lib/blocks.ts` (editorType + translatableFields), `src/lib/blocks/embed-providers.ts` (5 new providers), `src/lib/blocks/embed.ts` (referrerpolicy), `src/lib/page-render.ts` (translation JOIN + merge), `functions/upload-asset.js` (threads `metadata` + `exifPolicy: 'strip'` into `assets.put`), `functions/kychon-api.js` (custom page handlers + thin `media.list`/`media.delete` wrappers + translate ops), `schema.sql` (one new table — `section_translations`)
- **New shadcn components**: `scroll-area`, `popover` (via `npx shadcn add`)
- **Database**: `section_translations` table only — additive, no migrations to existing tables. Media library has **no** Kychon-side table.
- **API**: new operations `media.list`, `media.delete`, `sections.translate`, `sections.getTranslation`; custom handlers for `pages.create` and `pages.delete`. `media.*` are thin wrappers over `r.project(id).assets.{list,delete}`.
- **Security**: no new trust surface — media uploads are admin-only (existing auth gate on upload-asset.js); section_translations writes gated by existing admin-only kychon-api mutation auth. `exifPolicy: 'strip'` is the default for media uploads so end-user photo EXIF (GPS, camera serial) doesn't land in the queryable index.
- **Platform dependency**: requires Run402 platform v1.50+ (gateway + `@run402/functions@^2.4.0`) for media metadata, plus v2.5+ routed-locale-context (`ctx.locale` / `ctx.defaultLocale`) for the translation render path. Function role gates (v2.9.0) are NOT a hard dependency for this change — current per-function role checks continue to work — but new privileged operations introduced by this change SHOULD use the declarative gates from the start to avoid a follow-up migration.
- **i18n locale model**: `spec.i18n.locales` is pre-declared as a 50-entry `LOCALE_POOL` at deploy time (kitchen-sink pattern — design Decision 9). Admin language management is fully runtime: `site_config.languages_enabled` (a new JSONB row, runtime-mutable) controls what the admin bar shows and what the render path treats as "active." This avoids requiring a redeploy per language add, sidesteps `kychee-com/run402-private#413` (which would make `spec.i18n.locales` runtime-mutable directly), and stays forward-compatible: when #413 ships, the pool collapses to whatever's enabled and `languages_enabled` becomes the single source of truth.
