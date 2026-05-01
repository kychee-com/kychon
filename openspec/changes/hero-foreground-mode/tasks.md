## Tasks

### Phase 1: Renderer + CSS

- [x] **1.1 Extend hero config type with foreground keys**
  In `src/lib/blocks.ts`, extend the `HeroConfig` type with optional fields: `mode?: 'background' | 'foreground'`, `image_url?: string`, `image_alt?: string`, `image_aspect?: 'auto' | '16/9' | '4/3' | '21/9'`, `logo_overlay_url?: string`, `logo_position?: 'left' | 'center' | 'right'`, `logo_max_height?: string`, `caption_html?: string`, `caption_position?: CaptionPosition`, `text_position?: 'over_image' | 'below_image'`. Existing fields (`heading`, `subheading`, `cta_text`, `cta_href`, `bg_image`) unchanged.

- [x] **1.2 Split `BLOCK_TYPES.hero.render` into background and foreground branches**
  Add a `mode` check at the top: dispatch to `renderBackgroundHero(section, ctx)` (existing logic, unchanged) or `renderForegroundHero(section, ctx)` (new). Default to background when `mode` is undefined.

- [x] **1.3 Implement `renderForegroundHero`**
  Emit:
  ```html
  <section class="section section-hero hero-foreground" data-text-position={text_position}>
    <picture class="hero-picture" data-aspect={image_aspect}>
      <img src={image_url} alt={image_alt ?? ''} loading="eager" decoding="async" />
    </picture>
    {logo_overlay_url ? logoMarkup : ''}
    {caption_html ? captionMarkup : ''}
    {text_position === 'over_image' ? overlayedHeadingMarkup : belowHeadingMarkup}
  </section>
  ```
  Helpers `logoMarkup`, `captionMarkup`, `overlayedHeadingMarkup`, `belowHeadingMarkup` are small inline functions in `blocks.ts`.

- [x] **1.4 Caption HTML sanitizer**
  Helper `sanitizeCaptionHtml(html: string): string` that strips all tags except `<br>`, `<strong>`, `<em>`, `<a>`; strips all attributes except `href` on `<a>`; restricts `href` to `http(s):`, `mailto:`, and relative paths. Return safe HTML. Test with malicious fixtures: `<script>alert(1)</script>`, `<a href="javascript:alert(1)">x</a>`, `<img onerror="alert(1)" src=x>`. Also rejects scheme-relative `//host`, drops `<script>`/`<style>`/`<iframe>` contents (not just tags), and is case-insensitive on tag names.

- [x] **1.5 CSS for foreground layout**
  Appended to `public/css/styles.css`: `.hero-foreground` positioning context, `.hero-picture[data-aspect]` aspect ratio rules, `.hero-picture > img` width/height/object-fit, `.hero-logo-overlay[data-position]` positioning rules (left/center/right), `.hero-caption[data-position]` positioning rules (8 variants), `.hero-foreground[data-text-position="over_image"] .hero-text` absolute positioning + text-shadow, `.hero-foreground[data-text-position="below_image"] .hero-text` normal flow.

- [x] **1.6 `aspect-ratio` fallback for older browsers**
  Added `@supports not (aspect-ratio: 16 / 9) { ... }` block using the padding-bottom ratio trick on `.hero-picture[data-aspect="16/9" | "4/3" | "21/9"]`.

### Phase 2: `cacheHeroImage` and image preloading

- [x] **2.1 Extend `cacheHeroImage` and `preloadHeroImage`**
  In `src/lib/config.ts`, added `getHeroImageUrl(section)` helper that returns `image_url` for foreground mode and `bg_image` for background. `cacheHeroImage` now accepts either a URL string (legacy) or a hero section. `src/lib/page-render.ts` calls it on every hydratePage with the first visible main-zone hero so the next page load's `<link rel="preload" as="image">` fires before the section fetch completes.

- [ ] **2.2 Verify warm-up still saves first-paint time**
  Lighthouse run on a foreground-hero page (deferred to user's deploy verification — needs the live `eagles.run402.com` to measure). The renderer + cache wiring is asserted by `tests/integration/blocks-hero-a11y.test.ts` (foreground `<img loading="eager" decoding="async">`) and `tests/unit/blocks-hero.test.ts`.

### Phase 3: Editor popover

- [x] **3.1 Mode toggle at top of hero popover**
  Hero blocks (background or foreground) now emit a `data-hero-edit="<sid>"` gear button in the section toolbar. Clicking opens a popover; the first fieldset is a 2-radio mode toggle (`Background image` / `Foreground image`).

- [x] **3.2 Reveal foreground fields conditionally**
  When `Foreground image` is selected, the popover renders a fieldset with: image URL, image alt, aspect ratio (select), logo URL, logo position (3-radio), logo max height, caption HTML (textarea), caption position (3x3 grid picker), text position (over/below toggle).

- [x] **3.3 Confirmation on mode switch**
  Switching modes when the previous mode's fields are dirty triggers a `confirm()` prompt; on cancel the radio is restored. On confirm, the previous mode's keys are deleted from the draft and the popover re-renders.

- [x] **3.4 Caption position picker UI**
  3×3 grid of cells; the center cell is disabled. Each cell carries `data-caption-pos` with one of 8 positions. Selecting highlights the cell (`.selected`) and updates the draft. Save merges the popover-managed keys back into the row's `config` JSONB (preserving heading/subheading/cta_*) and PATCHes `sections?id=eq.<sid>`.

### Phase 4: Tests + demo

- [x] **4.1 Renderer unit tests**
  `tests/unit/blocks-hero.test.ts`: 19 tests covering background-mode regression (no-mode === `'background'`), foreground markup (`<picture>` + eager loading), aspect handling (auto + ratio + invalid fallback), logo overlay variants, caption position defaults + invalid fallback, text position over/below, heading-group conditional rendering, `image_alt` warning, and admin gear button emission.

- [x] **4.2 Sanitizer tests**
  18 sanitizer tests in the same file: `<script>` content drop, event-handler attribute strip, `<img>`/`<style>`/`<iframe>`/`<svg>` strip, `javascript:`/`data:`/`vbscript:` href rejection, scheme-relative `//host` rejection, http(s)/mailto/relative href preservation, uppercase/mixed-case `<SCRIPT>` strip, unclosed-tag handling, unknown-tag strip with inner-text retention.

- [x] **4.3 A11y check**
  `tests/integration/blocks-hero-a11y.test.ts` (10 tests, happy-dom env): asserts every `<img>` has an `alt` attribute, picture's alt matches `image_alt`, logo overlay alt=`""` (decorative), caption is a plain `<div>` with no role, heading group uses `<h1>` only, CTA is a real `<a>` with href, no `aria-hidden`/`hidden` on the section, sanitized markup renders correctly into the DOM. Equivalent to axe-core's `image-alt`, `link-name`, `heading-order`, `aria-hidden-body` rules.

- [x] **4.4 Update one demo with a foreground hero**
  Updated `src/seeds/eagles.ts`: homepage hero now uses `mode: 'foreground'` with `image_url: '/assets/hero.jpg'`, logo overlay (left, 110px max-height), bottom-right caption "Founded 1995 · **Sedgwick County, KS**", and over-image text. Seed regenerates cleanly via `KYCHON_PROJECT=eagles tsx scripts/generate-seed-sql.ts`. Real-device verification deferred to deploy.

- [ ] **4.5 ODBC port verification — foreground hero from source**
  Blocked by [composable-layout](../composable-layout/tasks.md) Phase 7 (`/copy-website` ODBC re-port). When that ships, this change unblocks the hero portion of the verification — ODBC's banner will render at native aspect (no cropping), ship's-wheel logo overlaid on the left, "Founded 1880" caption anchored bottom-right.

### Phase 5: Documentation

- [x] **5.1 Update `composable-layout` block-type docs**
  Added a `## Hero Block Modes` section to `STRUCTURE.md` documenting the two modes, all foreground config keys with defaults, and a pointer to the `sanitizeCaptionHtml` allowlist.

- [x] **5.2 Note the `hero-parallax` scope change**
  Added `specs/hero-parallax/spec.md` to this change with a MODIFIED requirement clarifying parallax scope: applies only when `mode === 'background'`; foreground heroes are static. Includes a new scenario "Foreground hero is exempt from parallax" asserting no scroll-driven transform on the picture.
