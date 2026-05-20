## ADDED Requirements

### Requirement: BlockType registry declares editorType for each block

The `BlockType` interface in `src/lib/blocks.ts` SHALL include an `editorType: 'inline' | 'list' | 'custom'` field. Every block definition SHALL declare exactly one value:

- `'inline'`: flat config — text and image fields are edited directly on the rendered block via `data-editable*` attributes. Blocks: `hero`, `cta`, `stats`, `footer_address`, `footer_copyright`, `footer_attribution`, `tagline_strip`, `page_banner`, `brand_header`, `custom_html`, `shape_divider`.
- `'list'`: config contains a top-level array of items — the `BlockListEditor` Popover is the editing surface. Blocks: `features`, `testimonials`, `faq`, `footer_links`, `promo_cards`, `image_accordion`, `slideshow`, `footer_social`.
- `'custom'`: bespoke editing UI — `nav` (nav items editor), `embed` (provider picker + params form).

#### Scenario: Each block has an editorType declared
- **WHEN** any `BLOCK_TYPES` registry entry is read
- **THEN** `editorType` is one of `'inline'`, `'list'`, or `'custom'`

#### Scenario: features block has editorType list
- **WHEN** the `BLOCK_TYPES.features` registry entry is read
- **THEN** `editorType` is `'list'`

#### Scenario: hero block has editorType inline
- **WHEN** the `BLOCK_TYPES.hero` registry entry is read
- **THEN** `editorType` is `'inline'`

### Requirement: list-type blocks open a BlockListEditor Popover on edit

When an admin clicks the edit affordance on a block whose `editorType` is `'list'`, the system SHALL open a `Popover` (shadcn) anchored to the edit button. The Popover SHALL display the block's label, a `Badge` reading "GLOBAL" when `scope = 'global'`, and a vertically-stacked list of the current items.

#### Scenario: Edit affordance on a list block opens the Popover
- **WHEN** an admin clicks the edit affordance on a `features` block
- **THEN** a Popover opens anchored near the edit button
- **AND** the Popover title shows "Features"

#### Scenario: Global block shows a GLOBAL badge
- **WHEN** the block being edited has `scope = 'global'`
- **THEN** the Popover header shows a `Badge` reading "GLOBAL"

### Requirement: Popover list shows drag handles, edit, and delete controls per item

Each item row in the `BlockListEditor` Popover SHALL render: a `GripVertical` Lucide icon (drag handle, `draggable`), a truncated preview of the item's primary text field (title, label, or question), a `Pencil` icon `Button variant="ghost"` that reveals on row hover, and an `X` icon `Button variant="ghost"` with destructive styling that reveals on row hover.

#### Scenario: Item row shows label and controls on hover
- **WHEN** an admin hovers over an item row in the Popover
- **THEN** the Pencil and X buttons become visible

#### Scenario: X button removes the item from the list
- **WHEN** an admin clicks the X button on an item
- **THEN** the item is removed from the items array in local state
- **AND** the Popover list updates immediately

### Requirement: Clicking Pencil expands an inline detail form for that item

Clicking the Pencil button on an item row SHALL expand a detail form inline within the Popover (no navigation, no nested modal). The detail form SHALL render `Input`, `Textarea`, and `Label` components for each field in the item schema. Image fields SHALL render the `MediaPicker` trigger instead of a text input. A "Done" `Button` SHALL collapse the detail form back to the list view.

#### Scenario: Pencil expands inline detail form
- **WHEN** an admin clicks Pencil on a features item
- **THEN** the item row expands to show Input fields for `icon`, `title`, and `desc`
- **AND** the rest of the list remains visible below

#### Scenario: Done collapses back to list view
- **WHEN** an admin clicks "Done" in the expanded item form
- **THEN** the detail form collapses and the list is shown again
- **AND** the item row preview updates to reflect any changed values

#### Scenario: Image fields use the MediaPicker
- **WHEN** an item detail form has an image field (e.g. `image_url` in image_accordion)
- **THEN** clicking that field opens the MediaPicker Dialog instead of a plain text Input

### Requirement: Admin can add a new item with default values

The `BlockListEditor` Popover SHALL include a "+ Add item" `Button variant="outline"` at the bottom of the list. Clicking it SHALL append a new item to the local items array using the block type's `defaultConfig` item shape, and SHALL immediately expand the inline detail form for the new item.

#### Scenario: Add item appends a default item and opens its form
- **WHEN** an admin clicks "+ Add item"
- **THEN** a new item with default field values is appended to the list
- **AND** the inline detail form for the new item opens automatically

### Requirement: Items can be drag-reordered within the Popover

The drag handle (`GripVertical`) on each item row SHALL support HTML5 drag-and-drop (`dragstart`, `dragover`, `drop` events). Dragging an item SHALL show a visual insertion indicator between items. Dropping SHALL reorder the items array in local state.

#### Scenario: Drag-to-reorder changes item order
- **WHEN** an admin drags item 3 above item 1
- **THEN** the items array in local state is reordered accordingly
- **AND** the Popover list reflects the new order immediately

### Requirement: Save writes the full config in one PATCH

The `BlockListEditor` Popover SHALL include "Cancel" and "Save changes" `Button` components in its footer. Clicking "Save changes" SHALL issue a single `sections.updateConfig` PATCH with the full new `config` (including the updated items array). The Popover SHALL close on successful save and show a toast "Saved — appears on all pages" if the block is global, or "Saved" otherwise.

#### Scenario: Save issues one PATCH with the complete config
- **WHEN** an admin clicks "Save changes" after editing items
- **THEN** one `sections.updateConfig` request is issued with the full updated config
- **AND** no intermediate partial saves occur

#### Scenario: Cancel closes without saving
- **WHEN** an admin clicks "Cancel"
- **THEN** the Popover closes
- **AND** no PATCH is issued
- **AND** the block's config in the database is unchanged
