## Why

The ODBC port set a `site_config.theme` JSON with `font_heading: "Playfair Display"`, `font_body: "Source Sans 3"`, a custom navy + brass + cream palette, `radius: "0.5rem"`, `max_width: "72rem"`. The rendered live site at `odbc-port.run402.com` uses **Source Sans for headings** (Playfair never loaded — Kychon doesn't inject any Google Fonts CSS, so a theme that names a non-system font silently falls back to the OS default). The body font is a platform default, and `radius` and `max_width` may or may not flow through (visually unverified — some components hardcode their own border-radius).

Two failures stack:

1. **Some `theme` keys are silently ignored.** The schema lists `accent`, `font_heading`, `font_body`, `radius`, `max_width` but none of these have been audited end-to-end for "does this key actually set a CSS custom property that something downstream uses?".
2. **Even keys that flow correctly require the named font to load.** Kychon doesn't inject any Google Fonts `<link>`, so any non-system font name resolves to a fallback at first paint.

A "nicer / more modern" Kychon site can't get there if half the theme system is decorative. The full audit + a build-time Google Fonts injector is small, contained work — but the visible improvement on every Kychon project is significant.

Closes [#63 theme: audit which site_config.theme keys flow to CSS + auto-load Google Fonts when named](https://github.com/kychee-com/kychon/issues/63).

## What Changes

- **End-to-end audit of every `site_config.theme` key.** For each key the schema accepts, verify it sets a CSS custom property on `document.documentElement` AND that downstream CSS uses that custom property. Keys that don't flow get either wired (if they should) or removed from the schema (if they were aspirational and never used).
- **Build-time Google Fonts injection.** When a theme names `font_heading` or `font_body` outside a small system-stack allowlist, `Portal.astro`'s frontmatter emits `<link>` tags to load the named fonts from Google Fonts. The injection happens at build time so first paint already has the font CSS request in flight (preconnect hints accelerate further).
- **System-stack allowlist.** The injector skips font names matching: `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica`, `Arial`, `sans-serif`, `serif`, `monospace`, `Helvetica Neue`. These resolve OS-side; injecting Google Fonts for them is wrong.
- **`font-display: swap` and preconnect hints.** Every Google Fonts injection includes preconnect to `https://fonts.googleapis.com` and `https://fonts.gstatic.com`. The CSS URL includes `&display=swap` so text renders with the fallback while Google Fonts load.
- **Demos use named fonts.** Update each demo (eagles, silver-pines, barrio-unido) to use distinctive named fonts in their themes — so "modern Kychon" looks consistent and good across deployments. Eagles: `Inter` for body + `Cormorant Garamond` for heading (nautical/classic). Silver Pines: `IBM Plex Sans` for body + `Bitter` for heading. Barrio Unido: `Noto Sans` for body + `Merriweather` for heading.
- **Audit document in `STRUCTURE.md`** (or a new `THEME.md`): a status table for every theme key — wired / orphan / removed — with the CSS custom property each maps to.

## Capabilities

### New Capabilities

- `theme-fonts-injection`: at build time, emit Google Fonts `<link>` tags into the HTML head when the active theme names non-system fonts. The injection is deterministic (same theme produces same `<link>` tags), reads from the seeded `site_config.theme`, and respects an allowlist of system fonts that don't need network loading.

### Modified Capabilities

- `config-driven-ui`: clarifies which `site_config.theme` keys flow through to CSS custom properties, removes orphan keys from the schema, and updates the theme-injection requirement to cover the new font-loading behavior.

## Impact

- **New files**: `src/lib/theme/fonts.ts` (font name parser, system-stack allowlist, Google Fonts URL builder). Possibly `THEME.md` documentation file.
- **Modified files**: `src/layouts/Portal.astro` (frontmatter calls font injector, emits `<link>` tags), `src/lib/config.ts` (theme injection — remove or wire orphan keys), `public/css/theme.css` (ensure every defined custom property has a usage; add usages where missing for `radius`, `max_width`, `accent`), demo seeds (use named fonts), `STRUCTURE.md` or new `THEME.md` (audit table).
- **Dependencies**: none new. Google Fonts is fetched by the browser; we just emit `<link>` tags. CSP baseline (from embed-block) already permits `font-src https://fonts.gstatic.com`.
- **Bundle impact**: zero JS. ~200 bytes per page for the preconnect + stylesheet links. Google Fonts CSS itself is loaded by the browser; ~30-50KB per font typically, cached aggressively.
- **First-paint impact**: positive — preconnect + `font-display: swap` keeps the fallback rendered until the named font loads, no FOIT (flash of invisible text). LCP is unaffected because heading/body fonts are non-blocking.
- **Hard dep**: ships only after [composable-layout](../composable-layout/proposal.md) lands (the bake pattern in `Portal.astro` is needed for build-time font injection).
- **Soft dep**: independent of [block-types-catalog](../block-types-catalog/proposal.md), [embed-block](../embed-block/proposal.md), and [brand-identity-fields](../brand-identity-fields/proposal.md). Synergistic with embed-block (the CSP baseline includes `font-src https://fonts.gstatic.com` which this change relies on).
