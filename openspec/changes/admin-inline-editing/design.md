## Context

Kychon's admin experience is "the page IS the admin" — admins see the same pages as members but with edit overlays. `AdminEditor.astro` already implements three editing modes (text, rich text, image upload), but only 2 elements use them. All other content — homepage sections, nav, tiers, events, committees, pages — requires SQL or redeploy to change.

Key constraints:
- Astro SSG with `build.format: 'file'` — all pages are static HTML with client-side hydration
- All page content is rendered via JS template literals in `<script>` blocks, not Astro templates
- Section content lives in `config JSONB` column — PostgREST PATCH **replaces** the entire JSONB value (does not merge). Editing a single key requires read-modify-write.
- Nav items are a JSON array inside `site_config.nav` — same JSONB replacement constraint
- Run402 storage has upload/download/list/delete with bucket support
- AdminEditor re-inits on `astro:after-swap` but must also re-bind after client-side re-renders that replace DOM nodes

## Goals / Non-Goals

**Goals:**
- Admin can edit any text, image, or structured content inline on the actual page
- Drag-to-reorder for homepage sections and nav items
- Add/remove/edit for nav items, membership tiers, custom fields, sections
- Runtime asset upload/delete via Run402 storage (logo, favicon, hero, event images)
- Premium editing UX: smooth transitions, clear affordances, save feedback
- Settings page becomes minimal: only non-page config (feature flags, theme, signup mode, language)

**Non-Goals:**
- Undo/redo history (save is immediate, hourly reset is the safety net for demos)
- Multi-admin conflict resolution (last write wins)
- Page creation wizard (admin can create pages via the pages table, but no guided flow)
- Mobile admin editing (admin features are desktop-only for now)
- A/B testing or draft/publish workflow

## Decisions

### 1. Read-modify-write for JSONB columns

**Decision**: When editing a field inside a `config JSONB` column (e.g., section hero heading), the client reads the full config object from the already-fetched data, modifies the specific key, and PATCHes the complete config back.

**Why**: PostgREST PATCH replaces JSONB columns entirely (`{ config: { heading: "new" } }` wipes all other keys). An edge function with `jsonb_set()` would avoid this but adds a network hop and a new function for something the client can handle. The data is already in memory from rendering.

**Pattern**:
```
data-editable-json="sections.{id}.config.heading"
                     ─────── ─── ────── ───────
                     table    id  column  json_path
```

AdminEditor detects the 4-part attribute, reads the current full column value from a `data-config` attribute on the element (JSON-encoded), modifies the key at `json_path`, PATCHes `{ config: updated_object }`.

### 2. Attribute format extension

**Decision**: Extend the `data-editable` attribute format to support JSONB paths and add new attributes for drag and structural editing:

| Attribute | Format | Example |
|-----------|--------|---------|
| `data-editable` | `table.id.field` | `announcements.42.title` |
| `data-editable` | `table.id.column.jsonpath` | `sections.523.config.heading` |
| `data-editable-rich` | same as above | `sections.523.config.body` |
| `data-editable-image` | `table.id.column.jsonpath` | `sections.523.config.bg_image` |
| `data-editable-config` | JSON blob | `{"sections.523.config": {...full config...}}` |
| `data-sortable-group` | group name | `homepage-sections` |
| `data-sortable-id` | `table.id` | `sections.523` |
| `data-sortable-field` | field name | `position` |

For image upload, the new format tells AdminEditor which table/field to update with the storage URL (vs the current format which is just a raw storage path).

### 3. Asset management via upload-asset function

**Decision**: New `upload-asset` edge function handles image upload/delete to a dedicated `assets` bucket. Returns the public storage URL. Client updates the relevant DB field with the returned URL.

**Flow**:
```
Click image → file picker → base64 encode →
POST /functions/v1/upload-asset { file: {name,type,data}, path: "logo.png" }
→ function uploads to Run402 storage `assets/logo.png`
→ returns { url: "https://...storage.../assets/logo.png" }
→ client PATCHes site_config or sections with new URL
→ image updates in place
```

**Delete**: Same function with `{ action: "delete", path: "logo.png" }`. Client clears the DB field.

**Why a function instead of direct storage API**: Storage write requires a service key. The edge function authenticates the admin (via JWT), then uses the service key server-side. Same pattern as upload-resource.

### 4. Nav editor as overlay panel

**Decision**: When admin clicks a "pencil" icon that appears on hover over the nav bar, a full-width overlay panel slides down below the nav. Shows all nav items as draggable rows with: icon, label (editable), URL (editable), visibility toggles (public/auth/admin), drag handle. Add/remove buttons. Save writes the entire nav JSON array to `site_config.nav`.

**Why overlay, not inline**: Nav items are too compact to edit in place. An inline popover per item would be tedious for reordering. A panel gives space for the full list + drag handles + all properties.

### 5. Section reorder with drag zones

**Decision**: On the homepage, when admin hovers over a section, a drag handle (grip dots) appears at the top-right. Dragging a section shows a blue insertion line between sections. Drop reorders by PATCHing `position` on affected sections.

**Implementation**: HTML5 `dragstart`/`dragover`/`drop` events. Each section wrapper gets `draggable="true"` and `data-sortable-*` attributes. CSS transitions on `transform` for smooth visual reorder. No library.

### 6. Tier and field editing via inline popovers

**Decision**: On pages where tiers are displayed (future pricing/join page), clicking a tier card as admin opens an inline popover attached to that card. Fields: name (text), price label (text), benefits (editable list), is_default (toggle). "Add Tier" button at the end of the tier list. Same pattern for custom fields on the profile page.

**Why popovers, not modals**: Popovers keep context — admin sees the card they're editing right behind the editor. Modals disconnect the editing from the content. Popovers use `backdrop-filter: blur(4px)` for focus.

### 7. Editing UX system

**Decision**: A cohesive set of visual patterns for all editing interactions:

**Hover states**: Editable elements get a subtle blue outline (`box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3)`) on hover when admin. Images additionally show an upload icon overlay.

**Active editing**: Blue outline becomes solid (`rgba(59, 130, 246, 0.6)`). Rich text shows a floating mini-toolbar above the element (bold, italic, link, heading toggles).

**Save feedback**: On successful save, brief green checkmark pulse on the element border. On error, red shake animation + toast.

**Drag feedback**: Dragged element gets `opacity: 0.5` + `scale(0.98)`. Drop zone shows a 3px blue line. Smooth `200ms ease` transitions on reorder.

**Upload feedback**: Image dims to 50% opacity during upload. Circular progress ring overlaid. On completion, the image fades to full opacity with the new source.

**Keyboard**: `Escape` cancels edit (restores original), `Enter` saves (single-line text), `Cmd+S` saves (rich text). `Tab` moves to next editable element.

All admin editing CSS is in a separate `admin-editing.css` file, loaded only when `body.admin` class is present.

### 8. Minimal settings page

**Decision**: Admin-settings retains only config that doesn't live on a specific page:

| Setting | Type | Config key |
|---------|------|------------|
| Site name | text | `site_name` |
| Tagline | text | `site_tagline` |
| Description | textarea | `site_description` |
| Theme colors | color swatches | `theme.primary`, etc. |
| Feature toggles | switches | `feature_*` |
| Signup mode | select | `signup_mode` |
| Default language | select | `default_language` |
| Available languages | multi-select | `languages` |
| Directory public | toggle | `directory_public` |
| Polls member create | toggle | `polls_member_create` |

Logo, favicon, hero images, and nav structure are edited inline on the pages where they appear.

**Save fixes**: Remove double-encode on theme save. Change branding fields to text inputs. Style color inputs as clickable swatches (48x48px circles with the current color, native picker on click). Add save feedback toast.

## Architecture

```
ADMIN EDITING LAYERS
════════════════════════════════════════════════════════

  Portal.astro
  └─ AdminEditor.astro (client:idle)
     ├─ initEditableText()     ← data-editable
     ├─ initEditableRich()     ← data-editable-rich  (lazy Tiptap)
     ├─ initEditableImage()    ← data-editable-image (upload-asset)
     ├─ initSortable()         ← data-sortable-*     (NEW: drag reorder)
     ├─ initNavEditor()        ← nav pencil icon      (NEW: overlay panel)
     └─ initPopovers()         ← data-editable-crud   (NEW: tier/field CRUD)

  Each page adds attributes to its rendered content:
  ┌──────────────────────────────────────────────────┐
  │  index.astro                                     │
  │  ├─ Hero heading    data-editable                │
  │  ├─ Hero subtitle   data-editable                │
  │  ├─ Hero bg image   data-editable-image          │
  │  ├─ Stats values    data-editable                │
  │  ├─ Announcements   data-editable (existing)     │
  │  └─ Sections        data-sortable-*              │
  ├──────────────────────────────────────────────────┤
  │  committees.astro                                │
  │  ├─ Name            data-editable                │
  │  ├─ Description     data-editable-rich           │
  │  └─ Image           data-editable-image          │
  ├──────────────────────────────────────────────────┤
  │  event.astro                                     │
  │  ├─ Title           data-editable                │
  │  ├─ Description     data-editable-rich           │
  │  ├─ Location        data-editable                │
  │  └─ Image           data-editable-image          │
  ├──────────────────────────────────────────────────┤
  │  page.astro                                      │
  │  ├─ Title           data-editable                │
  │  └─ Content         data-editable-rich           │
  └──────────────────────────────────────────────────┘

  admin-editing.css (loaded for admins only)
  ├─ Hover outlines
  ├─ Active editing states
  ├─ Drag feedback (opacity, insertion line)
  ├─ Upload progress overlay
  ├─ Floating toolbar
  ├─ Popover panels
  └─ Save/error animations

  upload-asset function
  ├─ POST { file, path }  → upload to Run402 storage
  ├─ POST { action: "delete", path } → delete from storage
  └─ Returns { url } for client to write to DB
```

## JSONB Editing Data Flow

```
Admin clicks hero heading
         │
         ▼
AdminEditor reads:
  data-editable="sections.523.config.heading"
  data-editable-config='{"heading":"Welcome...","bg_image":"/assets/...",...}'
         │
         ▼
contentEditable = true, admin edits text
         │
         ▼
On blur:
  1. Parse data-editable → table=sections, id=523, column=config, path=heading
  2. Parse data-editable-config → full config object
  3. config.heading = newText
  4. PATCH sections?id=eq.523  { config: updated_full_config }
  5. Update data-editable-config attribute with new state
```
