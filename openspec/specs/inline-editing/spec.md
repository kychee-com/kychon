## Purpose

Kychon's admin inline editing lets admins edit text, rich text, images, and related admin-only editor code directly on rendered pages while keeping editing affordances hidden from members.

## Requirements

### Requirement: Simple text editing via contenteditable

Elements with `data-editable="{table}.{id}.{field}"` SHALL become editable when an admin clicks them. On blur, the edited text SHALL be saved via PATCH to the corresponding REST endpoint.

#### Scenario: Admin edits a title
- **WHEN** an admin clicks on an element with `data-editable="announcements.5.title"`
- **THEN** the element becomes `contenteditable="true"` with a subtle highlight
- **WHEN** the admin types new text and clicks away (blur)
- **THEN** a PATCH request updates `announcements` row 5, field `title`

#### Scenario: Member sees no edit controls
- **WHEN** a non-admin user views a page with `data-editable` elements
- **THEN** the elements are not interactive and show no edit affordances

### Requirement: Rich text editing via Tiptap

Elements with `data-editable-rich="{table}.{id}.{field}"` SHALL initialize a Tiptap editor on admin click. The Tiptap bundle SHALL be lazy-loaded from esm.sh only when first needed. A floating toolbar SHALL appear on text selection with formatting options (bold, italic, heading, link, list).

#### Scenario: Admin edits rich text
- **WHEN** an admin clicks on a `data-editable-rich` element for the first time
- **THEN** Tiptap is dynamically imported from esm.sh
- **THEN** the element becomes a Tiptap editor instance
- **WHEN** the admin selects text
- **THEN** a floating toolbar appears with formatting options

#### Scenario: Tiptap not loaded for members
- **WHEN** a non-admin user loads any page
- **THEN** no external Tiptap editor bundle is loaded

### Requirement: Image editing via click-to-upload

Elements with `data-editable-image="{storage_path}"` SHALL show a camera/upload overlay on admin hover. Clicking SHALL open a file picker, upload the selected file to Run402 storage at the specified path, and update the `src` attribute.

#### Scenario: Admin uploads new image
- **WHEN** an admin clicks an `data-editable-image` element
- **THEN** a file picker opens
- **WHEN** the admin selects an image file
- **THEN** the file is uploaded to Run402 storage
- **THEN** the image `src` is updated to the new URL

### Requirement: AdminEditor Astro island initializes only for admins

The inline editing system SHALL be packaged as an `AdminEditor.astro` component. It SHALL initialize editor behavior only when the current user's role is `admin`. It SHALL scan the page for `data-editable`, `data-editable-rich`, and `data-editable-image` attributes and attach the appropriate handlers after admin status is confirmed.

#### Scenario: Admin page load enables editor behavior
- **WHEN** an admin loads any page
- **THEN** the AdminEditor island initializes
- **THEN** all editable elements gain hover highlights and click handlers

#### Scenario: Member page load leaves editor inactive
- **WHEN** a non-admin loads the same page
- **THEN** editor behavior does not initialize
- **THEN** edit affordances, admin CSS, and Tiptap loading remain inactive
