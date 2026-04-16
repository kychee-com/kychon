## Why

Kychon's founding principle: **the page IS the admin.** Admins don't go to a separate dashboard to edit content — they edit the actual website they're looking at. The infrastructure exists (`AdminEditor.astro` with three editing modes) but it's wired to exactly 2 elements (announcement title + body). Everything else — hero images, nav items, page sections, membership tiers, logos — requires SQL or redeployment to change.

The admin-settings page is also broken (can't save branding because logo_url is validated as a URL, theme saves double-encode, color pickers are unstyled), and missing core config knobs (signup mode, language, directory visibility).

An admin should be able to rebrand, restructure, and restyle their portal entirely through the browser — no code, no deploy, no SQL. The editing experience should feel like a modern site builder: beautiful hover states, smooth drag-to-reorder, inline popovers for structured data, click-to-upload for any image.

## What Changes

### 1. Fix admin-settings (minimal settings page)

Strip settings to what doesn't live on a page: site name, tagline, description, feature toggles, theme colors, signup mode, default language, directory visibility, polls permissions. Fix save bugs (double-encode, URL validation). Style color pickers as proper swatches.

### 2. Runtime asset management

Replace deploy-baked images with admin-uploadable assets via Run402 storage. New `upload-asset` edge function handles upload/delete to an `assets` bucket. Reusable asset picker component: thumbnail preview + upload/remove buttons. Used for logo, favicon, hero images, event covers, committee images, member avatars.

### 3. Wire inline editing across all pages

Add `data-editable`, `data-editable-rich`, and `data-editable-image` attributes everywhere content is rendered from the database. Admin hovers, sees the edit affordance, clicks, edits in place, blurs to save. Homepage hero text, stats, section content, event details, committee descriptions, page content, tier cards on join page.

### 4. Drag-to-reorder

New editing mode for ordered collections: homepage sections, nav items. Smooth drag handles with visual insertion markers. Saves new `position` values on drop. Uses HTML5 drag-and-drop with polished CSS transitions — no library, but beautiful.

### 5. Structural CRUD (add/remove/edit)

Inline popovers for managing structured data where it appears on the page:
- **Nav items**: hover nav bar as admin to get an "Edit navigation" overlay — add item, remove item, rename, change URL, drag to reorder.
- **Membership tiers**: click a tier card on the join page to edit name/price/benefits, add new tier, remove tier.
- **Custom fields**: manage member profile fields from the profile/directory page.
- **Homepage sections**: add/remove section types, configure section content.

### 6. Admin editing UX

The editing experience should feel premium:
- Smooth transitions on all interactive states (hover, active, saving)
- Blue glow outline on editable elements when admin hovers
- Floating toolbar for rich text (bold, italic, link) — not a full editor chrome
- Drag handles that appear on hover with "grip" dots
- Toast confirmation on save ("Saved" with checkmark, auto-dismisses)
- Skeleton pulse while saving
- Upload progress indicator for images
- Popover panels with backdrop blur for structural editing
- Keyboard shortcuts: Escape to cancel, Enter to save (text), Cmd+S to save (rich text)

## Capabilities

### New Capabilities
- `asset-management`: Upload, delete, and serve site assets (logo, favicon, hero images, etc.) via Run402 storage, with reusable asset picker UI
- `drag-reorder`: Drag-to-reorder editing mode for sections and nav items with smooth visual feedback
- `inline-crud`: Popover-based add/remove/edit for nav items, membership tiers, custom fields, and homepage sections
- `admin-editing-ux`: Polished editing experience — hover states, transitions, floating toolbar, save toasts, upload progress

### Modified Capabilities
- `admin-editor`: Wire existing data-editable attributes across all pages (index, events, committees, resources, directory, join, page)
- `admin-settings`: Fix save bugs, strip to minimal config, add missing toggles (signup mode, language, directory visibility)
- `inline-editing`: Fix FormData bug in image upload (same base64 JSON pattern as upload-resource)

## Impact

- **New files**: `functions/upload-asset.js`, `src/components/AssetPicker.astro`, `src/components/NavEditor.astro`, `src/components/SectionEditor.astro`, `src/components/TierEditor.astro`, `public/css/admin-editing.css`
- **Modified files**: Every `.astro` page (add data-editable attributes), `AdminEditor.astro` (add drag + CRUD modes, fix FormData, add UX polish), `admin-settings.astro` (fix saves, slim down), `Portal.astro` (admin editing CSS), `upload-asset.js` is new edge function
- **Dependencies**: None new — HTML5 drag-and-drop, existing Tiptap lazy-load, Run402 storage API
- **RLS**: No changes — `public_read` template already allows authenticated writes
- **Bundle impact**: ~15kB admin-editing.css (loaded only for admins). Drag + CRUD JS estimated ~4kB additional in AdminEditor.
