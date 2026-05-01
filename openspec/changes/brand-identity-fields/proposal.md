## Why

When the `/copy-website` skill ports a Wild Apricot site, the source rarely has a single clean small square logo. ODBC's source has three brand assets: a circular ship's-wheel mark (~150×150) overlaid on the hero, a wide horizontal "ODBC FOUNDATION" banner at 1200×300 used as a page header, and no scrapable favicon-grade asset. The skill grabbed the wide banner and stuffed it into `site_config.logo_url`. The Kychon nav constrained it to ~40px and rendered it as a stretched, distorted blob, with the brand text "Old Dominion Boat Club" wrapping over three lines next to it. **Setting `logo_url = NULL` actually made the site look better** — text-only branding, no distortion.

Today's single-`logo_url` field forces porters into a choice that's wrong either way: a tiny crop of a banner is unreadable; the full banner is distorted; NULL is correct but loses the brand mark entirely. There's also no good favicon story when the source has no favicon-grade asset — the skill ends up with the foundation banner cropped to 32×32, illegible at that size, or it falls back to Kychon's generic favicon, clearly not the org's mark.

This change splits the single `logo_url` into three explicit brand fields with clear render rules — icon for square marks, wordmark for wide banners, text as the fallback and source of truth — and extends the favicon system to accept inline `data:image/svg+xml` URLs (so a skill-generated SVG monogram or wheel mark can ship in the seed without a separate upload step). The favicon fallback chain becomes: `site_config.favicon_url` → `site_config.brand_icon_url` → engine default `/favicon.svg`.

Closes [#58 brand: separate icon / wordmark / text](https://github.com/kychee-com/kychon/issues/58) and [#64 favicon: accept inline data:image/svg+xml URLs](https://github.com/kychee-com/kychon/issues/64).

## What Changes

- **Three new `site_config` keys**: `brand_icon_url` (square ≤ 200px, used in nav-brand and as favicon fallback), `brand_wordmark_url` (wide horizontal logo, used on splash / footer / when no icon exists), `brand_text` (always set; used as the textual brand on every render path), plus optional `brand_text_short` (1-line abbreviation for tight spaces).
- **`brand_header` block render rules** (the chrome block introduced by [composable-layout](../composable-layout/proposal.md)):
  1. If `brand_icon_url` is set → render icon + `brand_text` (with `brand_text_short` swapped in on small screens via CSS).
  2. Else if `brand_wordmark_url` is set → render wordmark only (no separate text — the wordmark already includes it).
  3. Else → text-only (`brand_text`, equivalent to today's `logo_url=NULL` behavior).
- **`site_config.logo_url` is removed**. With no installed base, no aliasing or back-compat is required. The kychon-template seed and all three demo seeds drop `logo_url` and use `brand_icon_url` (or `brand_wordmark_url`) explicitly.
- **Aspect-ratio sanity check in admin upload**. When an admin uploads to `brand_icon_url`, the upload pipeline checks the image's intrinsic aspect ratio. If width > 1.5 × height, a console warning logs and the asset picker shows an inline hint: "This looks like a wordmark, not an icon. Save it to `brand_wordmark_url` instead?". Admin can ignore.
- **Favicon accepts `data:image/svg+xml,…` URLs.** `Portal.astro`'s `<link rel="icon" type="image/svg+xml" href={favicon_url}>` accepts `https://`, root-relative (`/`), and `data:image/svg+xml,…` values without modification. CSP `img-src` already allows `data:` (per [embed-block](../embed-block/proposal.md)'s baseline).
- **Favicon fallback chain.** When `site_config.favicon_url` is null/empty, fall back to `site_config.brand_icon_url`; when that is also null/empty, fall back to the engine default at `/favicon.svg` shipped in `public/`.
- **Documentation in `CUSTOMIZING.md`** describes the brand fields, when to use each, and the favicon fallback chain.
- **Skill hook** (separate concern, tracked separately): when `/copy-website` finds no clean small favicon-grade asset, it should generate an SVG monogram or wheel mark and ship it inline as a `data:image/svg+xml,…` URL in `brand_icon_url`. Out of scope for this change but enabled by it.

## Capabilities

### Modified Capabilities

- `config-driven-ui`: replaces the `site_config.logo_url` field model with three explicit brand fields (`brand_icon_url`, `brand_wordmark_url`, `brand_text`, optional `brand_text_short`). Updates the brand renderer requirement to follow the picker rules.
- `composable-layout`: extends the `brand_header` block-type to consume the three new fields per the picker rules; removes any reference to `site_config.logo_url` from the brand-header rendering contract.

## Impact

- **New files**: none.
- **Modified files**: `src/lib/blocks.ts` (`brand_header` renderer follows picker rules; reads new fields), `src/layouts/Portal.astro` (favicon `<link>` reads `site_config.favicon_url` with fallback to `brand_icon_url` and final fallback to `/favicon.svg`; accepts `data:` URLs), `src/seeds/kychon.ts` + `src/seeds/{eagles,silver-pines,barrio-unido}.ts` (drop `logo_url`, use `brand_icon_url` + `brand_text`), `src/components/AdminEditor.astro` (asset picker for `brand_icon_url` includes aspect-ratio hint; admin-settings page surfaces the new fields), `CUSTOMIZING.md` (new section documenting the fields).
- **Deleted**: any reference to `site_config.logo_url` in `src/`. The seed-generator no longer emits the `logo_url` row.
- **Dependencies**: none new.
- **Bundle impact**: minimal (~500 bytes for the picker rules + asset-upload hint).
- **Hard dep**: ships only after [composable-layout](../composable-layout/proposal.md) lands (the `brand_header` block must exist).
- **Soft dep**: independent of [block-types-catalog](../block-types-catalog/proposal.md), [embed-block](../embed-block/proposal.md), and [theme-system-audit](../theme-system-audit/proposal.md).
