## Tasks

### Phase 1: Schema and seed updates

- [x] **1.1 Add brand fields to seed types**
  In `src/seeds/types.ts`, extend the `SiteConfig` (or equivalent) shape with `brand_icon_url?: string`, `brand_wordmark_url?: string`, `brand_text: string` (required), `brand_text_short?: string`, `favicon_url?: string`. Remove `logo_url`.

- [x] **1.2 Update kychon-template seed**
  In `src/seeds/kychon.ts`, drop `logo_url`. Add `brand_text: 'Kychon'` (or whatever the default template name is). No `brand_icon_url` set by default — text-only is the safe template default.

- [x] **1.3 Update demo seeds**
  - `src/seeds/eagles.ts`: `brand_text: 'Eagles Boat Club'`. Migrate existing logo to `brand_icon_url` if square, else `brand_wordmark_url`.
  - `src/seeds/silver-pines.ts`: `brand_text: 'Silver Pines Community'`, `brand_text_short: 'Silver Pines'`. Same logo migration.
  - `src/seeds/barrio-unido.ts`: `brand_text: 'Barrio Unido'`, `brand_text_short: 'Barrio Unido'`. Same logo migration.

- [x] **1.4 Generator throws on `logo_url`**
  In `scripts/generate-seed-sql.ts`, add an assertion: if any seed module references `site_config.logo_url`, the generator exits non-zero with a message identifying the seed.

### Phase 2: Brand header renderer

- [x] **2.1 Update `BLOCK_TYPES.brand_header` renderer**
  In `src/lib/blocks.ts`, the `brand_header` renderer follows the picker rules:
  1. `brand_icon_url` set → icon + text (with optional `brand_text_short` for narrow viewports)
  2. `brand_wordmark_url` set → wordmark alone
  3. Otherwise → text alone
  Each branch produces a single `<a href="/">` element.

- [x] **2.2 CSS for three brand modes**
  In `public/css/styles.css`: `.brand-header--icon` lays out icon + text in a row; `.brand-header--wordmark` shows the wordmark image at a constrained max-height; `.brand-header--text` is text-only. Add `.brand-text--full` and `.brand-text--short` toggle via media query at 480px or similar.

- [x] **2.3 Remove dead nav-brand code**
  Search `src/` for references to `site_config.logo_url`. Remove or update each. The old `Nav.astro`'s nav-brand block (deleted by composable-layout) is gone; verify no residual references.

### Phase 3: Favicon fallback chain

- [x] **3.1 `Portal.astro` favicon resolution**
  In the frontmatter, compute `const faviconUrl = siteConfig.favicon_url || siteConfig.brand_icon_url || '/favicon.svg';`. Render `<link rel="icon" type={inferType(faviconUrl)} href={faviconUrl}>` where `inferType` returns `'image/svg+xml'` for `.svg` files and `data:image/svg+xml` URLs, otherwise omits the type attribute.

- [x] **3.2 Verify CSP allows `data:` URLs**
  Confirm the embed-block CSP baseline includes `img-src ... data:`. If embed-block hasn't landed yet, add the `data:` permission to whatever existing CSP-related code paths handle favicon (likely none today).
  *Verified: `public/_headers` (shipped by embed-block) emits `img-src 'self' https: data:`, so inline `data:image/svg+xml` favicons load with no CSP violation.*

- [x] **3.3 Engine default favicon**
  Ensure `public/favicon.svg` exists and is the kychon engine's default brand mark. If not present today, ship a minimal SVG (the kychon "K" mark or similar).
  *Already shipped at `public/favicon.svg` (purple rounded-square + white circle).*

### Phase 4: Admin UX

- [x] **4.1 Surface brand fields in admin settings**
  The admin settings page (or wherever site_config edits live post-composable-layout) renders three picker inputs: `brand_icon_url` (asset picker, preview as ≤80px square), `brand_wordmark_url` (asset picker, preview at intrinsic aspect), `brand_text` (text input, required), `brand_text_short` (text input, optional). Plus `favicon_url` separately.

- [x] **4.2 Aspect-ratio hint in upload-asset**
  Update `functions/upload-asset.js` to read intrinsic dimensions of uploaded images. Return `{ url, warning: 'looks_like_wordmark' }` when `width > 1.5 * height` and the upload target is `brand_icon_url`.

- [x] **4.3 Asset picker shows the hint**
  In `AdminEditor`'s asset picker UI, when a `looks_like_wordmark` warning comes back: show an inline tooltip "This image looks like a wordmark. Save to `brand_wordmark_url` instead?" with one-click reroute. Tooltip dismissible.
  *Implementation note: AdminEditor currently uploads directly to Run402 storage (bypassing the edge function), so the hint runs client-side via `URL.createObjectURL` + `Image.naturalWidth/Height`. The same heuristic lives in `functions/upload-asset.js` for any future caller that routes through the function. Both paths use the same 1.5× threshold.*

### Phase 5: Documentation

- [x] **5.1 Create or update `CUSTOMIZING.md`**
  Add a "Branding" section documenting the three fields + picker rules + favicon fallback chain. Include short SVG diagrams (or ASCII) showing the three render modes.

- [x] **5.2 Update `STRUCTURE.md` (if present)**
  Note the brand fields under the `site_config` schema description.

### Phase 6: Demo verification

- [x] **6.1 Re-deploy each demo with new brand seeds**
  Verified on each deployed demo: header renders the correct mode (icon+text / wordmark / text-only), favicon resolves through the fallback chain, `brand_text_short` swaps in at narrow viewports.

- [ ] **6.2 ODBC port re-validation** *(BLOCKED — `/copy-website` skill not on this machine)*
  After re-running `/copy-website` against ODBC, verify the resulting site uses `brand_icon_url` (the ship's-wheel) + `brand_text` (the org name) rather than the foundation banner stuffed into a single field. Header is no longer distorted.

- [x] **6.3 Generic-iframe inline-data favicon test**
  Verified end-to-end with the brand identity check: SVG upload via admin UI renders as favicon; `data:image/svg+xml,…` URLs saved directly via admin settings also render. Both flows work.
