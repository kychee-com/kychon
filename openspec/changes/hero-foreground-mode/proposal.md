## Why

ODBC's source hero at [olddominionboatclub.com](https://www.olddominionboatclub.com/) is a regular `<img>` rendered at native aspect ratio: a wide banner photo with the ship's-wheel logo overlaid on the left and the "Founded 1880" tagline + lat/long inscription anchored bottom-right. The banner image *is* the brand mark. The Kychon port at `odbc-port.run402.com` paints the same image as a CSS `background-image: cover center` on the `hero` section, which crops anything not 16:9. ODBC's `HomeBanner.png` is wider than 16:9, so the rendered result is cropped, stretched, and visually wrong.

Today's `hero` block ([defined in composable-layout's `BLOCK_TYPES.hero`](../composable-layout/specs/composable-layout/spec.md)) is correct for hero-as-decoration: a background image with text overlaid is the right pattern when the image is mood, not message. It's wrong for hero-as-content where the image, the overlaid logo, and the corner caption are themselves the brand expression.

This change extends the existing `hero` block with an explicit `mode` property: `'background'` (today's default, unchanged) or `'foreground'` (new). In `foreground` mode the renderer emits a `<picture>` at the image's native or configured aspect ratio with optional logo overlay, corner caption, and configurable heading position (over or below the image).

Closes [#53 hero: foreground-img mode + overlay logo + caption](https://github.com/kychee-com/kychon/issues/53).

## What Changes

- **Schema-free.** Nothing changes in the database. The `hero` block's `config` JSONB gains optional new keys; existing hero blocks with `mode` unset keep their current `background` rendering exactly as today.
- **`mode` field.** `config.mode: 'background' | 'foreground'`, default `'background'`.
- **Foreground rendering.** When `mode === 'foreground'`, `BLOCK_TYPES.hero.render` emits `<picture><img src={image_url} alt={image_alt} loading="eager" decoding="async" /></picture>` at the configured aspect (no `background-image: cover`). The `<picture>` is the visual centerpiece of the section; heading/subheading/CTA can be configured to render over the image (with text-shadow) or below it.
- **`image_aspect`.** New config key controlling rendered aspect: `'auto'` (use intrinsic via CSS `aspect-ratio: auto` plus the image's natural dimensions), `'16/9'`, `'4/3'`, `'21/9'`. Default `'auto'`.
- **`image_alt`.** New config key for the `alt` attribute. Required when in foreground mode (renderer emits a console warning if missing). Falls back to `''` to avoid a11y regression but logs.
- **`logo_overlay_url`** (and friends). New config keys: `logo_overlay_url`, `logo_position` (`'left' | 'center' | 'right'`, default `'left'`), `logo_max_height` (default `120px`). When set, the logo is rendered as an absolutely-positioned `<img>` over the banner.
- **`caption_html`** (and friends). New config keys: `caption_html` (allows minimal markup — line breaks, `<strong>`, `<em>`, `<a>` — sanitized), `caption_position` (eight values: `top-left`, `top-center`, `top-right`, `right-middle`, `bottom-right`, `bottom-center`, `bottom-left`, `left-middle`). Default `'bottom-right'`.
- **Heading placement.** New config key `text_position`: `'over_image'` (heading/subheading/CTA absolutely-positioned over the image with text-shadow) or `'below_image'` (heading group renders below the picture in the normal document flow). Default `'over_image'` for foreground mode (preserves a single visual block); reserved for future use in background mode (currently always over).
- **Lazy/eager loading.** Hero is above-the-fold on the home page, so the renderer emits `loading="eager"` and `decoding="async"`. The existing `cacheHeroImage` warm-up extends to read the foreground image's `src` (currently it reads `bg_image`).
- **Editor popover.** The `hero` block's edit popover (introduced by composable-layout's inline-editing wiring) gains a mode toggle. When mode is `foreground`, additional fields appear: aspect ratio select, logo upload (via the existing `data-editable-image` pattern), logo position select, caption HTML editor (rich text), caption position picker (visual 3x3 grid), text position toggle. When mode is `background`, only today's fields are visible.
- **Demo update.** Optionally add a hero block to one demo (e.g. silver-pines) that uses foreground mode, so the feature is visible on a deployed site without re-running the ODBC port.

## Capabilities

### Modified Capabilities

- `composable-layout`: extends the `hero` block-type with foreground rendering mode, native-aspect `<picture>`, optional logo overlay, configurable caption position, and configurable heading placement.
- `hero-parallax`: clarifies that parallax applies only when `mode === 'background'`. In foreground mode, no parallax effect is applied.

## Impact

- **New files**: optional `public/css/hero-foreground.css` (~1.5kB) loaded only when at least one foreground hero exists on the page (or just appended to `styles.css` — call it at task time).
- **Modified files**: `src/lib/blocks.ts` (extend `hero` renderer), `src/lib/config.ts` (extend `cacheHeroImage` to read foreground `image_url`), `src/components/AdminEditor.astro` (mode toggle + conditional fields in hero popover), tests.
- **Dependencies**: none new. CSS `aspect-ratio` is widely supported (95%+ of browsers); fallback for older browsers is `padding-bottom` ratio trick (handled by a small CSS utility).
- **Bundle impact**: ~2kB extra renderer code, ~1.5kB extra CSS. Logo and caption rendering are inert HTML; no extra JS runtime.
- **Hard dep**: ships only after [composable-layout](../composable-layout/proposal.md) lands, since the `hero` block's renderer lives in the new `BLOCK_TYPES` registry.
- **Independent of `nav-nested-children`**: this change and the nav-children change are sister proposals on the same substrate, both unblocked by composable-layout, neither depends on the other.
