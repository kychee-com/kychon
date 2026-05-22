## 1. shadcn + Schema Setup

- [x] 1.1 Install new shadcn components: `npx shadcn add scroll-area popover`
- [x] 1.2 ~~Add `media_assets` table~~ — **NOT NEEDED**. Run402 v1.50 (gateway + `@run402/functions@^2.4.0`) provides server-side media metadata (`internal.blobs.metadata` JSONB + intrinsic image columns). Confirm the project's deployed gateway is on v1.50+ by hitting `https://api.run402.com/health` or checking the platform release notes.
- [x] 1.3 Add `section_translations` table to `schema.sql` with idempotent guard (section_id FK→sections CASCADE, language, config JSONB, created/updated_at) + UNIQUE(section_id, language) + index on (section_id, language)
- [ ] 1.4 Apply updated schema (just `section_translations`) to the dev database (manual step — requires `run402 db push` against a specific project; documented in verification)

## 2. Block Registry Updates (blocks.ts)

- [x] 2.1 Add `editorType: 'inline' | 'list' | 'custom'` to the `BlockType` interface
- [x] 2.2 Add `translatableFields?: string[]` to the `BlockType` interface
- [x] 2.3 Declare `editorType` and `translatableFields` on every block in `BLOCK_TYPES` per the spec (hero, features, cta, stats, testimonials, faq, nav, footer_*, tagline_strip, page_banner, promo_cards, image_accordion, custom_html, embed, shape_divider, dynamic blocks) — 29 blocks in `src/lib/blocks.ts` + EMBED in `src/lib/blocks/embed.ts`

## 3. Embed Provider Expansion

- [x] 3.1 Add `spotify` provider to `embed-providers.ts` (buildSrc, sandbox, frameAncestor, defaultHeight)
- [x] 3.2 Add `soundcloud` provider to `embed-providers.ts`
- [x] 3.3 Add `eventbrite` provider to `embed-providers.ts`
- [x] 3.4 Add `google_forms` provider to `embed-providers.ts` (validate URL matches docs.google.com/forms pattern)
- [x] 3.5 Add `typeform` provider to `embed-providers.ts`
- [x] 3.6 Add `referrerpolicy="strict-origin-when-cross-origin"` to all `<iframe>` renders in `embed.ts` — applied to `EmbedBlockView.tsx:39` (sole iframe render site)
- [x] 3.7 Verify `getProviderHosts()` returns all 12 provider frameAncestors and the CSP meta tag is updated at build time — `csp.ts:54,67` already substitutes from `getProviderHosts()`; the 5 new hosts auto-flow into `<meta http-equiv="Content-Security-Policy">` on next build

## 4. upload-asset.js — Media Library Backend (Run402 v1.50 storage-backed)

- [x] 4.1 On successful upload, thread the recorded `filename` and `uploaded_by_member_id` through `r.project(projectId).assets.put(path, bytes, opts)` via `opts.metadata = { filename, uploaded_by: member_id }`. Pass `opts.exifPolicy = 'strip'` as the default (privacy default for end-user-uploaded photos — original bytes are still served unmutated; only the indexed `image_exif` is sanitized). Drop the existing local `readImageDimensions()` helper call — Run402 v1.50 populates `width_px` / `height_px` / `image_format` / `image_info` server-side on every upload. Brand-icon aspect check now reads `ref.width_px` / `ref.height_px` from the returned AssetRef.
- [x] 4.2 Add `action='list'` handler: thin wrapper over `assets.ls({ prefix: 'assets/', sort: 'createdAt:desc', limit: 40, cursor, filter })`. (Implementation note: kept `assets/` prefix to avoid invalidating pre-v1.50 uploads; spec text said `images/` but pragmatic call was to keep existing namespace.) Reshape response as `{ assets: blobs, nextCursor: next_cursor }`.
- [x] 4.3 On `action='delete'`: call `assets.rm(storageKey)`. The platform handles variant revocation, immutable-URL retention, and CDN invalidation. 404 swallowed for idempotency. NO local DB DELETE.

## 5. kychon-api.js — Custom Page Handlers + New Operations

- [x] 5.1 Lift `pages.create` out of the generic `insertRow` path → `createPageWithNav(input, actor)` in `kychon-api.js`. Sanitises slug, checks uniqueness against reserved names + existing rows, inserts the pages row, finds the global nav block by `(section_type='nav', scope='global', zone='header')`, appends `{ label, href, public: true }`. Returns `nav_not_found: true` when no global nav block exists.
- [x] 5.2 Lift `pages.delete` → `deletePageWithCascade(input, actor)`. Refuses to delete reserved-slug pages. Cascades `sections WHERE page_slug=$slug AND scope='page'`, deletes pages row, removes matching href from nav block `config.items`.
- [x] 5.3 Add `media.list` operation (admin-only) → `handleMediaList` (read-side, special-cased in `handleQuery`). Delegates to `upload-asset.js action='list'` via a same-project HTTP call (preserves auth surface). Filter passthrough.
- [x] 5.4 Add `media.delete` operation (admin-only) → `deleteMediaAsset(input, actor)`. Two-phase: first call returns `{ inUse: boolean }` if `cdn_url` appears in `sections.config::text` or `site_config.value::text` and `confirmed !== true`. Second call with `confirmed: true` proceeds with `upload-asset.js action='delete'`.
- [x] 5.5 Add `sections.translate` operation (admin-only) → `upsertSectionTranslation`. UPSERT via `ON CONFLICT (section_id, language) DO UPDATE`. Validates locale tag (BCP-47-ish: `^[a-z0-9][a-z0-9._-]{0,63}$`).
- [x] 5.6 Add `sections.getTranslation` operation (admin-only) → `handleSectionTranslationGet`. Returns `{ translation: row | null }`. Same locale-tag validation.

## 6. Locale Pool, ctx.locale Integration, and Translation Merge

- [x] 6.1 Define `LOCALE_POOL` constant in **`src/lib/locale-pool.ts`** (new file, shared between `scripts/_lib.ts` and admin UI islands). 50 entries: 12 W. European + 12 E. European + 4 East Asian + 4 Middle Eastern + 4 South Asian + 5 SE Asian + 9 African/Other. Exports `LOCALE_LABELS` (native endonyms), `isPoolLocale()`, `localeLabel()`, `isValidLocaleTag()`.
- [x] 6.2 Rewrite `buildI18nSpec(seed)` in `scripts/_lib.ts`: returns `{ defaultLocale, locales: [...LOCALE_POOL], detect: ['cookie:wl_locale', 'accept-language'] }`. Throws at build time if `defaultLocale` isn't in the pool, with actionable error pointing at `src/lib/locale-pool.ts`.
- [x] 6.3 `site_config.languages_enabled` migration in `schema.sql`: idempotent INSERT-SELECT that (a) mirrors existing `languages` value into `languages_enabled` when present, (b) seeds `["en"]` when neither exists. Legacy `languages` row untouched.
- [x] 6.4 `setLanguage()` cookie write in `src/lib/i18n.ts` — verified already present (`document.cookie = 'wl_locale=...; path=/; max-age=31536000; samesite=lax'` after the localStorage write).
- [x] 6.5 `getAvailableLocales()` in `src/lib/i18n.ts` reads `brand.languages_enabled || brand.languages`. `src/lib/config.ts:setAvailableLocales` callers read `siteConfig.languages_enabled || siteConfig.languages`. Legacy compat preserved.
- [x] 6.6 `deepMergeTranslation(base, override)` utility added in `src/lib/page-render.ts`. Plain objects merge recursively, arrays merge by index (untranslated items keep base values), scalars replace.
- [x] 6.7 Client-side locale resolution: `activeLocaleForTranslation()` checks BOTH (`locale !== defaultLocale`) AND (`locale ∈ languages_enabled || languages`). Returns the locale to JOIN on, or `null` to skip. (Note: client-side render today; future routed render will read `ctx.locale` from `@run402/functions` helpers when that path is built out.)
- [x] 6.8 + 6.9 `fetchSectionTranslationsForActiveLocale()` fetches `section_translations?language=eq.<locale>` only when locale is active (skipped otherwise — same query cost as today for default-locale visitors). `applySectionTranslations()` deep-merges row-by-row. Both wired into `fetchAndUpdate`'s Promise.all.

## 7. AdminBar Component

- [x] 7.1 Create `src/components/AdminBar.astro` — thin wrapper that renders `<AdminBarIsland client:load />` inside a `<div transition:persist>`
- [x] 7.2 Create `src/components/kychon/AdminBarIsland.tsx` — React island that: calls `getRole()` on mount and returns `null` for non-admins; renders the sticky bar (`h-9 sticky top-0 z-[9999] bg-slate-900 text-slate-200 flex items-center gap-1 px-3 border-b`); switches to indigo background when in translation mode
- [x] 7.3 Pages `DropdownMenu` fetches `pages?order=slug.asc` on open, renders items (bold current page), separator, "+ New Page". Trash affordance per non-system page opens the delete dialog.
- [x] 7.4 "+ Add Block" `Button` dispatches `kychon:admin-editor-zone-add` event for `zone='main'` (matches `AdminEditorControlsIsland`'s listener)
- [x] 7.5 Language switcher `DropdownMenu` reads `languages_enabled || languages`; hidden when ≤1; shows active locale; "+ Add language…" opens AddLanguageDialog. Selecting a non-default locale flips the bar to indigo + shows "Translating: X" Badge.
- [x] 7.6 Preview `Button` toggles `data-admin-preview` on `<body>`; CSS rules in `public/css/admin-editing.css` hide `[data-admin-bar]`, `[data-admin-zone-add-button]`, `[data-admin-edit-button]`, `[data-admin-section-actions]` when set.
- [x] 7.7 Exit ✕ `Button` writes `wl_admin_bar_hidden = '1'` to localStorage and re-renders null.
- [x] 7.8 `<AdminBar />` added to `Portal.astro` after `<DemoBanner />` and before the flex column.

## 8. Page Management Dialogs

- [x] 8.1 `PageCreatorDialog` in `src/components/kychon/PageManagementDialogs.tsx`: Dialog with Title Input (auto-generates slug), slug Input (editable, uniqueness via server error → suggestion), Add to navigation Checkbox, Members only Checkbox, Cancel + Create Page → Button (disabled when slug empty or busy).
- [x] 8.2 PageCreator submit calls `execOp('pages.create', ...)`, surfaces `nav_not_found` as a toast warning, navigates to `/{slug}` on success.
- [x] 8.3 Delete affordance on each Pages dropdown item (X icon button, opacity-0 + group-hover:opacity-100). Click opens `PageDeleteDialog`.
- [x] 8.4 `PageDeleteDialog`: destructive message includes "also removed from navigation" when `show_in_nav` is true. Confirms via `execOp('pages.delete', {id, slug})`; reports cascade count in toast; navigates home if the deleted page was active.

## 9. Media Library — MediaPicker Component

- [x] 9.1 Create `src/components/kychon/MediaPickerIsland.tsx`: `Dialog` with two-pane grid layout (`grid-cols-[1fr_260px] divide-x`)
- [x] 9.2 Left pane: `ScrollArea` with 4-col thumbnail grid; each thumbnail is a `button` with `aspect-square overflow-hidden rounded-md border-2`; selected item gets `border-primary` + `Check` icon overlay; "Load more" `Button variant="ghost"` when `nextCursor` is non-null
- [x] 9.3 Right pane: toggle between upload drop-zone (label + `Upload` Lucide icon + hidden `input type="file"`) and selected-image preview (`img` + filename + `{width}×{height} · {size}` + "Delete image" `Button variant="ghost"` with destructive text colour)
- [x] 9.4 Load assets from `media.list` on Dialog open; append on "Load more". Render thumbnails from `row.variants.thumb.cdn_url` when present (320w WebP) falling back to `row.cdn_url` for below-thumb-sized assets and pre-v1.49 uploads. Display `metadata.filename` (or the key) in the per-thumb tooltip.
- [x] 9.5 Upload drop-zone: on file select, call `upload-asset.js`, add new row to assets list, auto-select the new asset
- [x] 9.6 "Delete image" flow: call `media.delete` (which returns `inUse`); if `inUse=true` show a warning `Dialog` "This image may be in use on your site" with "Delete anyway"; if `inUse=false` show simple confirm `Dialog`; on confirm proceed with deletion and remove from grid
- [x] 9.7 "Use this image →" `Button` (disabled until selection): close Dialog, **PATCH the full v1.49 `AssetRef` object (not just the `cdn_url` string) to the underlying block config field**. Re-render via the block renderer; the AssetRef-shape detection in `kychon-image.ts` (task 9.9) emits `<picture>` with variants directly.
- [x] 9.8 Update `AdminEditor.astro`: change `data-editable-image` click handler to open `MediaPickerIsland` instead of triggering the hidden file input directly. The MediaPicker's "Use this image →" callback writes the full AssetRef back to the target field — `data-editable-image` no longer pairs with a string URL save.
- [x] 9.9 Update `src/lib/kychon-image.ts`: add AssetRef-shape detection at the entry of `kychonImageHtml` and `<KychonImage>`. When the field is an object with `cdn_url` + `variants`, pass directly to `renderPicture(field, opts)` from `@run402/astro/manifest` (no manifest lookup). When the field is a string, fall through the existing legacy path (build-time manifest lookup → `<picture>` on hit, plain `<img>` on miss). Type the field as `string | AssetRef` in the consumer signatures.
- [x] 9.10 **NOT NEEDED** — no localStorage runtime-asset cache, no render-time `r.assets.list?key=…` lookup. The Decision 8 pivot (see design.md) removes this work; the AssetRef-persistence pattern eliminates the need for a runtime manifest entirely. If you find yourself adding such a cache, stop and re-read Decision 8.

## 10. Block List Editor — BlockListEditor Component

- [x] 10.1 Create `src/components/kychon/BlockListEditorIsland.tsx`: `Popover` (shadcn) anchored to the block's edit affordance button
- [x] 10.2 Popover header: block label `p.font-semibold` + optional `Badge` "GLOBAL" when `scope='global'`
- [x] 10.3 Items list: for each item, render a row with `GripVertical` drag handle (`draggable`), truncated primary text (title / label / question), hover-revealed `Pencil` and `X` icon `Button variant="ghost"` components
- [x] 10.4 Inline detail form: conditional render (not navigation) when a row's Pencil is clicked; fields rendered as `Input`/`Textarea`/`Label` per the item schema; image fields render a `Button` that opens `MediaPickerIsland`; "Done" collapses back to list
- [x] 10.5 "+ Add item" `Button variant="outline" className="w-full"`: appends default item from `defaultConfig`, opens its inline detail form
- [x] 10.6 HTML5 drag-to-reorder on list items: `dragstart`, `dragover`, `drop` events; show insertion indicator; reorder items array in state on drop
- [x] 10.7 Footer: Cancel `Button variant="outline"` + "Save changes" `Button`; on save issue `sections.updateConfig` with full updated config; show toast "Saved — appears on all pages" for global blocks, "Saved" otherwise
- [x] 10.8 Wire `BlockListEditorIsland` into the admin editing system: when a block's edit affordance is clicked and `BLOCK_TYPES[section_type].editorType === 'list'`, mount `BlockListEditorIsland` instead of the existing inline editor

## 11. Block Translation — BlockTranslationEditor + AddLanguage Components

- [x] 11.1 Create `src/components/kychon/BlockTranslationEditorIsland.tsx`: `Dialog` with `ScrollArea` containing the two-column field table (source label + read-only value on left; `Textarea` translation input on right)
- [x] 11.2 Load existing translation on open: call `sections.getTranslation` for the active locale; pre-fill Textareas with stored values
- [x] 11.3 Flat field rendering: one row per `translatableFields` entry; label is the dot-path, source is `section.config[field]`
- [x] 11.4 Array field rendering: for `items[].title` pattern, render a group per array index showing label "Item {n} — {field}" with source and translation side-by-side
- [x] 11.5 "✨ Translate with AI" `Button`: call `translate-text.js` for each field value; fill all Textareas; show `Loader2` spinner during request; disable button while loading
- [x] 11.6 "Save {lang} translation" `Button`: collect only fields with non-empty translation values into a partial config JSONB; call `sections.translate`; close Dialog on success
- [x] 11.7 Wire into `AdminEditor.astro`: when in translation mode (non-default language active in admin bar) and a block edit affordance is clicked, open `BlockTranslationEditorIsland` instead of the normal block editor (for blocks where `translatableFields.length > 0`)
- [x] 11.8 Create `src/components/kychon/AddLanguageIsland.tsx`: `Dialog` with `Select` listing `AVAILABLE_LANGUAGES` filtered to exclude `site_config.languages`; on confirm, UPSERT `site_config` key `languages` with the new code appended; close Dialog and update admin bar language list
- [x] 11.9 Wire "+ Add language..." dropdown item in `AdminBarIsland` to open `AddLanguageIsland`

## 12. Verification (manual — runs against a deployed portal after schema apply)

> All section-12 items below are hands-on tests that require a deployed portal
> with the schema applied (`run402 db push` for `section_translations` + the
> `languages_enabled` migration). They are intentionally NOT marked complete
> in this implementation pass — they are the runbook for first-deploy QA.
> `npm run check` (build + typecheck + biome + vitest) passes; the openspec
> change validates; all in-tree unit tests still pass (1029/1029).

- [ ] 12.1 Create a new page from the admin bar; verify nav auto-insert (and toast when no nav block)
- [ ] 12.2 Delete the test page; verify sections cascade and nav item removal
- [ ] 12.3 Upload an image via the MediaPicker; verify the response carries `metadata.filename` / `metadata.uploaded_by` (from the put opts) + `image_format` / `width_px` / `height_px` (platform-extracted); verify the image appears in the library on next `media.list` call. NO Kychon DB row to assert (storage-backed).
- [ ] 12.4 Delete the uploaded image with an in-use warning; verify the warning dialog appears when the cdn_url is in a section config
- [ ] 12.5 Add ES as a language via the Add Language dialog; verify `site_config.languages_enabled` is updated (NO platform deploy occurred — verify no `r.project(id).apply(...)` call in network); verify the language switcher shows it on next render
- [ ] 12.6 In ES translation mode, open a hero block translation editor; fill fields manually and save; verify `section_translations` row is created and the ES page render shows translated text
- [ ] 12.6a Kitchen-sink end-to-end: confirm `spec.i18n.locales` in the deployed release inventory contains 50 entries (the LOCALE_POOL), NOT just the per-portal `languages_enabled`. Inspect via `r.project(id).apply.getActiveRelease({ siteLimit: 1 })`.
- [ ] 12.6b Remove ES from `languages_enabled` (e.g. via a "Manage languages" affordance or by manually editing the row); verify the language switcher no longer shows ES; verify a visitor with `Cookie: wl_locale=es` now sees default-locale content (the JOIN is skipped per the enabled-check); verify the `section_translations` rows for ES were NOT deleted.
- [ ] 12.6c Re-add ES; verify the switcher shows it again and the previously-saved translations render correctly without any re-translation work.
- [ ] 12.7 Use "Translate with AI" on a features block; verify all fields are filled and saveable
- [ ] 12.8 Open a features block list editor; add an item, drag-reorder, delete one; save and verify the DB config matches
- [ ] 12.9 Test each new embed provider (Spotify, SoundCloud, Eventbrite, Google Forms, Typeform) in the embed block popover; verify each renders a valid iframe with `referrerpolicy` attribute
- [ ] 12.10 Verify non-admin and visitor see no admin bar, no edit affordances, and no MediaPicker on any page
- [ ] 12.11 AssetRef-persistence end-to-end: upload an image via MediaPicker for a hero block's bg_image; inspect `sections.config.bg_image` in the DB and verify it is a full AssetRef object (has `cdn_url`, `variants.thumb`, `variants.medium`, `variants.large`, `blurhash`, `width_px`, `height_px`) — NOT just a string URL. Reload the page and verify the rendered HTML is `<picture>` with the WebP source ladder, NOT a plain `<img>`.
- [ ] 12.12 Legacy string-URL compatibility: confirm a seeded block whose config still has `bg_image: "/custom/assets/some-seeded-image.jpg"` continues to render via the existing build-time `@run402/astro` manifest path (or plain `<img>` fallback if no manifest entry). The AssetRef-shape detection in 9.9 must not break legacy configs.
