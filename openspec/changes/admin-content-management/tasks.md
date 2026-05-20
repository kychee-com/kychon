## 1. shadcn + Schema Setup

- [ ] 1.1 Install new shadcn components: `npx shadcn add scroll-area popover`
- [ ] 1.2 ~~Add `media_assets` table~~ — **NOT NEEDED**. Run402 v1.50 (gateway + `@run402/functions@^2.4.0`) provides server-side media metadata (`internal.blobs.metadata` JSONB + intrinsic image columns). Confirm the project's deployed gateway is on v1.50+ by hitting `https://api.run402.com/health` or checking the platform release notes.
- [ ] 1.3 Add `section_translations` table to `schema.sql` with idempotent guard (section_id FK→sections CASCADE, language, config JSONB, created/updated_at) + UNIQUE(section_id, language) + index on (section_id, language)
- [ ] 1.4 Apply updated schema (just `section_translations`) to the dev database

## 2. Block Registry Updates (blocks.ts)

- [ ] 2.1 Add `editorType: 'inline' | 'list' | 'custom'` to the `BlockType` interface
- [ ] 2.2 Add `translatableFields?: string[]` to the `BlockType` interface
- [ ] 2.3 Declare `editorType` and `translatableFields` on every block in `BLOCK_TYPES` per the spec (hero, features, cta, stats, testimonials, faq, nav, footer_*, tagline_strip, page_banner, promo_cards, image_accordion, custom_html, embed, shape_divider, dynamic blocks)

## 3. Embed Provider Expansion

- [ ] 3.1 Add `spotify` provider to `embed-providers.ts` (buildSrc, sandbox, frameAncestor, defaultHeight)
- [ ] 3.2 Add `soundcloud` provider to `embed-providers.ts`
- [ ] 3.3 Add `eventbrite` provider to `embed-providers.ts`
- [ ] 3.4 Add `google_forms` provider to `embed-providers.ts` (validate URL matches docs.google.com/forms pattern)
- [ ] 3.5 Add `typeform` provider to `embed-providers.ts`
- [ ] 3.6 Add `referrerpolicy="strict-origin-when-cross-origin"` to all `<iframe>` renders in `embed.ts`
- [ ] 3.7 Verify `getProviderHosts()` returns all 12 provider frameAncestors and the CSP meta tag is updated at build time

## 4. upload-asset.js — Media Library Backend (Run402 v1.50 storage-backed)

- [ ] 4.1 On successful upload, thread the recorded `filename` and `uploaded_by_member_id` through `r.project(projectId).assets.put(path, bytes, opts)` via `opts.metadata = { filename, uploaded_by: member_id }`. Pass `opts.exifPolicy = 'strip'` as the default (privacy default for end-user-uploaded photos — original bytes are still served unmutated; only the indexed `image_exif` is sanitized). Drop the existing local `readImageDimensions()` helper call — Run402 v1.50 populates `width_px` / `height_px` / `image_format` / `image_info` server-side on every upload.
- [ ] 4.2 Add `action='list'` handler: thin wrapper over `r.project(projectId).assets.list({ prefix: 'images/', sort: 'createdAt:desc', limit: 40, cursor })`. Reshape the response as `{ assets: blobs, nextCursor: next_cursor }` for backward compatibility with the existing picker JS. NO direct DB query — there's no `media_assets` table.
- [ ] 4.3 On `action='delete'`: call `r.project(projectId).assets.delete(path)`. The platform handles variant revocation, immutable-URL retention, and CDN invalidation. NO local DB DELETE — there's no shadow table to clean up.

## 5. kychon-api.js — Custom Page Handlers + New Operations

- [ ] 5.1 Lift `pages.create` out of the generic `insertRow` path into a custom handler that: sanitises slug (lowercase, non-alphanum → hyphens), checks uniqueness, inserts the pages row, and when `show_in_nav=true` finds the global nav block and appends the nav item. Return `nav_not_found: true` in the response if no nav block is found.
- [ ] 5.2 Lift `pages.delete` into a custom handler that: deletes `sections WHERE page_slug=$slug AND scope='page'`, deletes the `pages` row, and removes the matching href from the nav block's `config.items`.
- [ ] 5.3 Add `media.list` operation (admin-only): thin wrapper that calls `upload-asset.js` `action='list'` (which delegates to `r.assets.list`). Optionally accepts `filter.uploaded_by` / `filter.format` / `filter.is_image` query params to pass through to Run402's indexed filter surface for future "filter by uploader" views.
- [ ] 5.4 Add `media.delete` operation (admin-only): scan `sections.config::text` and `site_config.value::text` for the asset's `cdn_url` substring → return `{ inUse: boolean }`. On `confirmed=true` (or as the default behavior — the UI second-guesses), call `upload-asset.js` `action='delete'` (which delegates to `r.assets.delete`). The platform handles variant revocation + CDN invalidation; this layer is just the in-use signal.
- [ ] 5.5 Add `sections.translate` operation (admin-only): UPSERT `section_translations (section_id, language, config)` with `ON CONFLICT (section_id, language) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`
- [ ] 5.6 Add `sections.getTranslation` operation (admin-only): SELECT from `section_translations` WHERE section_id=$id AND language=$lang

## 6. page-render.ts — Translation Merge

- [ ] 6.1 Add a `deepMerge(base, override)` utility that merges flat fields and arrays by index
- [ ] 6.2 When `locale !== defaultLocale`, LEFT JOIN `section_translations` on `(section_id = s.id AND language = $locale)` in the sections fetch query
- [ ] 6.3 At render time, for each section: if a translation row is present, compute `mergedConfig = deepMerge(section.config, translation.config)` and pass `{ ...section, config: mergedConfig }` to `renderBlock()`

## 7. AdminBar Component

- [ ] 7.1 Create `src/components/AdminBar.astro` — thin wrapper that renders `<AdminBarIsland client:load />` inside a `<div transition:persist>`
- [ ] 7.2 Create `src/components/kychon/AdminBarIsland.tsx` — React island that: calls `getRole()` on mount and returns `null` for non-admins; renders the sticky bar (`h-9 sticky top-0 z-[9999] bg-slate-900 text-slate-200 flex items-center gap-1 px-3 border-b`)
- [ ] 7.3 Implement Pages `DropdownMenu`: fetch `pages.list` on open, render page items (bold current page by matching slug), `DropdownMenuSeparator`, "+ New Page" item
- [ ] 7.4 Implement "+ Add Block" `Button`: dispatch the same event as `AdminZoneAddButton` for `zone='main'`
- [ ] 7.5 Implement language switcher `DropdownMenu` (right side, hidden when `site_config.languages.length <= 1`): list configured languages, show active locale with checkmark, `DropdownMenuSeparator`, "+ Add language..." item; on non-default select, activate translation mode (store in React state, show Badge "Translating: {lang}")
- [ ] 7.6 Implement Preview `Button`: toggle a `data-admin-preview` attribute on `<body>` (CSS hides all admin chrome when present); show an "Exit preview" button when active
- [ ] 7.7 Implement Exit ✕ `Button`: write `wl_admin_bar_hidden = '1'` to localStorage, render null
- [ ] 7.8 Add `<AdminBar />` to `Portal.astro` after `<DemoBanner />` and before the flex column

## 8. Page Management Dialogs

- [ ] 8.1 Create `PageCreatorDialog` (inside `AdminBarIsland.tsx`): `Dialog` with Title `Input` (auto-generates slug on change), slug `Input` (editable, uniqueness error state), "Add to navigation" `Checkbox`, "Members only" `Checkbox`, Cancel and "Create Page →" `Button` (disabled when slug empty or errored)
- [ ] 8.2 Wire PageCreatorDialog submit: call `pages.create`, navigate to `/{slug}` on success, show toast if `nav_not_found: true` in response
- [ ] 8.3 Add delete affordance to Pages dropdown items: `Button variant="ghost" size="icon"` with Trash icon; opens `PageDeleteDialog`
- [ ] 8.4 Create `PageDeleteDialog`: `Dialog` with destructive message (include "also removed from navigation" text when `show_in_nav = true`), Cancel and "Delete page" `Button variant="destructive"`; on confirm call `pages.delete` then navigate to `/`

## 9. Media Library — MediaPicker Component

- [ ] 9.1 Create `src/components/kychon/MediaPickerIsland.tsx`: `Dialog` with two-pane grid layout (`grid-cols-[1fr_260px] divide-x`)
- [ ] 9.2 Left pane: `ScrollArea` with 4-col thumbnail grid; each thumbnail is a `button` with `aspect-square overflow-hidden rounded-md border-2`; selected item gets `border-primary` + `Check` icon overlay; "Load more" `Button variant="ghost"` when `nextCursor` is non-null
- [ ] 9.3 Right pane: toggle between upload drop-zone (label + `Upload` Lucide icon + hidden `input type="file"`) and selected-image preview (`img` + filename + `{width}×{height} · {size}` + "Delete image" `Button variant="ghost"` with destructive text colour)
- [ ] 9.4 Load assets from `media.list` on Dialog open; append on "Load more". Render thumbnails from `row.variants.thumb.cdn_url` when present (320w WebP) falling back to `row.cdn_url` for below-thumb-sized assets and pre-v1.49 uploads. Display `metadata.filename` (or the key) in the per-thumb tooltip.
- [ ] 9.5 Upload drop-zone: on file select, call `upload-asset.js`, add new row to assets list, auto-select the new asset
- [ ] 9.6 "Delete image" flow: call `media.delete` (which returns `inUse`); if `inUse=true` show a warning `Dialog` "This image may be in use on your site" with "Delete anyway"; if `inUse=false` show simple confirm `Dialog`; on confirm proceed with deletion and remove from grid
- [ ] 9.7 "Use this image →" `Button` (disabled until selection): close Dialog, update target image `src`, issue PATCH to underlying data source
- [ ] 9.8 Update `AdminEditor.astro`: change `data-editable-image` click handler to open `MediaPickerIsland` instead of triggering the hidden file input directly

## 10. Block List Editor — BlockListEditor Component

- [ ] 10.1 Create `src/components/kychon/BlockListEditorIsland.tsx`: `Popover` (shadcn) anchored to the block's edit affordance button
- [ ] 10.2 Popover header: block label `p.font-semibold` + optional `Badge` "GLOBAL" when `scope='global'`
- [ ] 10.3 Items list: for each item, render a row with `GripVertical` drag handle (`draggable`), truncated primary text (title / label / question), hover-revealed `Pencil` and `X` icon `Button variant="ghost"` components
- [ ] 10.4 Inline detail form: conditional render (not navigation) when a row's Pencil is clicked; fields rendered as `Input`/`Textarea`/`Label` per the item schema; image fields render a `Button` that opens `MediaPickerIsland`; "Done" collapses back to list
- [ ] 10.5 "+ Add item" `Button variant="outline" className="w-full"`: appends default item from `defaultConfig`, opens its inline detail form
- [ ] 10.6 HTML5 drag-to-reorder on list items: `dragstart`, `dragover`, `drop` events; show insertion indicator; reorder items array in state on drop
- [ ] 10.7 Footer: Cancel `Button variant="outline"` + "Save changes" `Button`; on save issue `sections.updateConfig` with full updated config; show toast "Saved — appears on all pages" for global blocks, "Saved" otherwise
- [ ] 10.8 Wire `BlockListEditorIsland` into the admin editing system: when a block's edit affordance is clicked and `BLOCK_TYPES[section_type].editorType === 'list'`, mount `BlockListEditorIsland` instead of the existing inline editor

## 11. Block Translation — BlockTranslationEditor + AddLanguage Components

- [ ] 11.1 Create `src/components/kychon/BlockTranslationEditorIsland.tsx`: `Dialog` with `ScrollArea` containing the two-column field table (source label + read-only value on left; `Textarea` translation input on right)
- [ ] 11.2 Load existing translation on open: call `sections.getTranslation` for the active locale; pre-fill Textareas with stored values
- [ ] 11.3 Flat field rendering: one row per `translatableFields` entry; label is the dot-path, source is `section.config[field]`
- [ ] 11.4 Array field rendering: for `items[].title` pattern, render a group per array index showing label "Item {n} — {field}" with source and translation side-by-side
- [ ] 11.5 "✨ Translate with AI" `Button`: call `translate-text.js` for each field value; fill all Textareas; show `Loader2` spinner during request; disable button while loading
- [ ] 11.6 "Save {lang} translation" `Button`: collect only fields with non-empty translation values into a partial config JSONB; call `sections.translate`; close Dialog on success
- [ ] 11.7 Wire into `AdminEditor.astro`: when in translation mode (non-default language active in admin bar) and a block edit affordance is clicked, open `BlockTranslationEditorIsland` instead of the normal block editor (for blocks where `translatableFields.length > 0`)
- [ ] 11.8 Create `src/components/kychon/AddLanguageIsland.tsx`: `Dialog` with `Select` listing `AVAILABLE_LANGUAGES` filtered to exclude `site_config.languages`; on confirm, UPSERT `site_config` key `languages` with the new code appended; close Dialog and update admin bar language list
- [ ] 11.9 Wire "+ Add language..." dropdown item in `AdminBarIsland` to open `AddLanguageIsland`

## 12. Verification

- [ ] 12.1 Create a new page from the admin bar; verify nav auto-insert (and toast when no nav block)
- [ ] 12.2 Delete the test page; verify sections cascade and nav item removal
- [ ] 12.3 Upload an image via the MediaPicker; verify the response carries `metadata.filename` / `metadata.uploaded_by` (from the put opts) + `image_format` / `width_px` / `height_px` (platform-extracted); verify the image appears in the library on next `media.list` call. NO Kychon DB row to assert (storage-backed).
- [ ] 12.4 Delete the uploaded image with an in-use warning; verify the warning dialog appears when the cdn_url is in a section config
- [ ] 12.5 Add ES as a language; verify the language switcher shows it
- [ ] 12.6 In ES translation mode, open a hero block translation editor; fill fields manually and save; verify `section_translations` row is created and the ES page render shows translated text
- [ ] 12.7 Use "Translate with AI" on a features block; verify all fields are filled and saveable
- [ ] 12.8 Open a features block list editor; add an item, drag-reorder, delete one; save and verify the DB config matches
- [ ] 12.9 Test each new embed provider (Spotify, SoundCloud, Eventbrite, Google Forms, Typeform) in the embed block popover; verify each renders a valid iframe with `referrerpolicy` attribute
- [ ] 12.10 Verify non-admin and visitor see no admin bar, no edit affordances, and no MediaPicker on any page
