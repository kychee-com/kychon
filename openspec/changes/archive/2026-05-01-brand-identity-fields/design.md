## Context

Composable-layout introduces a `brand_header` block that today reads `site_config.logo_url` (the single existing brand-asset field). With one URL field and one renderer, every brand asset has to fit the same constraints — the single most common ODBC port failure was a wide banner squeezed into a 40px nav-brand slot.

This change recognizes that brand assets come in three flavors, only one of which the renderer can use safely in a constrained navigation slot:

- **Icon** — square (or near-square) mark. Fits in nav, footer, favicon. The "compact brand" representation.
- **Wordmark** — wide horizontal logo that includes the org's name as part of the design. Fits as a standalone brand on a splash, login screen, or footer; doesn't combine well with separate text since it already says the name.
- **Text** — the textual name, the source of truth and the universal fallback.

Constraints driving this design:
- No installed base. We can rename `logo_url` to `brand_icon_url` (or eliminate it) without back-compat aliasing.
- The `brand_header` block must continue to render correctly in the header zone with the current chrome layout (logo on left, nav links beside it, sign-in on right).
- The favicon fallback chain has to work at build time (Portal.astro's `<link>` is baked) AND survive runtime overrides (admin uploads update `site_config`, the next page load reflects the new favicon).
- Inline `data:` SVG URLs are valuable specifically for the `/copy-website` skill flow where generating an SVG monogram is cheaper than generating + uploading a PNG.

## Goals / Non-Goals

**Goals:**
- A faithful brand on every Kychon project, regardless of what assets the source has.
- The `/copy-website` skill can produce a working brand without making invalid asset choices.
- Favicons are easy to set, even from generated SVG.
- Documentation explains which field to use for which asset shape.

**Non-Goals:**
- Auto-generating brand assets (favicon from icon, wordmark from text). v1 is human-curated; the skill handles generation outside this change.
- Multi-resolution favicon support (`apple-touch-icon`, `mask-icon`). v1 ships a single SVG favicon. Multi-res is a follow-up.
- Animated brand assets. Not a real need.
- Per-page or per-locale brand variations. Not surfaced by any port.

## Decisions

### 1. Three explicit fields, not one polymorphic

**Decision**: distinct keys for distinct purposes:

| Key | Format | Used by | Optional? |
|---|---|---|---|
| `brand_icon_url` | square image (any URL) | `brand_header` (with text), favicon fallback | yes |
| `brand_wordmark_url` | wide image (any URL) | `brand_header` (alone), footer | yes |
| `brand_text` | string | `brand_header` (with icon), aria labels, favicon-text fallback | required |
| `brand_text_short` | string | `brand_header` (with icon, small screens) | yes |
| `favicon_url` | image URL or `data:` | `<link rel="icon">` | yes |

**Why three fields and not one with a `kind` field**: explicit trumps clever. With `{ kind: 'icon', url: ... }`, every consumer has to pattern-match on `kind`. With three keys, the renderer's logic is a clear if/else chain.

**Why `brand_text` is required**: even with both image URLs set, alt text and aria labels need a string. Always-set means we never have to handle the "no string fallback" case.

**Why no `kind: 'auto'` detection by aspect ratio**: at admin-edit time we don't always have the dimensions. Detection at upload time is the helper hint, not a routing rule.

### 2. Picker rules in priority order

**Decision**: the `brand_header` renderer applies these rules in order:

```ts
function renderBrandHeader(config: BrandConfig): string {
  if (config.brand_icon_url) {
    return `<a class="brand-header brand-header--icon" href="/" aria-label="${esc(config.brand_text)}">
      <img class="brand-icon" src="${config.brand_icon_url}" alt="">
      <span class="brand-text">
        <span class="brand-text--full">${esc(config.brand_text)}</span>
        ${config.brand_text_short ? `<span class="brand-text--short">${esc(config.brand_text_short)}</span>` : ''}
      </span>
    </a>`;
  }
  if (config.brand_wordmark_url) {
    return `<a class="brand-header brand-header--wordmark" href="/" aria-label="${esc(config.brand_text)}">
      <img class="brand-wordmark" src="${config.brand_wordmark_url}" alt="${esc(config.brand_text)}">
    </a>`;
  }
  return `<a class="brand-header brand-header--text" href="/">
    ${esc(config.brand_text)}
  </a>`;
}
```

**Why icon before wordmark in priority**: icon + text is the most flexible representation. If both are set, the icon wins (it scales better in small slots). Admins who want wordmark-only should clear `brand_icon_url`.

**Why text-short via CSS, not JS**: media queries handle the swap with no JS. The full text is hidden via `display: none` at narrow viewports; the short text is shown.

### 3. Asset-upload aspect-ratio hint

**Decision**: when an admin uploads to `brand_icon_url`, the upload-asset edge function reads the image's intrinsic dimensions (server-side, via the existing image-processing utility). If `width > 1.5 × height`, the response includes `{ url, warning: 'looks_like_wordmark' }`. The admin UI shows an inline tooltip in the asset picker: "This image looks like a wordmark. Save to `brand_wordmark_url` instead?".

Admin clicks "OK keep here" or "Move to wordmark". Either way, the URL is stored; only the routing decision changes.

**Why a tooltip and not a hard block**: the heuristic is fallible (some logos are intentionally landscape and should still go in the icon slot). Hint, don't gate.

**Why server-side dimension check**: client-side also works (`new Image()` + `naturalWidth`/`naturalHeight`), but the server-side function already runs on every upload; adding the dimensions check there is one place vs. two.

### 4. Drop `site_config.logo_url`, no alias

**Decision**: remove `logo_url` entirely. No aliasing, no back-compat:

- Generators no longer emit `logo_url` rows.
- All seeds use `brand_icon_url` + `brand_text`.
- All renderers read the new keys.
- An assertion at build time: the seed-SQL generator throws if it encounters a `logo_url` key in any seed module.

**Why no alias**: with no installed base, an alias is dead weight. With users on it later, an alias might be defensible — but right now it's just two paths to maintain.

### 5. Favicon fallback chain

**Decision**: `Portal.astro`'s frontmatter computes the effective favicon URL:

```ts
const faviconUrl =
  siteConfig.favicon_url ||
  siteConfig.brand_icon_url ||
  '/favicon.svg';
```

The `<link rel="icon">` then renders this single resolved URL. Type detection (`type="image/svg+xml"` vs `type="image/png"` etc.) is based on the URL — `data:` URLs and `.svg` files use SVG; everything else omits `type` (browsers infer).

**Why frontmatter and not runtime**: the favicon must be in the HTML head before first paint. Runtime injection works but causes a flash. Frontmatter bake (per composable-layout) is the right time.

**Why this exact priority**: `favicon_url` is the explicit override. `brand_icon_url` is the natural derivative — most projects don't need a separate favicon when the brand icon suffices. The engine default is the last-resort visual identity.

### 6. `data:image/svg+xml` URLs are first-class

**Decision**: the favicon `<link>` accepts any URL form including `data:image/svg+xml,…`. The CSP baseline (from embed-block) already permits `img-src 'self' https: data:`. Astro's `set:html` (or interpolation in template literals) preserves the URL as-is.

```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg…%3C/svg%3E">
```

URL-encoded percent sequences are required (browsers reject unencoded `<` and `>` in `href` attributes).

**Why URL-encoded data URLs and not base64**: URL-encoding is human-readable and produces smaller output for typical SVGs (~30% smaller than base64 for SVG markup). The skill (when it lands) emits URL-encoded.

**Why first-class and not a special branch**: the `<link href>` attribute already accepts data URLs in browsers; we just need to not strip or transform them. No special code.

### 7. Update demos with explicit brand fields

**Decision**: each demo's seed gets explicit brand fields:

- **eagles** (boat club): `brand_icon_url` = anchor SVG, `brand_text` = "Eagles Boat Club".
- **silver-pines** (HOA): `brand_icon_url` = pine-tree SVG, `brand_text` = "Silver Pines Community", `brand_text_short` = "Silver Pines".
- **barrio-unido** (church): `brand_icon_url` = cross SVG, `brand_text` = "Barrio Unido", `brand_text_short` = "Barrio Unido".

Existing demo logos (currently in `logo_url`) are migrated. If any are wider than 1.5× their height, they're routed to `brand_wordmark_url` instead.

### 8. Document the model

**Decision**: a `CUSTOMIZING.md` section (creating the file if it doesn't exist) explains:

```
## Branding

Kychon represents your brand with three fields:

- brand_icon_url — square mark (favicon-style)
- brand_wordmark_url — wide horizontal logo
- brand_text — always required

The header picks one of three render modes:
1. Icon set → renders icon + text
2. No icon, wordmark set → renders wordmark alone
3. Neither image → renders text alone

Favicon fallback:
favicon_url → brand_icon_url → /favicon.svg (engine default)
```

Plus diagrams for each render mode.

## Risks / Trade-offs

### A. Three fields are denser than one

Admin settings has a longer brand section. Mitigation: progressive disclosure — most projects have just an icon + text; the wordmark field is in an "Advanced" toggle. Default first-time setup walks them through the icon slot.

### B. The aspect-ratio hint can be wrong

Some legitimate icons are deliberately landscape (e.g. a row of three small marks). The 1.5× heuristic flags them. Mitigation: hint, not block. Admin can dismiss.

### C. Removing `logo_url` requires every internal reference to update

Mitigation: a one-time grep + replace (`logo_url` → `brand_icon_url` where the semantic is "the icon"; or removed where the semantic is "the brand asset (any kind)" — which gets replaced by the picker rules).

### D. SVG `data:` URLs encoded inline can grow large

A 2KB SVG becomes ~3KB URL-encoded + double-encoded once it hits the HTML attribute. For a typical monogram (200-500 bytes raw), the inline cost is minimal. For larger SVGs, admins should host the file and use a URL.

### E. Browsers may not invalidate cached favicons

Favicons are notoriously sticky in browser caches. Mitigation: nothing this change can do; document that favicon changes may require a hard refresh.

## Migration / Rollout

Order of operations:
1. Add the three new keys (and `favicon_url`) to the kychon-template seed; remove `logo_url`. Re-run generator; verify seed.sql looks right.
2. Update `brand_header` renderer in `src/lib/blocks.ts` with the picker rules.
3. Update `Portal.astro` favicon `<link>` with the fallback chain and `data:` support.
4. Update each demo's seed (eagles, silver-pines, barrio-unido). Re-deploy.
5. Update admin settings page to surface the three new fields.
6. Add the upload-asset aspect-ratio hint.
7. Document in `CUSTOMIZING.md`.
8. Visual verify each demo: brand renders with correct mode, favicon shows correctly, admin can edit each field.
