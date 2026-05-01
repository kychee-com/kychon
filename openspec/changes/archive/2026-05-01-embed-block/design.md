## Context

Today's `default` section branch in `src/pages/index.astro` (and the equivalent in `page.astro`) renders `cfg.html` directly via `innerHTML`. Anyone with admin write access can paste any HTML, including `<script>` tags and arbitrary iframes pointing anywhere. The composable-layout substrate inherits this implicitly — its renderers don't sanitize.

This change introduces the first block type that has security-relevant behavior beyond config sanitization. Two things have to land together:

1. **An iframe-rendering block with a provider allowlist** — admins choose from known-good providers; the renderer constructs the URL from typed params; the iframe ships with conservative `sandbox` attributes.
2. **A CSP baseline** — the browser enforces what the renderer permits. Without CSP, even an allowlist-driven block can be bypassed by future code paths or compromised seeds. The two together are defense-in-depth.

Constraints driving this design:
- Run402 serves static assets and edge functions. Static assets get headers from a `public/_headers` file (or equivalent Run402 mechanism — to verify; see Decision 6). Functions can set their own headers.
- The deploy script (`scripts/deploy.ts`) is the right place to validate CSP correctness at build time so a malformed header doesn't break a deploy.
- Existing Kychon code uses inline scripts (Portal.astro's theme initializer, env.js bootstrap, several block renderers). v1 keeps `script-src 'unsafe-inline'` to avoid breaking these; tightening is a separate effort.
- Providers vary in their security posture. YouTube is well-behaved; the generic `iframe` is high-risk. Per-provider sandbox attributes encode this differential.

## Goals / Non-Goals

**Goals:**
- Admins can embed weather, tides, maps, video, and booking widgets without pasting raw HTML.
- The renderer constructs iframe `src` from typed params; admins never write URLs directly except in the generic `iframe` escape hatch.
- A CSP baseline is enforced on every Kychon deploy, listing the iframe `frame-src` domains needed by registered providers.
- The generic `iframe` provider is rate-limited by friction (a confirmation gate, a visible "External content" pill in admin UI) rather than disabled — flexibility for advanced admins, defaulted to safe.
- Adding a new provider is a single PR: one entry in the registry, one frame-src entry in the headers file, one set of sandbox defaults.

**Non-Goals:**
- Nonce or hash-based script-src. v1 keeps `'unsafe-inline'`. A separate change can tighten this once we audit and externalize all current inline scripts.
- A WAF or runtime CSP-violation reporter. We don't ship a `report-uri` endpoint in v1; CSP violations show in the browser console only.
- Sandboxing scripts inside iframes (e.g. iframe-isolation for first-party scripts). Out of scope; CSP covers the cross-origin case.
- Provider-side OAuth flows (e.g. embedding a private Google Calendar). v1 supports public embeds only; private embeds require provider-specific token handling tracked elsewhere.
- Removing `script-src 'unsafe-inline'`. We acknowledge this weakens script CSP; the trade-off vs. rewriting every existing inline script is unfavorable for v1.

## Decisions

### 1. Provider registry as a typed TS module

**Decision**: `src/lib/blocks/embed-providers.ts` exports:

```ts
export interface EmbedProvider {
  id: string;
  label: string;
  buildSrc: (params: Record<string, unknown>) => string;
  paramsSchema: Record<string, { type: 'text' | 'number' | 'select'; required?: boolean; options?: string[] }>;
  sandbox: string[];                  // tokens, e.g. ['allow-scripts', 'allow-same-origin']
  frameAncestor: string;              // hostname for CSP frame-src
  defaultHeight: string;              // e.g. '320px'
  responsive: boolean;                // true for video providers
  trustLevel: 'verified' | 'generic'; // 'generic' = the iframe escape hatch
}

export const PROVIDERS: Record<string, EmbedProvider> = {
  youtube: { /* ... */ },
  // ...
};
```

**Why TS over JSON**: same reasoning as composable-layout's seed modules. Type-safety on params validation, IDE refactor-friendliness, build-time errors for misconfigured providers. The registry is small (~250 LOC for seven providers).

**Why module-level constant and not a runtime DB table**: providers are vetted code. They include URL builders that must be reviewed before deploy. Adding a provider is a code change by design — that's the security model. A runtime DB-driven registry would let any admin add a provider, defeating the allowlist.

### 2. URL builder per provider

**Decision**: Each provider's `buildSrc(params)` is a pure function that constructs the iframe URL from typed params. Examples:

```ts
youtube: {
  buildSrc: ({ video_id, start, autoplay }) => {
    const url = new URL(`https://www.youtube.com/embed/${encodeURIComponent(video_id)}`);
    if (start) url.searchParams.set('start', String(start));
    if (autoplay) url.searchParams.set('autoplay', '1');
    return url.toString();
  },
  // ...
}

iframe: {
  buildSrc: ({ src }) => {
    // Validate scheme; never let the URL escape into javascript:, data:, or unknown schemes.
    const url = new URL(src);
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error(`Disallowed scheme: ${url.protocol}`);
    }
    return url.toString();
  },
  // ...
}
```

**Why server/build-time URL construction**: even allowlisted providers can be subverted if admins paste partial URLs. Constructing from params lets the provider enforce its own URL shape (e.g. youtube only allows `embed/<id>`, never arbitrary YouTube URLs). The renderer NEVER consumes admin-supplied URL strings except via `buildSrc`.

**Why throw and not return a fallback**: a malformed param indicates a programming or seeding error. Failing loudly at build time (or showing an error toast in admin) is correct. The block renderer wraps `buildSrc` in a try/catch and renders a visible error placeholder if construction fails.

### 3. Sandbox attributes per provider

**Decision**: each provider declares the iframe `sandbox` attribute it needs. The renderer emits exactly that — never more, never less.

| Provider | Sandbox tokens | Why |
|---|---|---|
| `youtube`, `vimeo` | `allow-scripts allow-same-origin allow-presentation` | Player needs scripts + same-origin XHR for analytics + presentation API for fullscreen |
| `weather` (OpenWeather widget) | `allow-scripts allow-same-origin` | Widget runs JS; needs same-origin for asset loading |
| `tide_chart` (NOAA) | `allow-scripts allow-same-origin allow-popups` | NOAA chart links open station detail pages |
| `map` (Google) | `allow-scripts allow-same-origin allow-popups allow-forms` | Maps' search box submits a form |
| `calendly` | `allow-scripts allow-same-origin allow-popups allow-forms` | Booking flow opens external pages, submits forms |
| `iframe` (generic) | `allow-scripts allow-same-origin` | Conservative default; admin can override with confirmation |

**Why distinct sandboxes per provider**: principle of least privilege. A YouTube embed should not be able to open popups; a Calendly embed legitimately needs to. Per-provider tokens enforce this.

**Why generic iframe gets `allow-scripts allow-same-origin`**: many useful generic embeds (weather widgets, custom dashboards) need both. Requiring further opt-in for these would friction-prevent legitimate use cases. The "I trust this source" gate is the friction point; once opted in, `allow-scripts allow-same-origin` is the floor.

### 4. CSP baseline via `public/_headers`

**Decision**: ship a `public/_headers` file (or equivalent Run402 static-asset headers config — to be verified at task time) defining the CSP for every served HTML page:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com; frame-src ${PROVIDER_HOSTS}; connect-src 'self' https://*.run402.com;
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`${PROVIDER_HOSTS}` is generated at build time from `embed-providers.ts` — the deploy script reads the registry's `frameAncestor` fields and emits them into the header.

**Why `script-src 'unsafe-inline'`**: today's Portal.astro has inline theme/cache initialization, and several block renderers use `<script>` blocks. Tightening to nonce-based scripts requires auditing every inline script and threading nonces through Astro's frontmatter — meaningful work, separate effort.

**Why `style-src 'unsafe-inline'`**: same reason. Astro emits inline styles for scoped CSS. Tightening requires Astro-config changes.

**Why `img-src 'self' https: data:`**: `data:` is needed for #64's inline favicon support. `https:` allows runtime-uploaded images from any HTTPS origin (Run402 storage URLs vary per project).

**Why no `report-uri`**: ships in a follow-up if/when we want CSP-violation telemetry.

### 5. CSP build-time validation

**Decision**: `scripts/deploy.ts` runs a small validator before bundling:

```ts
function validateCSP(headersFile: string): void {
  const csp = extractCSP(headersFile);
  if (!csp.includes("default-src 'self'")) throw new Error('Missing default-src baseline');
  if (!csp.includes('frame-src')) throw new Error('Missing frame-src directive');
  for (const provider of Object.values(PROVIDERS)) {
    if (!csp.includes(provider.frameAncestor)) {
      throw new Error(`Provider ${provider.id} requires frame-src ${provider.frameAncestor} but it is not in CSP`);
    }
  }
}
```

**Why fail at deploy and not at runtime**: a missing `frame-src` entry would result in invisible iframe failures on a deployed site (browser blocks the load; admin sees blank). Failing at deploy gives an actionable message at the point of change.

**Why deploy-time and not lint-time**: the deploy step already exists and runs on every push. Adding validation there is one more check; making it a separate lint step is more infra.

### 6. Run402 static-asset headers — verify the mechanism

**Decision (Phase 1.1 discovery, 2026-04-30)**: Run402 currently has **no** mechanism for custom HTTP response headers on static assets. Verified:

1. **`public/_headers` Netlify-style file** — NOT honored. A `_headers` file uploaded as part of the site bundle is treated as a regular static asset; requests to `/` and other paths return zero security headers (`curl -sI https://kychon.run402.com/` shows no `Content-Security-Policy`, `X-Frame-Options`, etc.).
2. **`r.deploy.apply()` options for headers** — NOT in the SDK. `SiteSpec` is `{ replace: FileSet } | { patch: ... }`; no `headers` field exists in `@run402/sdk@1.50.1`.
3. **Edge function for HTML serving** — possible but heavyweight (we'd have to take over HTML serving for the whole site to inject headers on every response).

The Run402 platform documentation (`llms.txt`, `llms-mcp.txt`, `documentation.md`) confirms there is no documented header-config mechanism. The gap is logged in the design notes (this section) for upstream escalation; until Run402 ships header config, the implementation uses **meta-tag delivery for the directives that support it**:

- **CSP**: shipped via `<meta http-equiv="Content-Security-Policy" content="...">` injected into `Portal.astro` at build time. Per the W3C CSP3 spec, the meta-element is a defined CSP delivery mechanism, equivalent to the response header for every directive used here (`default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `frame-src`, `connect-src`). The directives that meta does NOT support (`frame-ancestors`, `report-uri`, `sandbox`) are not used in our v1 baseline.
- **`Referrer-Policy`**: shipped via `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- **`X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`**: NOT meta-deliverable. These remain a platform gap; documented in `STRUCTURE.md` / `CUSTOMIZING.md` so adopters know the limit, and shipped in a `public/_headers` file that is bundled with the deploy and ready to be honored once Run402 (or a Cloudflare-fronted alternative) supports per-asset header config. The CSP validator runs against this file regardless, so the list stays in sync with the registered providers.

The CSP scenarios in `embed-security/spec.md` apply to this delivery: a request for any HTML page returns markup that includes the meta CSP, and the browser enforces it identically to the header form. The deploy-time validator validates the `_headers` file content (the source of truth for the directive list) and substitutes the same `{PROVIDER_HOSTS}` placeholder into both the meta tag and the `_headers` file. When Run402 starts honoring `_headers`, the only change is that the headers also start showing up on `curl -sI`; nothing in the security model needs to move.

**Why meta-tag CSP rather than wait for upstream**: shipping CSP enforcement now is high-value (the embed block needs the frame-src allowlist to be meaningful); waiting for the platform forces a slower roll-out. The W3C-spec'd meta delivery is sufficient for our directive set; the missing adjacent headers are defense-in-depth, not the primary control.

### 7. The "I trust this source" admin gate

**Decision**: The embed block's edit popover routes by provider. For all `verified` providers, no friction beyond filling in params. For `generic` (iframe), the popover renders:

```
┌──────────────────────────────────────────────┐
│ Provider: Generic iframe          (selector) │
│                                              │
│ Source URL: ___________________________      │
│                                              │
│ ⚠ External content                           │
│ This block embeds content from a source      │
│ Kychon hasn't verified. Visitors run any     │
│ scripts the source serves.                   │
│                                              │
│ [ ] I trust https://example.com              │
│                                              │
│        [Cancel]  [Save] (disabled until ☑)   │
└──────────────────────────────────────────────┘
```

The "I trust" checkbox label includes the URL's hostname so admins can't blindly check it for a different URL.

The block's saved `config` includes `trust_acknowledged: true`; absent that flag, the renderer SHALL refuse to emit the iframe (renders a "Block requires trust acknowledgment" placeholder). This is server-of-truth: even if someone hand-edits the DB, the renderer enforces.

**Why a checkbox and not a confirm dialog**: a dialog you can dismiss-and-redo without thinking; a checkbox makes the decision visible and auditable in the popover.

**Why hostname in the label**: prevents the "trust this source" muscle-memory hazard. The label changes based on the URL field, so muscle memory doesn't apply.

### 8. Admin UI: "External content" pill

**Decision**: blocks with `provider === 'iframe'` render a small "External content" pill in the admin overlay (not visible to non-admins). The pill is a visual cue that this block bypasses the provider allowlist.

Verified-provider blocks don't carry the pill — admins (and we) trust them.

### 9. Renderer error states

**Decision**: when `buildSrc` throws, when `trust_acknowledged` is false, or when CSP would block the embed (e.g. provider host missing from frame-src — should be caught at deploy but defense-in-depth), the renderer emits a visible placeholder:

```html
<section class="block-embed block-embed--error">
  <div class="block-embed__error">
    <strong>Embed unavailable</strong>
    <p>{specific reason}</p>
  </div>
</section>
```

Admin sees the error and can fix; visitors see a polite "this content unavailable" rather than a broken iframe.

## Risks / Trade-offs

### A. CSP `'unsafe-inline'` for scripts is a known weakness

We keep it because tightening means rewriting every inline script in the codebase. Mitigation: the rest of the CSP (default-src, frame-src, connect-src, img-src) provides meaningful defense even with inline scripts allowed. A future change can audit and externalize inline scripts; the framework is in place.

### B. Adding a new provider requires a deploy

Provider registry is build-time. Not a real downside — provider additions are inherently security review surfaces, so requiring a code change is correct.

### C. The generic `iframe` is still an attack surface

Even with sandbox + CSP frame-src, a malicious embed source can phish or fingerprint visitors. Mitigation: the trust gate, the visible "External content" pill, and the conservative sandbox. Admins who use the escape hatch should be senior; we make it discoverable but not casual.

### D. CSP can break legitimate features over time

Adding a new feature (e.g. a font from a different host, a new analytics endpoint) without updating the CSP will cause silent failures. Mitigation: a CSP-violations console panel for admin in development mode (a follow-up); the deploy-time validator catches missing frame-src entries for registered providers.

### E. Provider URL builders are points of trust

A bug in `buildSrc` (e.g. failing to URL-encode a param) could enable param injection. Mitigation: each builder uses `URL` API for construction (which encodes correctly); each has a unit test with hostile inputs. The `iframe` provider's protocol check is the most security-sensitive line and gets explicit test coverage.

### F. Demo CSP must permit demo-time conveniences

Some development-mode tooling injects scripts (e.g. astro's HMR). v1's CSP only applies to deployed (static) HTML; dev-server HTML doesn't go through `_headers`. This is fine — production is what matters; dev is a different configuration.

## Migration / Rollout

Order of operations:
1. Land CSP baseline (Phase 1) without the embed block. Verify all existing pages still work; fix any CSP violations surfacing from existing inline patterns. Update the headers file with `script-src 'unsafe-inline'` placeholder.
2. Land the provider registry + renderer (Phases 2-3). Embed block becomes available in the picker.
3. Land the admin composer + trust gate (Phase 4).
4. Land the deploy-time CSP validator (Phase 5).
5. Add demo embeds (Phase 6).
6. Re-run ODBC port (Phase 7) — verify weather + tide chart embeds render via registered providers, not raw HTML.
