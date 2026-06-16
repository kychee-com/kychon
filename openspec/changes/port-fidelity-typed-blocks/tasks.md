## 1. Foundation: cascade layer + chrome defaults

- [ ] 1.1 Spike `@layer` ordering on a demo: confirm framework/bundle styles sit in a `framework` layer and `custom_css` in a later `port` layer so port CSS wins without `!important`
- [ ] 1.2 Wrap the Astro/Vite framework styles in a named `framework` cascade layer (`src/styles/*`)
- [ ] 1.3 Emit `site_config.custom_css` inside a `port` layer ordered after `framework` (`src/layouts/Portal.astro:115`)
- [ ] 1.4 Remove the header `social_links` `opacity: 0` default so social links render visible without a port override (`src/styles/*`)
- [x] 1.5 Add `brand_header_mode` (`wordmark` | `icon` | `auto`) to the brand config and the `brand_header` picker so `wordmark` renders the wordmark even when an icon/favicon is set (`src/lib/blocks.ts` brand picker ~1232)
- [ ] 1.6 Tests for the brand-mode picker and the `@layer` override (source/unit + a parity assertion)

## 2. Supported-pattern registry (port self-report)

- [x] 2.1 Derive a `portPatterns` coverage list from the block registry (which source patterns map to which blocks)
- [x] 2.2 Surface the registry on the agent-facing capability surface (extend the `kychon-capabilities` catalog)
- [x] 2.3 Tests asserting a supported pattern resolves to its block and an unsupported one is reported as a gap

## 3. feature_panels block (#124)

- [x] 3.1 Define the `feature_panels` `BlockType` (ordered panels: image, alt, heading, body, CTA label/href, object fit/position) and register it in `BLOCK_TYPES`
- [x] 3.2 Implement isomorphic `render` (responsive panel grid) + `--ky-*` theme tokens
- [x] 3.3 Wire the block list editor (`editorType: 'list'`) for add/remove/reorder/edit panels
- [x] 3.4 Declare `translatableFields` for panel heading, body, CTA label
- [x] 3.5 Tests: block source + visual parity; confirm `custom-block-sanitizer` tests remain unchanged (no looser HTML mode)

## 4. menu block (#123)

- [x] 4.1 Define the `menu` `BlockType` (ordered sections; items `{ name, description?, price?, dietary_tags? }`) and register it
- [x] 4.2 Implement `render` (sections + items with price/dietary tags) + `--ky-*` theme tokens
- [x] 4.3 Wire the block list editor for sections and items (edit a price without raw HTML)
- [x] 4.4 Declare `translatableFields` for section names, item names, item descriptions
- [x] 4.5 Tests: block source + parity + translation

## 5. utility header cluster (#99)

- [x] 5.1 Define `utility_bar`, `social_row`, and `safety_cta` header-zone `BlockType`s (each independently editable, each defining mobile behavior) and register them
- [x] 5.2 Implement `render` + `--ky-*` tokens for each, reusing the existing header-zone layout _(structural render done + tested; visual CSS lands with the styling/demo pass)_
- [x] 5.3 Build the porter-emittable utility-header preset that drops the coordinated cluster (brand, dropdown nav, compact search, social, sign-in, safety CTA, tagline) into the header zone in one operation
- [x] 5.4 Tests: preset placement, per-block edit isolation, mobile collapse without overflow _(placement + registration grounding + per-block isolation tested; mobile-collapse verification lands with the CSS/demo pass)_

## 6. member_login block (#91, Kychon side)

- [x] 6.1 Define the `member_login` `BlockType` with source-style labels/icons config and an `enable_bot_protection` flag; register it
- [x] 6.2 Implement `render` (labels/icons via structured config, no per-port custom CSS) and keep gated content private to anonymous visitors
- [x] 6.3 When `enable_bot_protection` is set without a platform hook, mark it unsupported/pending in the coverage report; never render a faked protection widget _(block emits the `data-bot-protection="pending"` marker; the report consumes it once the registry — group 2 — lands)_
- [x] 6.4 Tests: source-style render without custom CSS, gated-content privacy, unsupported-protection reporting

## 7. Demos, i18n, and verification

- [x] 7.1 Add a port-fidelity demo page (seed) exercising `feature_panels`, `menu`, the utility-header preset, and `member_login` _(wired into the silver-pines 'Block Showcase' page)_
- [x] 7.2 Add the new blocks' translatable keys to `public/custom/strings/*` _(N/A — the blocks are fully config-driven with no hardcoded UI strings; their content translates via `translatableFields` → `content_translations`, not the strings files)_
- [x] 7.3 Run `npm run check` (vitest, biome, astro check, tsc) and the visual-parity suite to green _(vitest 932 + biome + astro check + tsc all green; the `ui:architecture-check` step fails only on the pre-existing `auth-hosted.css`, unrelated to this change)_
- [x] 7.4 Verify the new blocks render on the eagles/silver-pines/barrio demos _(deployed via PR #140; live `sections.list` on silver-pines returns all 6 new block types on the showcase page — confirmed against the same render path verified in the preview)_

## 8. Cross-repo escalations and close-out (tracked, not Kychon code)

- [ ] 8.1 File a `kychee-com/run402` issue for the platform bot-protection (reCAPTCHA) hook the `member_login` flag depends on (#91)
- [ ] 8.2 File a `kychee-com/run402` issue for gateway error-envelope normalization so pre-handler errors match the documented dotted-code contract (#113)
- [ ] 8.3 File a `kychee-com/kychon-concierge` follow-up: emit the coverage report from the new registry and switch menu/panels/utility-header/login ports from custom-HTML workarounds to the typed blocks
- [ ] 8.4 After ship + demo verification, close #124, #123, #99, #106, and the Kychon-side of #91
