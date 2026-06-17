## Context

Kychon's copy-website porter (in `kychee-com/kychon-concierge`) and Kychon Pro are coding agents; the product bet is best-in-class DX for them. The existing `copied-theme-fidelity` capability already promotes recurring source-site patterns from opaque custom-HTML workarounds to typed blocks — `image_accordion`, `shape_divider`, rich carousel — via a proven template: a `BlockType` in `src/lib/blocks.ts` (`render` + optional `hydrate` + `editorType` + `supportedSpans` + `translatableFields`), registered in the `BLOCK_TYPES` map, themed with `--ky-*` tokens, covered by visual-parity tests. This change is the next iteration of that capability. Pre-launch: no users, no back-compat to protect, so we choose the bold structured option at every fork.

## Goals / Non-Goals

**Goals:**
- Faithful ports need zero hand-rolled HTML/CSS for the covered patterns (homepage panels, menus, Wild Apricot utility header, member login).
- Every new surface is structured, agent-emittable, admin-editable, themable, and translatable.
- The custom-CSS fallback becomes predictable (no `!important` wars).
- Ports become self-aware: a discoverable registry of supported patterns the porter can report gaps against.

**Non-Goals:**
- A richer or looser custom-HTML escape hatch. The sanitizer stays locked.
- The Run402 platform reCAPTCHA hook and the gateway error-envelope normalization — cross-repo escalations to `kychee-com/run402`.
- The porter's report-emitting code (lives in `kychon-concierge`); here we only expose the registry it consults.
- New page types or new tables. Block config is JSONB in `sections.config`.

## Decisions

**D1 — #124 ships as a typed `feature_panels` block, not a scoped custom-HTML mode.**
Agents reason about structured config, not opaque HTML; this matches "the page IS the admin" and keeps the XSS-locked sanitizer (and its `custom-block-sanitizer` tests) intact. The porter already hand-remodels these panels into native blocks — we formalize that.
_Alternative considered:_ loosen the sanitizer to a class/tag allowlist for a "scoped custom-HTML" mode. Rejected — re-opens the XSS surface, yields un-editable/un-translatable content, and fights the agent-legible vision.

**D2 — #99 ships as composable header primitives + a porter preset (hybrid), not one monolithic block.**
The header zone is already data (`brand_header`/`nav`/`sign_in_bar`/`page_banner` compose through the layout engine). Small primitives (`utility_bar`, `social_row`, `safety_cta`) reuse that substrate, stay independently editable, and are reusable beyond the Wild Apricot case. A porter-emittable "utility header" preset drops the coordinated cluster in one call (the delightful agent affordance) while the admin still edits each piece inline.
_Alternative considered:_ one monolithic `utility_header` block with N slots. Rejected — a new mega-editor, less reusable/composable, harder to evolve slot-by-slot.

**D3 — #106 custom-CSS override ships as a CSS `@layer` ordered after the framework layer.**
Today `Portal.astro:115` injects a bare `<style>` whose precedence depends on document order vs the Astro/Vite bundle, forcing ports to use `!important`. Wrapping framework styles in a `framework` layer and `custom_css` in a later `port` layer makes port overrides win by layer order regardless of specificity — predictable, no `!important`.
_Alternative considered:_ inject `custom_css` last in `<head>` or bump its specificity. Rejected — order-injection is brittle (bundles can load async), and specificity hacks are exactly what we are removing.

**D4 — `brand_header` gets an explicit wordmark-vs-icon mode.**
The picker prioritizes `brand_icon_url` over `brand_wordmark_url` (`blocks.ts` ~1232), so setting both yields icon+text instead of the source wordmark. Add an explicit `brand_header_mode` (`wordmark` | `icon` | `auto`) so a port can show a wordmark and still set a favicon. (The anonymous-hydration half of this was already fixed via the #125 `config.get` brand-key allowlist.)
_Alternative considered:_ infer mode from which URLs are set. Rejected — the port set both deliberately; inference is the current ambiguous behavior.

**D5 — the self-report exposes a supported-pattern registry; it does not implement the porter's report.**
The porter runs in `kychon-concierge`. Kychon's honest contribution is a discoverable coverage manifest (the block registry already knows its types) so the porter can enumerate gaps + the fallback used. Keeps the cross-repo boundary clean.
_Alternative considered:_ generate the report inside Kychon. Rejected — wrong repo; Kychon does not run the port.

**D6 — `member_login` ships as a typed block + flag; reCAPTCHA is a platform escalation.**
The login surface is Run402-hosted, so bot-protection enforcement cannot live in Kychon. Ship the configurable block + an `enable_bot_protection` flag the platform can honor once the hook exists, and surface "unsupported" in the self-report until then.
_Alternative considered:_ client-side/faked reCAPTCHA. Rejected — dishonest and insecure.

## Risks / Trade-offs

- Sanitizer stays locked → some exotic source layouts still hit the custom-HTML fallback. → The `@layer` override makes that fallback predictable and the self-report makes it visible; typed blocks cover the recurring cases.
- `@layer` interaction with existing un-layered styles (un-layered always beats layered). → Put the Astro/Vite bundle into a `framework` layer and `custom_css` into a later `port` layer; spike against the three demos before relying on it.
- One change bundling 4 blocks + chrome edits is large. → Mitigated by the proven per-block template and a visual-parity test per block; tasks are independently checkable. Pre-launch, a single ship is preferred.
- `member_login` implies protection that is enforced externally. → Ship the flag + report "pending platform support"; never claim protection that is not wired.

## Migration Plan

- Additive and pre-launch: new block types, JSONB config fields, one `@layer` wrapper, a `brand_header_mode` field, and a coverage-registry surface. No destructive migrations; any column uses `... IF NOT EXISTS` (the `member_login` flag is config, likely no column).
- Rollback: blocks are opt-in (render only where seeded); the `@layer` wrapper is the only global-CSS edit — revert `Portal.astro` if it regresses the demos.
- Verify on eagles/silver-pines/barrio plus a new port-fidelity demo page that exercises every new block, with visual-parity tests.

## Open Questions

- Exact `@layer` ordering vs Astro's scoped component styles and any `!important` already present in port `custom_css` — needs a demo spike.
- Does `feature_panels` stand alone or subsume `features`/`promo_cards`? Lean standalone (panel = image + overlay + CTA, distinct from a features grid).
- Registry shape for the self-report: extend the agent-facing `kychon-capabilities.json` catalog with a `portPatterns` section, or a separate manifest?
