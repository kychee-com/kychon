## Context

Kychon portals are Astro sites rendered from a `sections` table where every visible block — header, main, footer — is a row addressed by `(page_slug, zone, scope, section_type, config JSONB)`. Admins edit live pages via `data-editable*` attributes wired to an `AdminEditor.astro` island; non-admin visitors see none of that chrome. The engine ships with a block registry (`src/lib/blocks.ts`) that is both the build-time bake renderer and the runtime hydrator, giving a single isomorphic render path.

This change adds five orthogonal capabilities (admin bar, page management, media library, block translation, block list editor) plus embed expansion. All five share the constraint that they must be invisible to non-admins and must compose cleanly with the existing zone/scope/position model, the existing `kychon-api.js` mutation gateway, and the shadcn/Tailwind UI stack.

## Goals / Non-Goals

**Goals:**

- Persistent admin bar above every page for admins: page navigation, new-page creation, block picker shortcut, translation mode, preview.
- Page CRUD: create with nav auto-insert, delete with nav auto-remove and block cascade.
- Media library: track all uploaded assets in DB; replace bare file-input on image edits with a two-pane picker Dialog.
- Block translation: per-locale partial config overrides stored in `section_translations`; render-time deep-merge; field-by-field editor with AI-fill.
- Block list editor: Popover CRUD (add / drag-reorder / inline-edit / delete) for all blocks whose config has a top-level items array.
- Embed expansion: 5 new verified providers; `referrerpolicy` on all iframes.

**Non-Goals:**

- Stripe embed provider (deferred — payment flows need separate consent and CSP review).
- Facebook/Instagram embed providers (deferred — tracking pixel disclosure UI needed first).
- Dedicated `/admin/media` management page (modal picker is sufficient for MVP).
- Page templates or starter layouts (blank canvas + add blocks is the model for now).
- Translation of dynamic block data (announcements, events, etc.) — those rows already use `content_translations`.
- Member-facing language preference UI changes — `i18n` spec is unchanged.

## Decisions

### Decision 1: Admin bar is a Portal.astro-level island, not a block

The admin bar must appear on every page, above the header zone, and be completely invisible to non-admins. Making it a `sections` block would require it to have a `page_slug` and a `scope`, and the zone/scope query would need to include it — bloating every page render with admin-only data.

Instead, `Portal.astro` renders `<AdminBar />` unconditionally just before the flex column (same slot as `<DemoBanner />`). The `AdminBarIsland.tsx` React island self-hides when `getRole()` is not `'admin'`, so non-admins receive the HTML node but it has `display: none` applied before paint. The island is `client:load` so it initialises immediately on admin sessions.

Alternative considered: a separate `admin.css` that shows a `#admin-bar` element only with the `.admin-mode` body class. Rejected because it requires coordinating class application before first paint; the island approach is self-contained.

### Decision 2: pages.create and pages.delete are lifted to custom handlers in kychon-api.js

The generic `insertRow` / `deleteRow` path in `kychon-api.js` handles straightforward table writes. Both page operations need side-effects: `pages.create` must optionally append a nav item to the global `nav` block's `config.items`; `pages.delete` must cascade-delete page-scoped sections and remove the matching nav item.

These side-effects require the handler to query the `sections` table (find the nav block), read its `config`, compute a new `config.items` array, and issue a second write — all inside one request. The generic path cannot express this.

Lifting to custom handlers keeps the mutation auth model (operation allowlist, admin-only gate) intact while allowing multi-step logic. The nav side-effect is best-effort: if no global `nav` block exists, the page is created/deleted successfully and the client receives a `nav_not_found: true` flag in the response payload, which the AdminBarIsland converts to a toast.

Alternative considered: a separate edge function. Rejected — adds a new deployment artifact and breaks the single-API-gateway model for page mutations.

### Decision 3: media library is backed by Run402 v1.50 `assets.list`, not a Kychon-side DB table

**The earlier draft of this design called for a `media_assets` shadow table in the project DB. Run402 v1.50 (shipped 2026-05-20) makes that table unnecessary** — `internal.blobs.metadata` is a flat JSONB column the caller writes via `assets.put` opts, the `assets.list` route serves sorted/filtered media-picker queries directly (5 partial indexes back it), and intrinsic image fields (`width_px`, `height_px`, `blurhash`, `image_format`, `image_info`, `image_exif`) are populated server-side on every upload. The old shadow-table pattern had three real problems Kychon would have inherited: (1) dual-write on every upload and delete, with drift on partial failure; (2) pre-existing assets invisible until manually re-uploaded; (3) every CMS-shaped Kychon-adjacent app would reimplement the same table independently.

**Upload path.** `upload-asset.js` calls `r.project(id).assets.put(path, bytes, { contentType, metadata: { filename, uploaded_by: member_id }, exifPolicy: 'strip' })`. The `metadata` JSONB is opaque to the platform (4 KB cap, flat shape — Kychon's three fields fit comfortably). `exifPolicy: 'strip'` is Kychon's default because end-user photos may carry GPS / camera serial / owner identifiers — the original bytes still serve through `cdn_url` (we never mutate CAS) but the queryable `image_exif` stays sanitized. Admins can re-upload an asset with `exifPolicy: 'keep'` later if they need full EXIF.

**Read path.** `media.list` is a thin wrapper:

```js
const { blobs, next_cursor } = await r.project(projectId).assets.list({
  prefix: 'images/',
  sort: 'createdAt:desc',
  limit: 40,
  cursor,
});
return { assets: blobs, nextCursor: next_cursor };
```

The picker reads `metadata.filename`, `width_px`, `height_px`, `image_format`, `variants.thumb.cdn_url` (or `cdn_url` for below-thumb-sized originals) — all top-level fields on each row.

**Filter capability falls out for free.** v1.50's `filter.uploaded_by`, `filter.format`, `filter.is_image`, `filter.min_width`/`max_width`/`min_height`/`max_height`, `filter.tag` all hit indexed partial indexes. A future "show only photos I uploaded" view costs zero additional Kychon code.

**Delete path.** `media.delete` calls `r.project(id).assets.delete(path)` for the storage row + variant revocation. The in-use check (`SELECT 1 FROM sections WHERE config::text LIKE '%' || $cdn_url || '%' LIMIT 1` plus the same check on `site_config`) stays on the Kychon side because it's portal-specific. A warning Dialog (not a hard block) is shown when the image appears to be in use.

**No backfill required.** Every asset already in `internal.blobs` is visible via `r.assets.list` from the moment v1.50 deployed. Pre-existing assets show up with `metadata: null` (no filename/uploader recorded historically); admins can re-upload to populate metadata, or just live with `null` since the asset still renders.

Alternative considered: keep a `media_assets` table for application-specific fields beyond what v1.50 indexes (e.g. captions, alt text, tags). Rejected — those fields ARE caller-provided metadata; the v1.50 4 KB JSONB cap accommodates them. If Kychon ever needs cross-asset joins (e.g. "all assets tagged 'sponsor'"), `filter.tag` handles it server-side.

Alternative considered (original draft): a project-DB shadow table mirroring storage. Rejected — see paragraph above; v1.50 eliminates the dual-write hazard the original draft was working around.

### Decision 4: section_translations stores partial config JSONB, not field-by-field rows

The existing `content_translations` table uses `(content_type, content_id, language, field, translated_text TEXT)` — one row per translated field. For block configs, fields can be nested arrays (`items[].title`) and the complete set of translatable fields varies per block type. Storing them field-by-field would require either serialising array paths as strings (`"items[0].title"`) or expanding each array element into its own row — both are fragile when items are reordered.

`section_translations.config JSONB` stores only the translated fields as a partial config mirror:

```json
{ "heading": "Bienvenidos", "items": [{ "title": "Portal de Miembros" }, { "title": "Eventos" }] }
```

The renderer merges at call site: `deepMerge(section.config, translation.config)`. Array merge is by index: `translation.config.items[i]` is spread over `section.config.items[i]`, so untranslated item fields fall back to the base config. This is safe because the translation editor always writes the full array for `items[]` fields — it never writes a partial array.

Alternative considered: add `{en: "...", es: "..."}` multilingual objects directly into `sections.config`. Rejected — complicates every read path (the renderer would need to know the locale to pick the right value), breaks the single-language seed model, and makes JSONB config larger and harder to validate.

### Decision 5: BlockType registry gains editorType and translatableFields

Both the `BlockListEditor` (which block types get the Popover CRUD) and the `BlockTranslationEditor` (which fields get translation inputs) are driven by declarations on the block registry entry — not by component-level special-casing per block type.

`editorType: 'inline' | 'list' | 'custom'` tells the admin editing system which editor to mount for a block's edit affordance. `translatableFields: string[]` lists the dot-path fields that appear in the translation editor (empty array = block is not translatable).

This keeps the `AdminEditor.astro` orchestration logic thin — it reads the registry and delegates. Adding a new block type requires only a registry entry; no new editor component is needed unless the block has bespoke editing requirements (like `embed`).

### Decision 6: shadcn Popover for BlockListEditor, shadcn Dialog for BlockTranslationEditor and MediaPicker

`BlockListEditor` is triggered from the block's edit affordance (a small button overlaid on the block). A `Popover` anchored to that button is the right affordance — it appears near the block, stays on screen while the admin interacts with the list, and dismisses on outside click.

`BlockTranslationEditor` and `MediaPicker` are heavier interactions (field-by-field editing, scrollable image grid) that benefit from a centred `Dialog` with a `ScrollArea`. The Dialog's focus-trap and backdrop also signal to the admin that they are in a distinct editing context.

Alternative considered: `Sheet` (slide-over drawer) for MediaPicker to give more horizontal space. Rejected — `Sheet` is not in the current component set and the two-pane Dialog at `max-w-3xl` gives sufficient room.

### Decision 7: Embed referrerpolicy gap is fixed in this change

All existing iframe renders in `src/lib/blocks/embed.ts` lack `referrerpolicy="strict-origin-when-cross-origin"`. Without it, embedded iframes receive the full Referer header including any path/slug the member is visiting. Adding the attribute to every iframe render is a one-line fix per provider call site and should ship with the provider expansion rather than as a standalone change.

## Risks / Trade-offs

- **Nav side-effect silent failure** — if no global `nav` block exists (custom chrome setups), the nav auto-insert is silently skipped. Mitigation: return `nav_not_found: true` in the API response; AdminBarIsland shows a toast "Page created — add it to your navigation manually."
- **section_translations array index drift** — if base config `items[]` is reordered after a translation is saved, translated item text will misalign (item 0's translation now shows on item 1). Mitigation: document that reordering items in the list editor clears existing translations for that block (show a confirmation: "Reordering will clear saved translations for this block. Continue?").
- **In-use text-scan check (`media.delete`)** — `config::text LIKE '%cdn_url%'` may produce false positives (URL substring appearing in unrelated text) or miss usages where the URL is stored with a different CDN prefix (e.g. variant URLs aren't matched by the source URL). Mitigation: the check is a warning, not a block; the admin can ignore and delete. The platform-level cascade (variant revocation, immutable-URL retention) handles the storage-side cleanup regardless.
- **admin-bar z-index layering** — `z-[9999]` may conflict with existing modal/toast z-indices. Mitigation: audit current z-indices before shipping; existing `Sonner` toasts and `Dialog` overlays use `z-50`/`z-[100]`; admin bar at `z-[9999]` is safely above them.
- **Popover width for complex list blocks** — `BlockListEditor` at `w-80` (320px) may be tight for blocks with long item text (e.g. FAQ questions). Mitigation: `w-96` for `faq` and `footer_links` overrides in the registry, or truncate with `Tooltip` on hover showing full text.
- **AI translation rate limits** — `translate-text.js` calls an external AI API; concurrent block translations may hit rate limits. Mitigation: the "Translate with AI" button is per-block, not bulk; no queueing needed for MVP.

## Migration Plan

1. Confirm Run402 platform is on v1.50+ (gateway commit on/after the 2026-05-20 deploy; `@run402/functions@^2.4.0` available to the deployed function bundle). The migration assertion on v1.50 prevents the gateway from booting at the wrong version, so this check is mostly a sanity step.
2. Run `npx shadcn add scroll-area popover` to install the two new shadcn components.
3. Apply `schema.sql` additions (one `DO $$ BEGIN ALTER TABLE … ADD …` guard for `section_translations`) via `run402 db push` or the project's standard migration path. **No** `media_assets` migration — that table is intentionally absent; media metadata lives in Run402's `internal.blobs`.
4. Deploy updated `upload-asset.js` (threads `metadata: { filename, uploaded_by }` + `exifPolicy: 'strip'` through `r.project(id).assets.put`; adds an `action='list'` wrapper over `r.project(id).assets.list`). **Pre-existing assets appear in the media library automatically** — they were always in `internal.blobs`; v1.50 just makes that queryable. Pre-existing rows show up with `metadata: null`; admins can re-upload to attach filename + uploader, or live with the unattributed entry.
5. Deploy updated `kychon-api.js` (custom page handlers + `media.*` wrappers + `sections.translate/getTranslation` operations).
6. Deploy updated Astro build (AdminBar, MediaPicker, BlockListEditor, BlockTranslationEditor, blocks.ts registry changes, Portal.astro AdminBar injection, page-render.ts translation merge, embed-providers.ts additions).
7. Verify: create a test page from the admin bar, check nav auto-insert; upload an image and see it in the picker with extracted dimensions + the recorded `filename` + `uploaded_by`; edit a hero block's ES translation and reload with locale=es.

Rollback: remove `<AdminBar />` from Portal.astro and revert `upload-asset.js` and `kychon-api.js` to prior versions. The one new table (`section_translations`) is empty and additive — dropping is safe. The `data-editable-image` trigger can revert to direct file-input independently. **No DB cleanup needed for the media library** — it's all platform-side state already managed by Run402's CAS GC and immutable-URL retention.

## Open Questions

- Should reordering items in the BlockListEditor clear existing `section_translations` for that block, or attempt to preserve them by re-indexing? The safe default is to clear and warn; re-indexing is error-prone if items are also added or removed in the same operation.
- Should the admin bar's language switcher show only languages with at least one `section_translations` row, or all languages in `site_config.languages`? Showing all configured languages is simpler and lets admins start translating in a language before any block has been translated.
