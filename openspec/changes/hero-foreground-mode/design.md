## Context

After [composable-layout](../composable-layout/proposal.md), the `hero` block lives in `BLOCK_TYPES.hero` in `src/lib/blocks.ts` with a `render(section, ctx): string` function. Today's `config` shape is `{ heading, subheading, cta_text, cta_href, bg_image }`. The renderer emits an `<h1>` group and applies `background-image: cover center` to the section element when `bg_image` is set. The `cacheHeroImage` helper preloads the bg_image for performance.

That model assumes the image is mood/decoration. Real org sites — Wild Apricot–style member-org sites in particular — frequently use the hero image as the brand mark itself: a banner photo at native aspect with a logo overlay and a corner inscription. ODBC's source is the canonical example.

Constraints driving this design:
- The change is purely additive to `config`. Existing hero blocks with no `mode` set must render identically to today.
- The renderer must work in both bake (Node) and hydrate (browser) contexts; same string-returning contract.
- The hero is above the fold on the home page; first-paint performance matters. `loading="eager"` and `decoding="async"` are the right hints; the existing `cacheHeroImage` preload should extend to foreground images.
- Layout in foreground mode is intricate (image + overlay logo + corner caption + heading-over-or-below). CSS Grid + absolute positioning is the right primitive.

## Goals / Non-Goals

**Goals:**
- Foreground mode renders banner imagery at native aspect (no cover-cropping).
- Logo overlay positioned left/center/right with configurable max-height.
- Caption in any of eight positions (4 corners + 4 edges).
- Heading group can render over the image (with text-shadow) or below it (normal flow).
- Background mode — today's behavior — preserved exactly.
- Existing `hero-parallax` capability scoped to background mode only.

**Non-Goals:**
- Carousels / sliders. A separate `slideshow` block type is the right home for that (mentioned in [#51 G_LAYOUT](https://github.com/kychee-com/kychon/issues/51) and tracked separately).
- Video heroes. Out of scope; can be added as `mode: 'video'` in a follow-up if real demand surfaces.
- Animated/parallax foreground heroes. Foreground is static; parallax is background-only.
- WebP / AVIF picture sources. The renderer emits a single `<img>` for v1; multi-source `<picture>` with `srcset` is a follow-up performance optimization. The `<picture>` element wrapper is in place so `<source>` tags can be added without a renderer rewrite.

## Decisions

### 1. The `mode` field with `'background'` default

**Decision**: Add `config.mode: 'background' | 'foreground'`, default `'background'`. Renderer dispatches:

```ts
function render(section, ctx) {
  const mode = section.config.mode ?? 'background';
  return mode === 'foreground'
    ? renderForegroundHero(section, ctx)
    : renderBackgroundHero(section, ctx);  // existing logic
}
```

**Why default `'background'`**: every existing hero block has no `mode` field set; we treat that as `'background'` so back-compat is automatic without a migration. `'foreground'` is opt-in.

### 2. `<picture>` element from day one, single `<img>` source

**Decision**: Foreground mode emits:

```html
<picture class="hero-picture">
  <img src={image_url} alt={image_alt} loading="eager" decoding="async"
       style={aspectStyle} />
</picture>
```

Single `<img>` source for v1. No `<source>` siblings.

**Why `<picture>` even with one source**: lets us add WebP/AVIF + responsive `<source>` tags later without rewriting the renderer or its consumers. Marginal cost (one extra wrapper element).

### 3. Aspect ratio handling

**Decision**: `image_aspect` config controls CSS:

| `image_aspect` | CSS applied to `<img>` |
|---|---|
| `'auto'` (default) | `aspect-ratio: auto` — uses image's natural dimensions |
| `'16/9'` | `aspect-ratio: 16 / 9; object-fit: cover` |
| `'4/3'` | `aspect-ratio: 4 / 3; object-fit: cover` |
| `'21/9'` | `aspect-ratio: 21 / 9; object-fit: cover` |

For `'auto'`, the image's `width: 100%; height: auto` lets it render at its natural aspect, full-width within the container.

For ratio overrides, CSS `aspect-ratio` is widely supported (95%+ of browsers per caniuse). For older browsers, a fallback class (`hero-picture--aspect-fallback`) using `padding-bottom: 56.25%` (etc.) wraps the image in an absolute-positioned container.

**Why CSS `aspect-ratio` over the padding trick**: cleaner, no positioning hacks, no extra wrapper. The fallback is one extra CSS rule for the legacy case.

### 4. Logo overlay positioning

**Decision**: Logo renders as an `<img>` absolutely-positioned over the banner:

```html
<div class="hero-logo-overlay" data-position={logo_position}>
  <img src={logo_overlay_url} alt="" style={`max-height: ${logo_max_height}`} />
</div>
```

CSS positions the overlay container based on `data-position`:
- `'left'`: `left: 2rem; top: 50%; transform: translateY(-50%)`
- `'center'`: `left: 50%; top: 50%; transform: translate(-50%, -50%)`
- `'right'`: `right: 2rem; top: 50%; transform: translateY(-50%)`

`alt=""` because the logo is decorative when an overlay (the brand is already conveyed by the heading + the banner image's alt). If the logo is the *only* brand mark on the section, the seed should set `image_alt` to include the brand name.

**Why `data-position` over inline styles**: keeps the renderer's HTML clean; CSS owns the layout. Variants are easier to extend (add a position, add a CSS rule).

### 5. Caption rendering in eight positions

**Decision**: Caption renders in a `<div>` with absolute positioning, controlled by `caption_position`:

```html
<div class="hero-caption" data-position={caption_position}>{caption_html}</div>
```

Eight positions: `top-left`, `top-center`, `top-right`, `right-middle`, `bottom-right`, `bottom-center`, `bottom-left`, `left-middle`. Each is one CSS rule.

`caption_html` is rendered via `set:html` (Astro frontmatter at bake time) or `innerHTML` (runtime). To prevent XSS via admin-input strings, the renderer SHALL run a small allowlist sanitizer permitting only `<br>`, `<strong>`, `<em>`, `<a href>`. All other tags are stripped; all attributes except `href` on `<a>` are stripped; `href` is restricted to `http(s):`, `mailto:`, and relative paths.

**Why an allowlist sanitizer over a library**: the sanitizer is ~30 lines; pulling in a library (DOMPurify) adds 30kB+ for one feature. The allowlist is narrow and stable.

### 6. Text position: over or below

**Decision**: `text_position: 'over_image' | 'below_image'`, default `'over_image'` for foreground mode.

`'over_image'`: heading/subheading/CTA absolutely-positioned, centered horizontally, with `text-shadow: 0 1px 4px rgba(0,0,0,0.6)` for readability against any image. Vertical position depends on caption — heading defaults to top-center if caption is `bottom-*`, and to centered otherwise.

`'below_image'`: heading group renders below the `<picture>` in normal document flow. Useful when the image is highly detailed and overlay text would be unreadable.

**Why default `'over_image'`**: matches the typical hero usage (image + overlaid text). `'below_image'` is for the busy-image edge case.

**Why not extend to background mode**: today's background mode always renders text over. Foreground introduces the meaningful choice; opening it to background can come later if needed.

### 7. `cacheHeroImage` extension

**Decision**: Update `cacheHeroImage` and `preloadHeroImage` in `src/lib/config.ts` to read either `bg_image` (background mode) or `image_url` (foreground mode) from the active hero section's config:

```ts
function getHeroImageUrl(section): string | null {
  if (section.config.mode === 'foreground') return section.config.image_url ?? null;
  return section.config.bg_image ?? null;
}
```

Both modes warm the same browser image cache via `<link rel="preload" as="image">`.

### 8. Admin editor popover: conditional fields

**Decision**: The hero block's edit popover (built into `AdminEditor` per composable-layout) gains:

- A mode toggle at the top: `Background image` / `Foreground image`.
- When `Foreground` is selected, a fieldset reveals: image URL (existing `data-editable-image`), image alt (text), aspect ratio (select), logo URL (image picker), logo position (3-button radio), logo max height (number, px), caption HTML (rich text), caption position (3x3 grid picker), text position (toggle: over/below).
- When `Background` is selected, only today's fields are visible: bg image, heading, subheading, CTA text, CTA href.

Switching modes preserves common fields (heading, subheading, CTA) and clears mode-specific fields with a confirmation: `"Switching modes will clear the {previous-mode}-specific fields. Continue?"`.

**Why a confirmation on switch**: protects an admin who set up an elaborate foreground hero and clicked the wrong toggle. Single confirmation, single click — not a friction wall.

### 9. Parallax scopes to background mode only

**Decision**: Update the `hero-parallax` capability spec to clarify: parallax applies only when `mode === 'background'`. In foreground mode, the `<picture>` is in normal flow with no scroll effect.

**Why**: parallax on a foreground `<picture>` would be visually bizarre (the image is the content, not the backdrop). Parallax is a backdrop-mood effect.

## Risks / Trade-offs

### A. Layout complexity scales with config keys

Foreground mode introduces ~7 new config keys with intricate interactions (caption position vs heading position vs logo position). Trade-off: matches the source-content shape we need to represent. We don't introduce keys for hypothetical needs — every key is justified by an ODBC-level use case.

### B. The popover gets denser

A mode toggle plus 8 new conditional fields makes the hero edit popover the busiest block popover. Mitigation: collapse the foreground fieldset by default if the most common case (just heading + image, no logo, no caption) covers most uses. Show "More options" disclosure.

### C. CSS `aspect-ratio` and old browsers

The 5% of browsers without `aspect-ratio` support get the padding-trick fallback class. Trade-off: ~10 extra CSS lines. Acceptable.

### D. Caption HTML sanitizer blast radius

The sanitizer is ~30 lines; if it has a bug (e.g. fails to strip `<script>`), an admin can XSS visitors. Mitigation: tested with a malicious-input fixture (`<script>`, `javascript:` href, event handlers like `onerror`); CI verifies all are stripped.

### E. Text-shadow over arbitrary images

`text-shadow: 0 1px 4px rgba(0,0,0,0.6)` is decent for most images but can fail on white-dominant ones. Mitigation: the `text_position: 'below_image'` option exists exactly for this case; admins choose when text-over-image won't work.

## Migration / Rollout

Purely additive — `mode === undefined` renders as today's background mode. We can ship the renderer change, deploy, and adopt foreground mode per-demo at our pace.

1. Renderer + CSS land first.
2. Editor popover updates (mode toggle, conditional fields) follow.
3. One demo gains a foreground hero (e.g. eagles's homepage uses a banner-style hero); deploy and visually verify.
4. ODBC port re-runs faithfully (parallel with composable-layout's Phase 7 — this change unlocks the hero portion of that test).
5. Documentation updated.
