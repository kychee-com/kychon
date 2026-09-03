## Purpose

Embed blocks render third-party iframes only from a code-registered provider allowlist, and every Kychon page ships a Content Security Policy generated from that same registry so the browser enforces the allowlist independently.

## Requirements

### Requirement: Content Security Policy is enforced on every HTML response

Every Kychon project SHALL deliver a Content Security Policy on every HTML response. `public/_headers` is the source of truth for the directive list; because static-asset serving does not apply that file, the same generated value is also injected as a `<meta http-equiv="Content-Security-Policy">` element in `Portal.astro` for browser enforcement, and the resolved `_headers` file ships in the deploy bundle. The CSP SHALL include the following directives at minimum:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' https://esm.sh` (`unsafe-inline` and the esm.sh allowlist cover Tiptap's admin-only dynamic import)
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `img-src 'self' https: data:` (`data:` permits inline-SVG favicons)
- `font-src 'self' https://fonts.gstatic.com`
- `frame-src` listing every embed provider's host
- `connect-src 'self' https://*.run402.com https://esm.sh` (Run402 PostgREST + Tiptap module fetch)

The `frame-src` host list SHALL be generated from the embed-provider registry: `public/_headers` carries a `{PROVIDER_HOSTS}` placeholder that is substituted with the `frameAncestor` of every provider in `src/lib/blocks/embed-providers.ts`. Both the meta element and the bundled `_headers` file read the same template, so the two delivery surfaces cannot drift.

The deploy bundle SHALL also include `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()` in the `_headers` file. `Referrer-Policy` SHALL also be delivered via `<meta name="referrer">` so it is enforced without header support.

#### Scenario: Deployed site responds with CSP
- **WHEN** a user requests any HTML page from a deployed Kychon project
- **THEN** the response either includes a `Content-Security-Policy` HTTP header or contains a `<meta http-equiv="Content-Security-Policy">` element in the document head
- **THEN** the CSP value contains `default-src 'self'`
- **THEN** the CSP value includes `frame-src` with every registered provider's host

#### Scenario: Adding a provider extends frame-src automatically
- **WHEN** a developer adds a new provider entry to `src/lib/blocks/embed-providers.ts` with `frameAncestor: 'https://example.com'`
- **WHEN** the project is deployed
- **THEN** the deployed CSP's `frame-src` includes `https://example.com`

#### Scenario: Browser blocks unauthorized iframes
- **WHEN** a page contains an iframe pointing to a host not in the CSP `frame-src`
- **THEN** the browser refuses to load the iframe and reports a CSP violation in the console

#### Scenario: Other security headers ship with CSP
- **WHEN** a deployed Kychon project responds to an HTML request
- **THEN** the document head includes `<meta name="referrer" content="strict-origin-when-cross-origin">`
- **THEN** the deploy bundle's `_headers` file declares `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Requirement: Deploy validates CSP correctness

`validateCsp` SHALL run before bundling and SHALL fail (non-zero exit, clear actionable error) if:

- The `{PROVIDER_HOSTS}` placeholder is still unsubstituted.
- Any required directive (`default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `frame-src`, `connect-src`) is missing.
- Any required adjacent header (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) is missing.
- `frame-src` is missing the `frameAncestor` of any registered provider.
- A critical directive (`default-src`, `connect-src`, `frame-src`) uses `*`, or the CSP contains `'unsafe-eval'`.

The error message SHALL identify the specific directive and provider involved.

#### Scenario: Deploy fails with missing frame-src entry
- **WHEN** the deploy script runs and the generated CSP is missing a registered provider's `frameAncestor`
- **THEN** the script exits with a non-zero status
- **THEN** the error message names the provider id and the missing host

#### Scenario: Deploy fails on dangerous wildcards
- **WHEN** an editor introduces `*` into a critical directive (e.g. `frame-src *`)
- **THEN** the deploy script exits with a non-zero status

### Requirement: Embed providers are an allowlist registered as code

Embed-block iframe sources SHALL be restricted to the providers registered in `src/lib/blocks/embed-providers.ts`. Adding a new provider SHALL require a code change (one entry in the registry plus tests). The registry SHALL NOT be runtime-extensible. Each provider SHALL define:

- `id` (string, used as `config.provider`)
- `label` (display name)
- `buildSrc(params)` (pure function constructing the iframe URL from typed params)
- `paramsSchema` (declarative schema for the admin params form)
- `sandbox` (array of iframe `sandbox` tokens granted by this provider)
- `frameAncestor` (the CSP `frame-src` host)
- `defaultHeight` and `responsive` (rendering hints)
- `trustLevel` (`'verified'` for known-good providers, `'generic'` for the iframe escape hatch)

The renderer SHALL never accept admin-provided iframe HTML strings. It SHALL only construct iframe markup from `buildSrc` output and the provider's `sandbox` tokens.

#### Scenario: Registry covers the supported providers
- **WHEN** the registry is loaded
- **THEN** the providers `youtube`, `vimeo`, `calendly`, `map`, `weather`, `tide_chart`, `spotify`, `soundcloud`, `eventbrite`, `google_forms`, `typeform`, `mailchimp`, and `iframe` are present
- **THEN** every provider has all required fields populated

#### Scenario: Renderer refuses unknown providers
- **WHEN** an embed block has `config.provider = 'unknown'`
- **THEN** the renderer emits the embed error placeholder (does not emit any iframe)

#### Scenario: Sandbox attributes match provider declaration
- **WHEN** an embed block uses `provider = 'youtube'`
- **THEN** the rendered iframe has `sandbox="allow-scripts allow-same-origin allow-presentation"`
- **THEN** the rendered iframe has no extra sandbox tokens not declared by the provider

### Requirement: Generic iframe provider requires explicit trust acknowledgment

The `iframe` provider's `trustLevel` SHALL be `'generic'`. Embed blocks using this provider SHALL save with `config.trust_acknowledged: true` only after the admin explicitly checks an "I trust {hostname}" checkbox in the edit popover. The checkbox label SHALL include the hostname extracted from the `src` URL. The renderer SHALL emit the iframe ONLY when `trust_acknowledged === true`; otherwise it SHALL emit the embed error placeholder.

The admin overlay SHALL render an "External content" pill on every iframe-provider block; verified-provider blocks SHALL NOT carry this pill.

#### Scenario: Trust gate prevents save until checked
- **WHEN** an admin selects the iframe provider and enters a `src`
- **THEN** the Save button is disabled
- **WHEN** the admin checks the trust checkbox (which displays the URL's hostname)
- **THEN** the Save button becomes enabled

#### Scenario: Renderer enforces trust at render time
- **WHEN** an iframe-provider block is saved without `trust_acknowledged: true` (e.g. via direct DB edit)
- **THEN** the renderer emits the error placeholder rather than the iframe

#### Scenario: External content pill is admin-only
- **WHEN** an admin views a page with an iframe-provider embed
- **THEN** the section displays a small "External content" pill
- **WHEN** a non-admin views the same page
- **THEN** no pill is rendered

### Requirement: Iframe URL constructors validate scheme and structure

The `iframe` provider's `buildSrc({ src })` SHALL validate that `src` uses an allowed scheme (`https:` only by default; `http:` with a warning during admin save) and SHALL reject `javascript:`, `data:`, `vbscript:`, and unknown schemes by throwing. Other providers' `buildSrc` SHALL use the `URL` constructor and `URLSearchParams` (or equivalent) for URL construction so that admin params are correctly URL-encoded.

#### Scenario: Iframe provider rejects javascript: scheme
- **WHEN** an admin saves an iframe-provider block with `src = 'javascript:alert(1)'`
- **THEN** `buildSrc` throws and the renderer emits the embed error placeholder

#### Scenario: YouTube provider correctly encodes video_id
- **WHEN** a YouTube embed has `params.video_id = 'abc&xyz=evil'`
- **THEN** the constructed URL is `https://www.youtube.com/embed/abc%26xyz%3Devil` (correctly percent-encoded)
- **THEN** no query-string injection is possible
