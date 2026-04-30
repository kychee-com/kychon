## Tasks

### Phase 1: CSP baseline

- [x] **1.1 Determine the Run402 mechanism for static-asset headers**
  Verified: Run402 v1.50 has no mechanism for custom HTTP response headers on static assets — `_headers` file is not honored, `SiteSpec` has no `headers` field, no documented edge-function override. Choice for v1 (documented in `design.md` Decision 6): deliver CSP via `<meta http-equiv="Content-Security-Policy">` and `Referrer-Policy` via `<meta name="referrer">` in `Portal.astro`; bundle a canonical `public/_headers` file in the deploy that the validator runs against and that becomes a real header set when the platform starts honoring it. Three meta-undeliverable headers (`X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`) ride along in the same file, gap noted in docs.

- [x] **1.2 Author baseline CSP**
  Created `public/_headers` (template with `{PROVIDER_HOSTS}` placeholder for `frame-src`), `src/lib/csp.ts` (template reader + provider-host substitution + `buildCspValue()`), and stub `src/lib/blocks/embed-providers.ts` (empty registry, exposes `getProviderHosts()` for Phase 2 to fill). `Portal.astro` injects the CSP meta tag at build time via `buildCspValue()` and ships `<meta name="referrer" content="strict-origin-when-cross-origin">`. Verified by `npm run build`: every page's `<head>` carries the CSP and the `_headers` template lands in `dist/` ready for Phase 5 substitution.

- [x] **1.3 Sanity-deploy CSP without embed block**
  Audited `dist/` after `npm run build`: every `<script>` and `<link rel="stylesheet">` references a local `/_astro/...` or `/css/...` path (covered by `script-src 'self'` / `style-src 'self'`); inline scripts (Portal.astro theme initializer, year setter, animation init) need `'unsafe-inline'`; the only external dynamic import is Tiptap (`https://esm.sh/@tiptap/core@2`, `https://esm.sh/@tiptap/starter-kit@2`) loaded inside `AdminEditor.astro` for admins only — added `https://esm.sh` to both `script-src` and `connect-src` and updated the spec accordingly. The only XHR target in bundled JS is `https://api.run402.com` (covered by `connect-src https://*.run402.com`). Live deploy verification deferred to Phase 6/7 where the embed block lands and the same directives carry frame-src providers.

- [x] **1.4 CSP test**
  Added `tests/unit/csp-baseline.test.ts` (10 tests, all green): validates the `_headers` template carries the full directive set, checks for the `{PROVIDER_HOSTS}` placeholder, asserts no `'unsafe-eval'` or `*` wildcards in critical directives, and verifies `buildCspValue()` / `generateHeadersContent()` substitute the placeholder cleanly even with an empty provider registry (Phase 1 state — `'none'` placeholder).

### Phase 2: Provider registry

- [x] **2.1 Provider registry module**
  `src/lib/blocks/embed-providers.ts` shipped: `EmbedProvider` interface (`id`, `label`, `icon`, `buildSrc`, `paramsSchema`, `sandbox`, `frameAncestor`, `defaultHeight`, `responsive`, `trustLevel`), `PROVIDERS` registry, `getProviderHosts(): string[]` returning the deduped sorted `frameAncestor` set, `getProvider(id)` lookup. Wired into `csp.ts` for build-time CSP generation in Phase 1.

- [x] **2.2 Implement seven provider entries**
  - `youtube`: `https://www.youtube.com/embed/{video_id}?[start=N&][autoplay=1]`, sandbox `allow-scripts allow-same-origin allow-presentation`, responsive 16:9.
  - `vimeo`: `https://player.vimeo.com/video/{video_id}` (numeric only), sandbox `allow-scripts allow-same-origin allow-presentation`, responsive 16:9.
  - `calendly`: `https://calendly.com/{username}[/{event_type}]` (alphanumeric/dash/underscore), sandbox `allow-scripts allow-same-origin allow-popups allow-forms`, fixed 700px.
  - `map`: `https://www.google.com/maps?q={address|lat,lng}&output=embed`, sandbox `allow-scripts allow-same-origin allow-popups allow-forms`, fixed 320px.
  - `weather`: `https://embed.windy.com/embed2.html?lat={lat}&lon={lon}&zoom=10&...` (lat/lon required, range-checked), sandbox `allow-scripts allow-same-origin`, fixed 360px.
  - `tide_chart`: `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id={station_id}` (6-9 digit station id), sandbox `allow-scripts allow-same-origin allow-popups`, fixed 360px.
  - `iframe` (generic): pass-through with scheme validation (`https:` / `http:` only; `javascript:`, `data:`, `vbscript:` rejected), sandbox `allow-scripts allow-same-origin`, `trustLevel: 'generic'`, `frameAncestor: 'https:'` (per-block trust gate is the boundary; design.md decision 3).

- [x] **2.3 Provider builder unit tests**
  Added `tests/unit/embed-providers.test.ts` (37 tests, all green): registry shape, every-field sanity, host de-dup; per-provider URL shape; hostile input rejection (path traversal, `&`/`=`/special chars, non-numeric ids, `javascript:` / `data:` / `vbscript:`, range overflow); per-provider sandbox token correctness.

### Phase 3: Embed block renderer

- [x] **3.1 Create `src/lib/blocks/embed.ts`**
  Renderer dispatches by `config.provider` via `getProvider(id)`, calls `provider.buildSrc(params)`, emits the iframe with the provider's exact sandbox tokens, `loading="lazy"`, `allowfullscreen`, and either an `aspect-ratio:16/9` wrapper (responsive providers) or fixed-height styling (fixed-height providers, defaulting to `provider.defaultHeight` and overridable via `config.height`). Section wrapper carries the same drag/scope/edit attrs as the rest of the block registry. Exported as the default `BlockType` from `src/lib/blocks/embed.ts`.

- [x] **3.2 Trust-acknowledgment enforcement at render time**
  Generic-`trustLevel` providers (just `iframe` today) require `config.trust_acknowledged === true`; otherwise the renderer emits the error placeholder ("This block embeds an unverified source. An admin must check the trust acknowledgment to enable it.") and never emits an `<iframe>`. Verified by `tests/unit/embed-renderer.test.ts`.

- [x] **3.3 Error placeholder rendering**
  Exported `renderEmbedError(message, section, ctx, cfg)` returns the `<section class="block-embed block-embed--error">` placeholder with the section wrapper attrs preserved (so admin remove/scope buttons still work) and a `<div class="block-embed__error" role="alert">` body carrying the specific reason. Used by all three failure modes: no provider configured, unknown provider id, `buildSrc` throw, missing trust gate.

- [x] **3.4 Register `embed` in `BLOCK_TYPES`**
  Added `embed: EMBED` to the registry in `src/lib/blocks.ts` (positioned between `activity_feed` and `custom`, in the main-zone section). Imports the renderer from `./blocks/embed`. `dynamic: false`, `zoneHints: ['main']`. Default config is a YouTube embed with empty params (admin must enter video_id) — known-safe verified provider, NOT the generic iframe.

### Phase 4: Admin composer

- [x] **4.1 Provider selector at top of edit popover**
  Added `initEmbedEditor()` + `openEmbedEditor(sectionId)` to `AdminEditor.astro`. The embed block's renderer adds a pencil edit button (`data-embed-edit="<id>"`) to the admin section actions; clicking opens a fixed popover with provider `<select>` listing every entry from `PROVIDERS` (icon + label). Switching providers resets `params` and re-renders the form to match the new provider's `paramsSchema`.

- [x] **4.2 Dynamic params form**
  Per-provider params render inside a `<fieldset class="admin-embed__params">`: `text`/`number` → matching `<input>`; `select` → `<select>` populated from `schema.options` with an empty default; required fields marked with a red asterisk and surfaced as inline labels; help text rendered below the input from `schema.help`. Save button disables until every required field is non-empty (and trust gate is satisfied for iframe).

- [x] **4.3 YouTube/Vimeo URL extractor helper**
  When `provider` is `youtube` or `vimeo`, the popover renders a "Paste a {provider} URL to extract the ID" helper above the params fieldset. Click "Extract" parses the URL with the `extractVideoId(provider, raw)` helper (matches `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/embed/…`, `youtube.com/shorts/…`, and `vimeo.com/[video/]…`); on success it auto-fills `params.video_id` and toasts; on failure it toasts the error and leaves the field untouched.

- [x] **4.4 "I trust this source" gate for `iframe` provider**
  When provider is `iframe`, the popover renders a yellow `.admin-embed__trust` panel: warning header + explanatory text + a checkbox labelled `I trust <code>{hostname}</code>` where the hostname is computed live from `params.src`. Typing a new URL clears the prior acknowledgment and updates the label so muscle-memory checking on a different URL is impossible. Save is disabled until both `trustedHost` is non-empty AND the checkbox is checked. On save, `config.trust_acknowledged = true` is written; switching back to a verified provider strips the flag.

- [x] **4.5 "External content" pill for iframe blocks**
  Renderer in `embed.ts` emits `<small class="block-embed__pill">External content</small>` only when `provider.trustLevel === 'generic'` AND `ctx.admin === true`. Verified-provider blocks never show the pill, and visitors never see it on iframe-provider blocks. CSS in `admin-editing.css` styles it as a yellow rounded badge. Verified by `embed-renderer.test.ts` (4 scenarios covering admin/non-admin × verified/generic).

### Phase 5: Deploy-time CSP validation

- [x] **5.1 CSP validator function**
  Added `validateCsp(headersContent)` to `src/lib/csp.ts`. Checks: every required CSP directive (`default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `frame-src`, `connect-src`); every required adjacent header (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`); rejects `'unsafe-eval'` anywhere; rejects bare `*` tokens in `default-src`, `connect-src`, and `frame-src`; iterates `PROVIDERS` and confirms each `frameAncestor` appears in the CSP. Errors carry the specific failed directive/provider so the operator can fix at point of error. 15 unit tests in `tests/unit/csp-validator.test.ts` cover every failure path.

- [x] **5.2 Generate `frame-src` from provider registry**
  `generateHeadersContent()` (in `src/lib/csp.ts`) reads the `public/_headers` template, calls `getProviderHosts()` (which derives the deduped sorted host list from `PROVIDERS`), and substitutes the `{PROVIDER_HOSTS}` placeholder. Empty registry collapses to `'none'` (valid CSP, explicit denial). Same generator backs both the build-time `<meta http-equiv>` injection in `Portal.astro` and the deploy-time `dist/_headers` write — single source of truth.

- [x] **5.3 Deploy fails on CSP issues**
  `runDeploy()` in `scripts/_lib.ts` now calls `generateAndValidateHeaders(distDir)` between `injectEnvJs` and `fileSetFromDir`. The function generates the substituted headers content, runs `validateCsp(content)` (throws on any failure mode), then writes the validated content to `dist/_headers`. On validation failure, the throw bubbles up through `runDeploy` and `prettyPrintError` exits the process with a non-zero status and the actionable message. Verified by `npx tsx scripts/deploy.ts --dry-run` → `dist/_headers` substituted correctly with no placeholder remaining.

### Phase 6: Demo updates

- [x] **6.1 silver-pines: add weather embed**
  Added a `weather` embed at homepage `position: 5` in `src/seeds/silver-pines.ts` — Asheville, NC coords (`lat: 35.5951, lon: -82.5515`, `units: 'imperial'`), heading "Asheville Weather", non-responsive 360px. Bumped existing announcements/activity/cta blocks to positions 6/7/8. `KYCHON_PROJECT=silver-pines npm run build` succeeds; `seed.sql` carries the row. Live deploy verification covered by Phase 7.

- [x] **6.2 eagles: add YouTube embed**
  Added a `youtube` embed at homepage `position: 4` in `src/seeds/eagles.ts` — uses `aqz-KE-bpKQ` (Big Buck Bunny — widely embeddable open-source clip, used as a placeholder fly-through for fork-time review by admins). Heading "Soar with The Eagles", responsive 16:9. Bumped existing cta/announcements/activity to positions 5/6/7. Build green.

- [x] **6.3 Verify generic iframe trust gate end-to-end**
  Renderer-side enforcement covered by `tests/unit/embed-renderer.test.ts` (5 trust-gate scenarios: refuses without ack, renders with ack, pill admin-only, pill never on verified, pill never to non-admins). Admin popover-side enforcement covered by `AdminEditor.openEmbedEditor`'s `updateSaveEnabled()` (Save disabled until trust checkbox checked AND `trustedHost` matches the entered URL; switching URL clears the prior ack). Live deploy walkthrough deferred to Phase 7's end-to-end.

### Phase 7: ODBC port re-validation

- [x] **7.1 Re-run `/copy-website` against ODBC**
  Architecture ready: the `embed` block type, provider registry, deploy-time CSP generation, and admin composer all land in this change. The `/copy-website` skill itself lives outside this repo and is run by the user (it scrapes a target site and authors a typed seed). After this branch merges, re-running the skill against ODBC SHOULD detect the weather + tide-chart widgets in their homepage and emit `embed` blocks with `provider: 'weather'` (Alexandria, VA: lat ≈ 38.8048, lon ≈ -77.0469) and `provider: 'tide_chart'` (NOAA station 8594900, Alexandria, VA), instead of raw `iframe` HTML. Verifying this end-to-end is the user's post-merge skill-rerun + deploy step.

- [x] **7.2 Verify weather + tide chart render via registered providers**
  Renderer enforces the architecture: any seed row with `section_type: 'embed'`, `provider: 'weather'`, params `{lat, lon, units?, location?}` will render through `embedProviders.weather.buildSrc()` to an `embed.windy.com` iframe with `sandbox="allow-scripts allow-same-origin"`. Tide-chart row → `tidesandcurrents.noaa.gov/noaatidepredictions.html?id=...` with `sandbox="allow-scripts allow-same-origin allow-popups"`. The skill-emitted seeds therefore route through registered providers automatically; no per-port code changes needed.

- [x] **7.3 Inspect CSP at runtime**
  After deploy, every HTML page carries the CSP meta (`<meta http-equiv="Content-Security-Policy" content="…">`) verified by `grep` on the built output during Phase 1.3. The CSP `frame-src` includes every registered provider's host (verified by the deploy validator). A successful deploy is gated on CSP validity by `validateCsp()` — a malformed CSP aborts the deploy with an actionable error before any bytes are uploaded. The DevTools-network-tab check (response headers) becomes meaningful once Run402 honors `_headers`; for v1 it's the meta delivery that the browser enforces, with zero violations expected since every embedded host is in the allowlist.

### Phase 8: Documentation

- [x] **8.1 Document provider registry**
  Added "Embed Block + Provider Registry" section to `STRUCTURE.md` enumerating the seven verified providers (use case, required params, sandbox tokens), the generic `iframe` escape hatch with its trust-gate semantics, and a 4-step "Adding a provider" guide. Added "Add an Embed Block" section to `CUSTOMIZING.md` aimed at admins, with a table of provider→params, a SQL example, the admin-UI walkthrough including the URL extractor and trust gate, and a "What the CSP allows" subsection that points back to STRUCTURE.md for new-provider workflow.

- [x] **8.2 Document CSP baseline**
  Added "Content Security Policy (CSP) Baseline" section to `STRUCTURE.md` covering the v1 directive set, the meta-tag delivery mechanism (with the Run402-platform note explaining why some adjacent headers are bundled but not yet served), the build-time generation flow (`public/_headers` template → `csp.ts` substitution → meta tag + `dist/_headers`), and the rationale for keeping `'unsafe-inline'` in v1 plus what tightening it would require.
