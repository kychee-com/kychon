## Why

Pre-launch, Kychon's sharpest wedge is faithfully migrating clubs off Wild Apricot, and its strategic bet is best-in-class DX for the coding agents (the copy-website porter, Kychon Pro) that build and customize portals. Today the porter must fall back to opaque custom HTML/CSS whenever a source pattern has no typed block — losing structured editing, theming, and translation, and forcing per-port `!important` hacks. With no users yet there is no back-compat to protect, so this is the moment to close the porter's remaining typed-block gaps in one bold change and make the port self-aware about anything it still can't cover.

## What Changes

- Add a typed `feature_panels` block (association homepage panel grids), so the three-panel pattern that today degrades to stacked prose ships as structured, editable config. The HTML sanitizer stays locked — we do **not** add a looser custom-HTML mode.
- Add a typed `menu` block for restaurant/bar menus: ordered sections, each with items `{ name, description, price, dietary_tags }`, editable in the block list editor, themable, translatable.
- Add composable header primitives `utility_bar`, `social_row`, and `safety_cta`, plus a porter-emittable "utility header" preset that drops a Wild Apricot-style coordinated cluster (safety CTA + compact search + social + sign-in + dropdown nav + tagline) into the header zone in one call.
- Add a typed `member_login` block with an `enable_bot_protection` toggle for ported Wild Apricot member zones, with source-style labels/icons and no custom CSS. (The actual reCAPTCHA/bot-protection enforcement is a Run402 platform hook — out of scope here, escalated separately.)
- `brand_header`: support a wordmark + separate favicon/icon mode instead of always prioritizing the icon, so ports can show a source wordmark and still set a favicon.
- Give `site_config.custom_css` a predictable override point: emit it inside a CSS `@layer` ordered after the framework layer so ports override without `!important`; fix the header `social_links` `opacity: 0` reveal default.
- Make ports self-aware: expose a discoverable registry of supported copied-site patterns so the porter's copy report can enumerate which source patterns it could not type-block and which fallback it used.
- Every new block is admin-editable (inline/list editor), themable via `--ky-*` tokens, translatable via `translatableFields`, and covered by visual-parity tests — the same template `image_accordion` and `shape_divider` already follow.

## Capabilities

### New Capabilities

<!-- None — every change is a copied-site fidelity requirement and extends the existing capability. -->

### Modified Capabilities

- `copied-theme-fidelity`: add requirements for the `feature_panels`, `menu`, `utility_bar`/`social_row`/`safety_cta` (+ utility-header preset), and `member_login` blocks; the `brand_header` wordmark+favicon mode; the predictable `custom_css` `@layer` override and `social_links` reveal default; and a supported-pattern self-report surface for the porter.

## Impact

- **Code**: `src/lib/blocks.ts` (register new `BlockType`s; `brand_header` picker), `src/lib/blocks/*` (new block render/hydrate/editor modules + the utility-header preset), `src/layouts/Portal.astro` (wrap `custom_css` in a `@layer`), `src/styles/*` (define the `@layer` order; `social_links` default), `src/seeds/*` (demo coverage for the new blocks), `tests/unit/*` (block-source + visual-parity tests). New block config is JSONB in `sections.config` — no new tables expected; `member_login` adds only a config flag.
- **Capabilities touched in passing (no requirement change)**: `composable-layout` (new block types slot into the zone/grid system), `inline-editing` (new editors), `i18n` (translatable fields), `config-driven-ui` (`--ky-*` theme tokens), `auth` (the `member_login` surface).
- **Cross-repo / out of scope**: the Run402 platform reCAPTCHA hook (#91) and the gateway error-envelope normalization (#113) both require a `kychee-com/run402` escalation; the report-emitting side of the self-report lives in `kychee-com/kychon-concierge`.
- **Pre-launch**: no users and no back-compat constraints. The custom-HTML/CSS escape hatch remains as the rare, honest, long-tail fallback (now with a predictable override point) but is no longer the path for these recurring patterns.
- **Resolves**: #124, #123, #99, #106, and the Kychon-side of #91.
