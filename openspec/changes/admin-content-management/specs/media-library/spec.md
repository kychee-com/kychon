## ADDED Requirements

### Requirement: `upload-asset.js` records filename + uploader via Run402 v1.50 metadata, with EXIF stripped by default

`upload-asset.js` SHALL call `r.project(projectId).assets.put(path, bytes, opts)` for every admin upload. The `opts.metadata` JSONB SHALL include:

- `filename` — the original file name as supplied by the client (string)
- `uploaded_by` — the authenticated member's id (string)

`opts.exifPolicy` SHALL default to `'strip'` so end-user-uploaded photo EXIF (GPS, camera serial numbers, owner identifiers, software, maker-notes) is dropped from the queryable `image_exif` JSONB. The original bytes served via `cdn_url` are NEVER mutated under either policy — only the indexed copy is affected. An admin who needs full EXIF on a specific upload MAY override with `exifPolicy: 'keep'`.

`upload-asset.js` SHALL NOT maintain a Kychon-side DB table for media metadata. Run402's `internal.blobs` is the source of truth. Server-extracted intrinsic fields (`image_format`, `image_info`, `image_exif`, `width_px`, `height_px`, `blurhash`, `variants`) are populated by the platform on every upload and read through `r.assets.list`.

#### Scenario: Image upload writes metadata + applies strip policy

- **WHEN** an admin uploads `images/hero.jpg` via any upload path
- **THEN** `upload-asset.js` calls `r.project(id).assets.put('images/hero.jpg', bytes, { contentType, metadata: { filename: 'hero.jpg', uploaded_by: '<member_id>' }, exifPolicy: 'strip' })`
- **AND** the returned `AssetRef.metadata` echoes the supplied object
- **AND** `AssetRef.image_exif_policy === 'strip'`
- **AND** `AssetRef.image_exif` contains only allowlisted EXIF tags (GPS / camera_serial / owner_name etc. are absent)
- **AND** a GET of `AssetRef.cdn_url` still returns the original bytes (full EXIF intact in the served file)

#### Scenario: Upload failure does NOT require Kychon-side rollback

- **WHEN** `r.project(id).assets.put` throws (network / quota / corrupt image / bad metadata)
- **THEN** `upload-asset.js` surfaces the error to the client per the existing upload-error contract
- **AND** there is NO Kychon-side DB state to clean up (no shadow table)
- **AND** the platform's "no partial row" guarantee (v1.50) ensures `internal.blobs` has no orphaned row either

### Requirement: `media.list` is a thin wrapper over `r.project(id).assets.list`

`kychon-api.js` SHALL expose a `media.list` operation (admin-only) that delegates to `r.project(projectId).assets.list({ prefix: 'images/', sort: 'createdAt:desc', limit: 40, cursor })` and returns the result reshaped as `{ assets, nextCursor }` for backward compatibility with the existing picker JS. No Kychon-side SQL query.

The operation SHALL accept optional `filter` keys passing through to Run402's `assets.list` filter surface (`filter.uploaded_by`, `filter.tag`, `filter.format`, `filter.is_image`, `filter.min_width`, `filter.max_width`, `filter.min_height`, `filter.max_height`) for future "filter by uploader" / "show only photos" views.

#### Scenario: First page newest-first

- **WHEN** an admin calls `media.list` with no cursor
- **THEN** `kychon-api.js` calls `r.project(id).assets.list({ prefix: 'images/', sort: 'createdAt:desc', limit: 40 })`
- **AND** the response is `{ assets: blobs, nextCursor: next_cursor }` where `blobs` are the v1.50 top-level-flat AssetListRow shape (key, metadata, width_px, height_px, image_format, blurhash, variants, cdn_url, etc.)

#### Scenario: Pagination via cursor

- **WHEN** an admin calls `media.list` with a cursor matching a prior `nextCursor`
- **THEN** the response contains the next page; cursor semantics match Run402's sort-aware base64url JSON cursor

#### Scenario: Non-admin cannot call media.list

- **WHEN** a non-admin member calls `media.list`
- **THEN** the API returns an authorization error (same admin gate as the existing kychon-api mutation surface)

#### Scenario: Pre-existing assets are visible without re-upload

- **WHEN** a Kychon portal that uploaded assets BEFORE this change deploys `media.list`
- **THEN** the response includes those pre-existing rows (they live in `internal.blobs`)
- **AND** their `metadata` field is `null` (no filename / uploader recorded historically)
- **AND** the picker renders them with the key as the fallback filename label
- **AND** their `width_px` / `height_px` / `image_format` are populated by the platform's v1.49 backfill where possible

### Requirement: `media.delete` calls `r.project(id).assets.delete` with a Kychon-side in-use warning

`media.delete` SHALL delegate the storage-side removal to `r.project(id).assets.delete(path)`. The platform handles immutable-URL revocation, variant cleanup, and CDN cache invalidation. There is NO Kychon-side DB DELETE to issue.

Before deleting, `media.delete` SHALL perform a Kychon-specific in-use check by scanning `sections.config::text` and `site_config.value::text` for the asset's `cdn_url`. The check returns `{ inUse: boolean }` in the response. A truthy `inUse` value SHALL NOT block the delete — the platform's variant revocation + immutable retention handles the storage-side ramifications; the UI uses the flag to show a warning dialog before the admin confirms.

#### Scenario: media.delete removes the asset via platform call

- **WHEN** an admin calls `media.delete` for `images/hero.jpg`
- **THEN** `kychon-api.js` calls `r.project(id).assets.delete('images/hero.jpg')`
- **AND** the response is `{ status: 'deleted', inUse: <boolean> }`

#### Scenario: In-use flag returned but does NOT block

- **WHEN** an admin calls `media.delete` for an asset whose `cdn_url` appears in `sections.config`
- **THEN** the in-use check returns `{ inUse: true }`
- **AND** `r.project(id).assets.delete` still runs (the UI may have already confirmed; this layer doesn't second-guess)
- **AND** the response is `{ status: 'deleted', inUse: true }` so the UI can record the action

### Requirement: data-editable-image click opens the MediaPicker Dialog

Clicking any element with a `data-editable-image` attribute in admin mode SHALL open the `MediaPickerIsland` Dialog instead of directly triggering a `<input type="file">`. The Dialog SHALL present a two-pane layout: a left pane with a scrollable 4-column thumbnail grid of existing assets loaded from `media.list`, and a right pane that toggles between an upload drop-zone and a selected-image preview.

The thumbnail grid SHALL prefer `row.variants.thumb.cdn_url` (the 320w WebP thumbnail variant the platform generates at upload time) for grid rendering, falling back to `row.cdn_url` for assets below the 320 px variant threshold (and for assets uploaded before v1.49). The selected-image preview SHALL display the original `cdn_url`, the recorded `metadata.filename` (or the key as fallback), the platform-populated `width_px × height_px`, `image_format`, and the `size_bytes`.

#### Scenario: Admin click opens picker instead of file dialog

- **WHEN** an admin clicks an element with `data-editable-image`
- **THEN** the MediaPicker Dialog opens
- **AND** no native file picker opens immediately

#### Scenario: Library grid shows existing assets

- **WHEN** the MediaPicker opens
- **THEN** the left pane shows thumbnails (using `variants.thumb.cdn_url` when available), newest first

#### Scenario: Selecting a thumbnail enables "Use this image"

- **WHEN** an admin clicks a thumbnail
- **THEN** that thumbnail is highlighted with a primary border and checkmark
- **AND** the right pane shows the selected image preview with filename (from `metadata.filename` if present, otherwise the asset key), dimensions, and file size
- **AND** the "Use this image →" button becomes enabled

#### Scenario: Using a selected asset updates the image in place

- **WHEN** an admin clicks "Use this image →"
- **THEN** the Dialog closes
- **AND** the target image element's src is updated to the selected asset's `cdn_url` (or `variants.medium.cdn_url` if a smaller variant is more appropriate for the target's rendered width)
- **AND** a PATCH is issued to save the new image path to the underlying data source

#### Scenario: Uploading a new image from the picker

- **WHEN** an admin clicks the upload drop-zone or drops a file onto it
- **THEN** the file is uploaded via `upload-asset.js` (which records `metadata.filename` + `uploaded_by` and applies `exifPolicy: 'strip'`)
- **AND** the returned `AssetRef` is prepended to the local grid state (no need to refetch `media.list`)
- **AND** the new asset is auto-selected in the grid and the "Use this image →" button is enabled

#### Scenario: Load more fetches additional assets

- **WHEN** the admin scrolls to the bottom of the grid and clicks "Load more"
- **THEN** the next page of assets is fetched via `media.list` with the prior `nextCursor`, and appended to the grid

### Requirement: Deleting an asset from the picker warns when it may be in use

The selected-image preview in the MediaPicker SHALL include a "Delete image" `Button variant="ghost"` with destructive styling. Clicking it SHALL call `media.delete` which returns `{ inUse: boolean }`. The UI behavior is:

- If `inUse === true`, show a warning `Dialog` "This image may be in use on your site." with a "Delete anyway" option that, on confirm, calls `media.delete` AGAIN with `confirmed: true` (or equivalent) to actually proceed with the platform-side deletion.
- If `inUse === false`, show a simpler "Are you sure?" confirmation Dialog. Confirming calls `media.delete` with `confirmed: true`.

The in-use check is informational only — see "media.delete calls `r.project(id).assets.delete`" requirement above. The platform handles variant revocation, immutable-URL retention, and CDN invalidation regardless of the in-use flag.

#### Scenario: In-use warning shown when asset appears in config

- **WHEN** an admin attempts to delete an asset whose `cdn_url` appears in `sections.config`
- **THEN** a Dialog warns "This image may be in use on your site"
- **AND** the admin must confirm "Delete anyway" to proceed

#### Scenario: Simple confirmation when asset is not detected in config

- **WHEN** an admin attempts to delete an asset whose `cdn_url` does not appear in any config
- **THEN** a simpler confirmation Dialog is shown without the in-use warning
