## MODIFIED Requirements

### Requirement: Image editing via click-to-upload

Elements with `data-editable-image="{storage_path}"` SHALL show a camera/upload overlay on admin hover. Clicking SHALL open the `MediaPicker` Dialog, which presents the media library grid and an upload option. When the admin selects an existing asset or uploads a new file and confirms, the image `src` attribute SHALL be updated and a PATCH SHALL be issued to save the new image path to the underlying data source.

The previous behaviour (clicking directly opens a native `<input type="file">` picker) is replaced by the MediaPicker Dialog. The `<input type="file" hidden>` element used for direct upload is no longer triggered on `data-editable-image` click; it remains present inside the MediaPicker for its internal upload flow only.

#### Scenario: Admin clicks editable image and sees the MediaPicker
- **WHEN** an admin clicks on an element with `data-editable-image`
- **THEN** the `MediaPicker` Dialog opens showing the media library
- **AND** no native file picker dialog opens immediately

#### Scenario: Selecting an existing asset from the library updates the image
- **WHEN** an admin selects a thumbnail from the MediaPicker library and clicks "Use this image →"
- **THEN** the Dialog closes
- **AND** the target image element's `src` is updated to the selected asset's cdn_url
- **AND** a PATCH request saves the new path to the database

#### Scenario: Uploading a new image from within the picker updates the image
- **WHEN** an admin uploads a new file via the MediaPicker's upload drop-zone
- **THEN** the file is uploaded, a `media_assets` row is created, and the new asset is auto-selected
- **AND** clicking "Use this image →" updates the image src and saves the path

#### Scenario: Cancelling the MediaPicker leaves the image unchanged
- **WHEN** an admin opens the MediaPicker and clicks "Cancel"
- **THEN** the Dialog closes
- **AND** the target image element's src is unchanged
- **AND** no PATCH is issued

#### Scenario: Member sees no edit controls
- **WHEN** a non-admin user views a page with `data-editable-image` elements
- **THEN** the elements are not interactive and show no edit affordances
- **AND** the MediaPicker is never loaded
