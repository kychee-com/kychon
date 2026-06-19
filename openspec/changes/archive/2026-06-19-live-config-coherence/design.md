## Context

Kychon renders portal chrome (header/footer zones, theme, branding, `custom_css`) with a **bake-then-rehydrate** model: `Portal.astro` bakes first-paint HTML from the active project's static typed seed / chrome snapshot ([chrome-bake.ts](../../../src/lib/chrome-bake.ts)), then client modules reconcile against the live `site_config` / `sections` DB on every load. Two of the three chrome inputs already reconcile:

- **Theme tokens** — [config.ts:507](../../../src/lib/config.ts) `init()` fetches live `site_config`, calls `applyTheme(theme)` + `applyBranding(config)` on both the cached and fresh passes, and re-applies on the `wl-config-changed` event. The full `THEME_CSS_VAR_MAP` / `COPIED_THEME_CSS_VAR_PATHS` (colors, nav, footer, social, font *vars*, radius, max_width) repaints from live DB with no rebuild.
- **Section blocks** — [page-render.ts:564](../../../src/lib/page-render.ts) re-renders all three zones from the live `sections` query.

`custom_css` is the outlier: it is read in exactly one place, sourced from the seed ([chrome-bake.ts:286](../../../src/lib/chrome-bake.ts) → injected once at [Portal.astro:115](../../../src/layouts/Portal.astro) into an **id-less** `<style>`), and nothing reads it back at runtime. A live `UPDATE site_config SET value=… WHERE key='custom_css'` persists but never renders — a silent no-op. A handful of theme artifacts are genuinely build-only for a different reason: the Google-Fonts `<link>` (`renderFontHead`) emits markup, and `color_scheme`/`motion` are baked into an inline `define:vars` script — neither has a runtime apply path, and a font-family change applies as a CSS var pointing at a never-loaded font.

The root cause is not the one missing field; it's that **"which config fields reconcile at runtime vs. need a rebuild" lives in code comments and human memory, with nothing structural preventing the next field from silently joining the baked-only set.**

## Goals / Non-Goals

**North star (the DX the design optimizes for):** an agent should be able to hold exactly one rule in its head — **"`site_config` is the live truth: write it, reload, see it."** Every field that obeys that rule is one less gotcha to remember; every exception must *announce itself at the point of edit* rather than fail silently. Decisions below are graded on whether they shrink the exception set and keep the verify loop closed.

**Goals:**
- Make live `custom_css` edits publish on reload with **no rebuild** (write-read coherence), by extending the existing bake-then-rehydrate pattern rather than inventing a new one.
- Keep cold first paint matching live config (no demo-brand flash) when deploying against a live project.
- Establish a **single machine-readable registry** of every chrome/theme `site_config` field's apply-mode (`runtime` | `redeploy`) with a reason, and **minimize the `redeploy` set** to its irreducible core.
- Add a **CI guard** — with a *guided, next-action* failure message — that makes "a baked-only field shipped without being declared `redeploy`" impossible (the "doesn't happen again" mechanism).
- Let an agent **discover** a field's apply-mode *where it edits* (a queryable artifact co-located with the served site, not docs-only), so build-only fields are reported as redeploy-required instead of silently ignored.

**Non-Goals:**
- run402 edge-side injection of live config into the first byte (the platform-owned alternative) — deferred.
- Making `color_scheme` / `motion` runtime-applicable. They must be inlined *before first paint* (they exist to prevent a flash), so they stay `redeploy` until edge-injection lands. The change only makes that status *declared and discoverable*, not silent. (Fonts, by contrast, **do** move to `runtime` — see Decision 4.)
- Any DB schema change, new table, or API/contract break.
- Changing the trust boundary of `custom_css` (admin/operator-authored today and after).

## Decisions

**1. Runtime reconciliation (Level 2) is the primary fix; build-from-live (Level 1) is the first-paint complement.**
`custom_css` joins theme tokens in `config.ts`: a new `applyCustomCss(siteConfig.custom_css)` runs next to `applyTheme`/`applyBranding` on the cached pass, the fresh pass, and the `wl-config-changed` revalidate, writing into a dedicated `<style id="wl-custom-css">`. The live `site_config` rows are *already fetched* — this adds one DOM write, no new network call.
- *Why over Level-1-only:* an agent's verify step is "load the page and look." If that costs a full rebuild (~2 min), the agent either burns turns waiting or — worse — **skips verification and reports a success it never confirmed.** A sub-second edit→reload loop against the same served URL is what makes the agent *actually verify*; runtime-primary doesn't just speed the loop, it determines whether the loop closes at all.
- *Why also do Level 1:* without it, every cold visit after an edit paints the stale baked CSS then repaints (FOUC). Build-from-live keeps steady-state first paint correct; the flash narrows to the window between an edit and the next rebuild — identical to how theme colors already behave.

**2. A typed field-editability registry is the single source of truth.**
One engine module (`src/lib/config-fields.ts`) exports, per chrome/theme `site_config` key, `{ key, applyMode: 'runtime' | 'redeploy', reason }`. The runtime reconciler, the build bake, the guard test, and both agent-facing affordance projections (Decision 3) all consult it.
- *Why over the status quo (comments + memory):* the scattered, implicit map is the literal root cause. A typed, enumerable registry is what lets the guard and the affordance exist at all.
- *Why a typed module over a DB table:* apply-mode is engine knowledge (a function of how the engine consumes a field), not tenant data. It ships and versions with the code that creates the dependency; a table would drift from the code independently. The registry stays the *source*; queryable surfaces are *generated* from it (Decision 3).

**3. The affordance is co-located with the edit, not docs-only — two projections from the one source.**
An agent has two archetypes: the *repo* agent (reads `src/lib`, STRUCTURE.md) and the *SQL/runtime* agent (edits `site_config` against a live portal, repo not in context). Docs serve only the first. By the principle of **locality — the affordance lives where the edit happens** — the registry is projected into two generated surfaces:
  - **`/config-fields.json`** emitted at build into `dist/`, so an agent operating against the live site can `GET` it next to the `site_config` it edits. Fully Kychon-side (a static artifact), no run402 involvement.
  - **STRUCTURE.md / CUSTOMIZING.md** note, for the repo agent.
- *Why not docs-only (the prior v1 call):* an agent doing `SELECT * FROM site_config` shouldn't have to *know to open a markdown file* to learn a field is redeploy-only. Co-locating the map with the data is the difference between discover-by-reading and learn-by-failing.

**4. Shrink the `redeploy` set to its irreducible core — fonts move to `runtime`.**
Every `redeploy` field is an exception to the north-star rule, so the design minimizes the set rather than parking everything build-only:
  - **Fonts → `runtime`.** `applyTheme` already sets `--font-heading`/`--font-body` from live config; it additionally ensures the Google-Fonts `<link>` exists at runtime when the family changes. With Level 1 covering cold paint, runtime font-injection only matters in the just-edited case — the *same* FOUC tradeoff already accepted for `custom_css`, so this is consistent, not a special case.
  - **`color_scheme` / `motion` stay `redeploy`.** They must be inlined *before first paint* (the value isn't available pre-paint without being baked, and their whole job is flash-prevention). These are the irreducible core; the registry's job shrinks to "here are the *only two* gotchas."

**5. The guard's failure message is a first-class deliverable — the codebase teaches the agent.**
The guard enumerates every `site_config` key the chrome bake consumes and asserts each is either runtime-reconciled or declared `redeploy`. Its DX value is almost entirely in *what it says on failure*: not `assertion failed`, but a guided next action — e.g. *"`site_config` field `x` is consumed at build (chrome-bake.ts) but isn't declared in config-fields.ts. Add `{ applyMode: 'runtime' | 'redeploy', reason }`, or wire a runtime apply path."* That converts a future agent's red suite into a guided repair.
- *Why over code review:* humans already missed this once (`custom_css` shipped baked-only for the life of the chrome-bake architecture). The guard converts a reviewer's vigilance into a mechanical, *self-explaining* check.

**6. New live fields follow the `applyTheme` shape — consistency as the cheapest delight.**
`applyCustomCss` deliberately mirrors `applyTheme`/`applyBranding`: same dedicated `#wl-…` element, same apply paths (cache / fresh / `wl-config-changed`), same registry declaration. An agent that learned how theme reconciles already knows how `custom_css` (and any future live field) reconciles — one pattern, not N. This is a stated rule for future changes, not an incidental similarity.

**7. `custom_css` runtime injection keeps the existing trust boundary.**
Only admins/operators write `site_config`; the value is already injected verbatim into a build-time `<style>`. Moving the same string into a runtime `<style id="wl-custom-css">` injects CSS (not executable script) and does not widen the trust boundary, so no new sanitization requirement is introduced — parity with today.

## Risks / Trade-offs

- **FOUC on cold visit when snapshot diverges from live `custom_css`** → Level 1 (build-from-live) keeps steady-state cold paint correct; the flash only exists between an edit and the next rebuild, matching the already-shipped theme-token behavior. Acceptable and bounded.
- **`custom_css` targeting baked chrome structure could momentarily mis-style during the cache→fresh swap** → the same swap window already exists for theme tokens; the dedicated `#wl-custom-css` element is updated in the same pass, so the window is no wider than today's.
- **Registry drift (someone adds a baked field, forgets to declare it)** → that exact failure is what the guard test (Decision 5) prevents; the test is the mitigation by construction.
- **Build-from-live fetch unavailable at deploy time** → registry-driven bake falls back to the static snapshot, preserving the current first-paint guarantee; no deploy is blocked by a transient config-API failure.
- **Runtime font `<link>` injection causes a FOUT on the just-edited cold visit** → identical bounded window to `custom_css` (Level 1 covers steady-state cold paint; the swap only fires when live differs from baked). `font-display` behavior is unchanged from today's baked `<link>`.
- **`/config-fields.json` drifting from the typed registry** → it is *generated* from `config-fields.ts` at build, never hand-authored; the guard can additionally assert the emitted JSON matches the module.
- **Per-load cost of `applyCustomCss` / font-link check** → one `textContent` write on a single `<style>` element (+ an idempotent `<link>` presence check) per load; negligible, same class as `applyTheme`.

## Migration Plan

Additive, no schema change, no data migration. Sequenced so the guard goes green by *declaring reality*, then each fix promotes a field:
1. Add the typed registry + guard test. Initially declare every chrome field at its honest current state — `custom_css` and fonts as `redeploy` (`custom_css` is the offending undeclared baked-only field today; the guard documents the bug), `color_scheme`/`motion` as `redeploy`.
2. Give the chrome `custom_css` `<style>` a stable `id="wl-custom-css"`; add `applyCustomCss` to `config.ts` on all config-apply paths. Flip `custom_css` → `runtime`; guard stays green.
3. Extend `applyTheme` to ensure the Google-Fonts `<link>` at runtime when the family changes. Flip fonts → `runtime`.
4. Add the build-from-live override in the chrome bake for registry-tracked fields, with snapshot fallback.
5. Emit `/config-fields.json` from the registry at build; reflect the registry into the agent docs.

**Rollback:** revert the commits; chrome reverts to baked-only behavior. No persisted state to unwind.

## Open Questions

- *(Resolved — implemented)* Build-from-live fetch reuses the runtime's `config.get` capability op via `@kychon/sdk` (mirroring `build-events.ts`), in `src/lib/build-config.ts`, invoked from `scripts/_lib.ts:runDeploy` (the deploy seam, not `bakeChrome`). The SDK is dynamically imported so the pure merge helper stays unit-testable without a built SDK.
- *(Resolved — Decision 3)* The affordance ships a queryable `/config-fields.json` co-located with the served site **and** the docs note, both generated from the typed registry. Not docs-only.
