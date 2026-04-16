## Tasks

### Phase 1: Fix what's broken + foundation

- [x] **1.1 Fix admin-settings save bugs**
  Fix double-encode on theme save (patchConfig stringifies already-string values). Change logo_url/favicon_url inputs to plain text. Style `type="color"` inputs as 48px circle swatches. Add save feedback toast. Add missing toggles: signup_mode (select), default_language (select), directory_public (toggle), polls_member_create (toggle).

- [x] **1.2 Create upload-asset edge function**
  New `functions/upload-asset.js`. Accepts `{ file: { name, type, data (base64) }, path }` for upload and `{ action: "delete", path }` for delete. Auth-gated via `getUser(req)`. Uploads to Run402 storage `assets` bucket. Returns `{ url }`. Deploy to all 3 demos.

- [x] **1.3 Create admin-editing.css**
  New `public/css/admin-editing.css` with all admin editing visual styles. Loaded conditionally (AdminEditor adds `<link>` when admin detected). Includes: hover outlines (blue glow), active editing states (solid blue), image upload overlay (dimmed + camera icon + progress ring), drag feedback (opacity + blue insertion line + scale), floating rich-text toolbar, popover panels (backdrop-filter blur), save pulse (green border flash), error shake, keyboard focus rings. All animations use `200ms ease` transitions.

- [x] **1.4 Extend AdminEditor for JSONB paths**
  Update `data-editable` parsing to support 4-part format: `table.id.column.jsonpath`. When detected, read full column value from `data-editable-config` attribute on the element, modify the key at jsonpath, PATCH the full column. Same for `data-editable-rich` and `data-editable-image`. Update `data-editable-image` to use upload-asset function (base64 JSON) instead of direct FormData storage upload.

- [x] **1.5 Fix AdminEditor re-binding after client-side renders**
  AdminEditor binds on DOMContentLoaded and `astro:after-swap`, but pages rebuild DOM via JS template literals (e.g., `renderSection()`, `renderCommitteeDetail()`). After any render function that rebuilds content, dispatch a `wl-content-rendered` event. AdminEditor listens and re-binds. Alternatively, use MutationObserver on the main content container.

### Phase 2: Wire inline editing to all pages

- [ ] **2.1 index.astro — homepage sections**
  Add `data-editable` / `data-editable-rich` / `data-editable-image` + `data-editable-config` attributes to all section types: hero (heading, subheading, bg_image, cta_text, cta_href), stats (each item's value + label), features (each card's title + description + icon), cta (heading, description, button text), testimonials (each quote + author), faq (each question + answer). Wrap each section in a div with `data-sortable-*` attributes for reorder.

- [ ] **2.2 event.astro — event detail**
  Add inline editing to: title (`data-editable`), description (`data-editable-rich`), location (`data-editable`), image_url (`data-editable-image`). These are flat columns on the `events` table — simple `table.id.field` format.

- [ ] **2.3 committees.astro — committee detail**
  Add inline editing to: name (`data-editable`), description (`data-editable-rich`), image_url (`data-editable-image`). Flat columns on `committees` table.

- [ ] **2.4 page.astro — custom pages**
  Add inline editing to: page title (`data-editable` on `pages.{id}.title`), page content (`data-editable-rich` on `pages.{id}.content`), section content within custom pages.

- [ ] **2.5 Portal.astro — logo and site name**
  Add `data-editable-image` to logo (uploads via upload-asset, updates `site_config.logo_url`). Add `data-editable` to site name text (updates `site_config` where `key=site_name`). Site config uses a different PATCH pattern: `PATCH site_config?key=eq.site_name { value: "new name" }`. Handle this in AdminEditor.

### Phase 3: Drag-to-reorder

- [ ] **3.1 Implement sortable engine in AdminEditor**
  New `initSortable()` function. Finds all `[data-sortable-group]` containers. For each child with `data-sortable-id`, adds a drag handle (grip dots icon, appears on hover), `draggable="true"` attribute. Handles `dragstart`, `dragover`, `drop` events. Shows blue insertion line between items during drag. On drop, calculates new positions, PATCHes each affected row's position field. Smooth CSS transitions for reorder animation.

- [ ] **3.2 Wire homepage section reorder**
  Wrap each section on index.astro in a sortable container. `data-sortable-group="homepage-sections"`, `data-sortable-id="sections.{id}"`, `data-sortable-field="position"`. Admin can drag sections to reorder. Save updates `sections.position` for affected rows. Page re-renders in new order.

- [ ] **3.3 Wire nav item reorder (within nav editor, see phase 4)**
  Nav reorder is part of the nav editor overlay — drag handles on nav item rows. Save writes the entire reordered nav array to `site_config.nav`.

### Phase 4: Structural CRUD

- [ ] **4.1 Nav editor overlay**
  New editing mode triggered by pencil icon on nav bar (visible to admins on hover). Slides down a panel below the nav showing all nav items as rows. Each row: drag handle, icon select, label (text input), URL (text input), visibility (public/auth/admin radio), remove button. "Add item" button at bottom. Save button writes the full nav array to `site_config` key `nav`. Cancel discards changes. Panel has backdrop blur and smooth slide animation.

- [ ] **4.2 Membership tier editor**
  Inline popover attached to tier cards (wherever tiers are displayed — join page, admin-settings tiers section, or a new tiers section type on the homepage). Click a tier card → popover with: name (text), price label (text), description (textarea), benefits (editable list — each item removable, add button), is_default (toggle), position (drag handle). "Add Tier" card at end. "Delete" with confirmation.

- [ ] **4.3 Custom fields editor**
  Inline popover on the profile page or directory page (where custom fields appear). Admin clicks a custom field → popover with: field label (text), field name (auto-generated slug), field type (select: text/textarea/select/checkbox), options (for select type — editable list), required (toggle), visible in directory (toggle), position (drag). "Add Field" button. "Delete" with confirmation.

- [ ] **4.4 Homepage section add/remove**
  "Add Section" button at the bottom of the homepage (admin-only). Opens a section type picker: hero, stats, features, cta, testimonials, faq, announcements, custom HTML. Inserts a new section row with default config for that type. Each section also gets a "Remove section" button (top-left, visible on hover). Confirm before delete.

### Phase 5: Asset management integration

- [ ] **5.1 Asset picker component**
  Reusable `AssetPicker` pattern in AdminEditor. When `data-editable-image` is clicked: show overlay with current image thumbnail (if set), "Upload New" button, "Remove" button (if set). Upload calls upload-asset function, returns URL, updates DB field + DOM. Remove calls upload-asset delete, clears DB field + DOM. Shows upload progress ring during upload.

- [ ] **5.2 Wire asset picker to branding**
  Logo in nav: `data-editable-image="site_config.logo_url.value"` (special site_config pattern). Favicon: accessible from settings page only (not visible inline). Hero images: `data-editable-image` with JSONB path `sections.{id}.config.bg_image`. Event images: `data-editable-image="events.{id}.image_url"`. Committee images: `data-editable-image="committees.{id}.image_url"`.

- [ ] **5.3 Migrate demo seeds to use storage URLs**
  Update bootstrap-demo.sh to upload demo assets (logo, hero, avatars) to Run402 storage during bootstrap. Update seed SQL to reference storage URLs instead of `/assets/` paths. Deploy-time baked assets become fallbacks; runtime uploads override them.

### Phase 6: Deploy and verify

- [ ] **6.1 Deploy to all 3 demo sites**
  Build, deploy, bootstrap all 3 demos. Verify: inline text editing, rich text editing, image upload, section reorder, nav editor, tier editor, custom field editor, settings page saves, asset upload/delete.

- [ ] **6.2 Visual verification via Chrome MCP**
  Walk through each editing interaction on silver-pines as admin: edit hero heading, upload new hero image, reorder sections, edit nav, create/edit a tier, upload new logo. Verify save feedback, transitions, and keyboard shortcuts.
