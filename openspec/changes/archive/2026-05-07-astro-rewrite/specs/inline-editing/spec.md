## MODIFIED Requirements

### Requirement: Admin-only inline editing via Astro island
The inline editing system SHALL be packaged as an `AdminEditor.astro` component loaded with `client:idle`. The component SHALL only be included in the layout when the user has the admin role.

The three editing modes are preserved:
- Simple text: `contenteditable` on elements with `data-editable="{table}.{id}.{field}"`
- Rich text: Tiptap on elements with `data-editable-rich="{table}.{id}.{field}"`
- Image: file upload on elements with `data-editable-image="{storage_path}"`

#### Scenario: Admin sees edit controls
- **WHEN** an admin user loads any portal page
- **THEN** the AdminEditor island hydrates after the page is idle
- **AND** elements with `data-editable` attributes become editable on hover/click

#### Scenario: Non-admin loads page without editor
- **WHEN** a non-admin user loads any portal page
- **THEN** the AdminEditor component is not rendered in the HTML
- **AND** no editor JavaScript is downloaded

### Requirement: Tiptap loaded as bundled dependency
Tiptap SHALL be installed as an npm dependency and bundled by Vite into the AdminEditor island, instead of loaded from esm.sh CDN at runtime.

#### Scenario: Tiptap available in admin island
- **WHEN** an admin clicks a `data-editable-rich` element
- **THEN** Tiptap initializes from the bundled JS (no external CDN request)
- **AND** the rich text toolbar appears
