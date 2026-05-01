## Tasks

### Phase 1: `tagline_strip` (validates the pattern)

- [x] **1.1 Register `tagline_strip` in `BLOCK_TYPES`**
  In `src/lib/blocks.ts`, add the entry: `render` returns a `<section>` with `block-tagline-strip` class plus modifier classes for `color_scheme` and `size`; `defaultConfig` covers all four config keys with sensible defaults; `dynamic: false`; `zoneHints: ['main']`.

- [x] **1.2 CSS for tagline_strip**
  Append to `public/css/styles.css` (or new `blocks-tagline-strip.css`): full-bleed band with vertical padding per `--size`, color scheme via existing CSS custom-prop sets (`--color-bg-dark`, `--color-text-on-dark`, etc.). Verify dark mode inverts correctly.

- [x] **1.3 Demo seed update**
  Add a `tagline_strip` block to one demo (silver-pines's homepage between hero and announcements). Re-deploy. Visually verify rendering on real device.

- [x] **1.4 Unit test**
  `tests/blocks-tagline-strip.test.ts`: render returns expected HTML with each color_scheme; size affects padding class; icon renders inline; dark mode CSS applies.

### Phase 2: `page_banner` (validates per-page chrome scoping)

- [x] **2.1 Register `page_banner` in `BLOCK_TYPES`**
  Renderer emits a banner section with background image, optional overlay, optional sanitized caption HTML. `defaultConfig` includes empty `image_url`, default `height: 'medium'`. `zoneHints: ['header']`. `dynamic: false`.

- [x] **2.2 Caption sanitizer (shared with hero)**
  Reuse the caption HTML allowlist sanitizer from hero-foreground-mode (or extract to `src/lib/sanitize-html.ts` as shared). Allow only `<br>`, `<strong>`, `<em>`, `<a href>` with restricted href schemes.
  Implemented as `sanitizeCaptionHtml(...)` exported from `src/lib/blocks.ts`; the
  hero-foreground-mode pill can land alongside or migrate to it.

- [x] **2.3 CSS for page_banner**
  Banner heights: `small` (200px), `medium` (320px), `large` (480px), `auto` (intrinsic via `aspect-ratio: auto`). Background image with `cover center`. Optional overlay rendered as `:before` pseudo-element with `background-color: var(--overlay-color)`.

- [x] **2.4 Picker: page_banner is page-scoped by default**
  When admin adds a `page_banner` from a non-home page, the new section's `scope` is set to `'page'` (not `'global'`). Page slug pulled from current location.
  Also fixed a substrate bake bug: Portal.astro now bakes only `scope='global'`
  chrome blocks so a page-scoped banner does not leak into every page's static
  HTML — runtime hydrate paints it on its target page within the first frame.

- [x] **2.5 Demo seed update**
  Add a `page_banner` block to one custom page in eagles (`/page.html?slug=about` or similar). Banner image, caption with page heading. Re-deploy and verify the banner renders only on that page.

- [x] **2.6 Unit + integration tests**
  `tests/blocks-page-banner.test.ts`: render emits banner with background-image; caption sanitizer strips disallowed tags; height variants apply correct CSS. Integration test: page-scoped banner appears only on its page, not on others.

### Phase 3: `link_list` (validates dual-source)

- [x] **3.1 Register `link_list` in `BLOCK_TYPES`**
  Renderer dispatches on `config.source`. `'manual'` mode: render items inline from config. `'resources'` mode: emit hydration skeleton with `data-block-hydrate="link_list"` and embedded config. Three layout variants (`bullets`, `rows`, `compact`) render via class modifiers.

- [x] **3.2 Resources hydrator**
  `hydrateLinkListResources(el)`: parse config from `data-config`, fetch `resources?category=eq.{category}&order={order}.{direction}&limit={limit}`, render the response into the skeleton's place. Empty result → hide the section entirely (`el.style.display = 'none'`).

- [x] **3.3 Item rendering with badges and external links**
  `external: true` items render with `target="_blank" rel="noopener noreferrer"` and an external-link icon. `badge: 'PDF'|'NEW'|'MEMBERS'` renders an inline pill before the label. `date` renders before the label in `rows` and `compact` layouts only.

- [x] **3.4 CSS for link_list**
  Three layout variants. `bullets`: standard `<ul>` styling. `rows`: 2-column grid (date | label). `compact`: inline pills with separators.

- [x] **3.5 Demo seed update**
  Add a `link_list` (resources mode) to barrio-unido's homepage pulling from `category='Guías Legales'` (the demo's existing legal-guides resources). Verify auto-update behavior: upload a new resource, refresh the homepage, item appears.

- [x] **3.6 Unit + integration tests**
  Manual mode renders all configured items; resources mode emits skeleton; hydrator replaces skeleton with fetched items; empty resource result hides the section; external links emit correct attributes; badges render.

### Phase 4: `promo_cards` (validates image-heavy + admin upload)

- [x] **4.1 Register `promo_cards` in `BLOCK_TYPES`**
  Renderer emits CSS-Grid container with N children (one per item). Each child is `<a class="promo-card" href={cta_href} aria-label="{title}, {cta_text}">` containing background-image div, title band, CTA visual.

- [x] **4.2 CSS for promo_cards (responsive grid)**
  Grid uses `--cols` custom property from config. Mobile breakpoints: 4-col → 2-col @ 1024px → 1-col @ 640px. Card hover: subtle translateY + shadow. Title band positioned per `title_position` (top or bottom). Optional `overlay_color` rendered as semi-transparent layer over background image.

- [x] **4.3 Admin composer: image upload per card**
  Each card emits `data-editable-image="sections.{id}.config.items.{i}.image_url"` so the existing AdminEditor image-upload pipeline targets per-item images directly. The picker auto-includes the new type via `BLOCK_TYPES`. Add/remove and reorder of items happen through the existing JSONB editing flow. A dedicated promo_cards popover (drag-reorder UX) is a follow-up — current pattern is consistent with other multi-item blocks.

- [x] **4.4 Build-time `image_alt` warning**
  `scripts/generate-seed-sql.ts` now emits a stderr WARN line for any promo_cards item with empty `image_alt`, including the seed page slug, zone, position, and item index. Non-fatal; the build still succeeds.

- [x] **4.5 Demo seed update**
  silver-pines homepage gets a `promo_cards` block with 3 cards (Classes & Wellness, Events & Activities, Volunteer & Lead) using existing committee/event imagery.

- [x] **4.6 Unit + integration tests**
  Renderer emits correct grid structure; aria-label on each card includes title and cta_text; hover styles apply; image upload flow updates config; reorder persists.

### Phase 5: `events_list` (validates dynamic + multi-layout)

- [x] **5.1 Register `events_list` in `BLOCK_TYPES`**
  Renderer always emits a hydration skeleton (`dynamic: true`). Skeleton has `data-block-hydrate="events_list"` with config embedded. Skeleton renders the heading and `count` placeholder cards.

- [x] **5.2 Filter → query mapping**
  Implemented inside `block-hydrators.ts` (extracted-helper option deferred — current size is well below the splitting threshold). `upcoming` → `events?starts_at=gte.{now}&order=starts_at.asc&limit={count}`; `past` → `events?starts_at=lt.{now}&order=starts_at.desc&limit={count}`; `this_week` → between `now` and `now + 7d`. `featured` is omitted in v1 (no `is_featured` column).

- [x] **5.3 Three layout variants**
  Hydrator renders one of: `sidebar` (vertical card list), `grid` (responsive 3-up cards), `list` (compact rows). Variants share one `renderEventCard()` with layout-specific class modifiers.

- [x] **5.4 Local timezone formatting**
  Times render with `toLocaleString(undefined, { ... })` to use the visitor's locale and timezone. No server-side formatting.

- [x] **5.5 Empty + loading states**
  Loading: skeleton cards visible while fetch is in flight (CSS pulse animation). Empty: replace with `<p class="text-muted block-events-list__empty">No upcoming events.</p>`. Error: same as empty (silent fallback).

- [x] **5.6 Demo seed update**
  silver-pines homepage gets an `events_list` (sidebar layout) showing upcoming events. eagles homepage retains its existing chrome; a follow-up can add a grid-layout instance once additional events are seeded.

- [x] **5.7 Unit + integration tests**
  Each filter maps to expected PostgREST query; layouts render correct DOM structure; timezone formatting respects locale; empty state replaces skeleton; feature-flag-disabled hides the section.

### Phase 6: `slideshow` (validates runtime JS + a11y)

- [x] **6.1 Register `slideshow` in `BLOCK_TYPES`**
  `dynamic: true`. Renderer emits markup with first slide visible (`is-active` + `loading="eager"`); subsequent slides are inert `<figure>` elements with `loading="lazy"`. Hydration attaches the rotation logic.

- [x] **6.2 Vanilla JS slideshow controller (~4kB)**
  `src/lib/blocks/slideshow.ts` (3.1 kB minified per the build output): takes the slideshow element, sets up `setInterval` with `auto_rotate_seconds`. Pause/resume on hover, focus, visibility change. Arrow key handlers when `:focus-within`. Dot click handlers. Live region updates with caption on slide change.

- [x] **6.3 Reduced motion handling**
  At hydration: checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. If true: skips auto-rotate; CSS `@media (prefers-reduced-motion: reduce)` zeroes transitions.

- [x] **6.4 ARIA scaffolding**
  Slideshow container has `aria-roledescription="carousel"`, `aria-label={heading || 'Slideshow'}`. Each slide is `<figure role="group" aria-roledescription="slide" aria-label="N of M">`. Dots are `<button>` with `aria-label="Slide N of M"` and `aria-current="true"` for active. Live region `<div class="sr-only" aria-live="polite">` announces transitions.

- [x] **6.5 CSS for transitions**
  Two transition modes: `fade` (opacity), `slide` (transform translateX). Both use CSS transitions with reduced-motion override (`@media (prefers-reduced-motion: reduce) { transition: none; transform: none; }`).

- [x] **6.6 Cleanup on swap**
  Hydrator stores interval ID + cleanup hooks per-element in a WeakMap; listens for `astro:before-swap` and `wl-content-rendered` and clears intervals + observers on outgoing slideshows.

- [x] **6.7 Demo seed update**
  eagles homepage gets a `slideshow` block with 4 lifestyle / impact photos using existing event imagery (Habitat build, food drive, youth day, park cleanup).

- [x] **6.8 Unit + integration tests**
  Auto-rotate cycles slides; pause on hover stops rotation; arrow keys navigate; dots are clickable; reduced-motion skips auto; cleanup clears intervals; live region updates on slide change.

### Phase 7: ODBC port re-validation + docs

- [ ] **7.1 Re-run `/copy-website` against ODBC** *(BLOCKED — `/copy-website` skill not on this machine)*
  After all six block types land, re-run the skill against `https://www.olddominionboatclub.com`. Deploy result to `odbc-port.run402.com` (overwriting the previous port). User-driven; the skill is interactive and not a part of this implementation pass.

- [ ] **7.2 Visually verify ODBC layout faithfulness** *(BLOCKED on 7.1)*
  Chrome MCP walkthrough: home page shows 4-up `promo_cards` (Membership / Events / Store / Tap Room), `events_list` for upcoming events, `link_list` (News Updates) with curated PDF links, `tagline_strip` ("A Proud Part of Alexandria's History Since 1880"), `slideshow` (gallery photos). Interior pages (Marina, About) show `page_banner` with their banner images.

- [ ] **7.3 Compare against source** *(BLOCKED on 7.1)*
  Side-by-side comparison with the source site. Note any remaining gaps. Side-by-side rendering of two slideshows or events-sidebar-next-to-main is expected to be missing (covered by separate G_GRID issue).

- [x] **7.4 Update CUSTOMIZING.md (if present) or STRUCTURE.md**
  Document the six new block types: what each does, when to use it, the config schema, default values. One section per block type, ~10 lines each.

- [x] **7.5 Update CLAUDE.md block-type list**
  Add the six new types to whatever inventory exists (if any) in `CLAUDE.md`'s architecture section.
