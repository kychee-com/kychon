## MODIFIED Requirements

### Requirement: Deploy uses Run402 v2.2 unified apply

The deploy entry point SHALL use an exact-pinned `@run402/sdk` version that supports the v1.48 / 2.x "Unified Apply" surface across both release writes and asset writes, with an in-runtime helper available for edge-function asset writes. For this change, the exact pin SHALL be `2.2.0` (the first 2.x release that ships `assets.put()` in `@run402/functions`; 2.0.0 / 2.0.1 / 2.1.0 are skipped — see [design.md](../../design.md) Decision 1). The deploy entry point SHALL invoke release writes through the scoped project sub-client (`r.project(id).apply(spec, opts)`); it SHALL NOT call the removed `r.deploy.apply()` or `r.apply()` surfaces.

Asset writes from deploy-time code SHALL use `r.project(id).assets.put(key, source, opts)` (single key), `r.project(id).assets.uploadDir(path, opts)` (Node directory batches), or `r.project(id).apply({ assets: { put: [...] } })` (when an asset write must flip atomically with a release). Asset writes from edge-function code SHALL use `assets.put(key, source, opts)` from `@run402/functions` — the in-runtime helper that the Run402 function runtime auto-injects. The legacy `initUploadSession`, `getUploadSession`, and `completeUploadSession` methods SHALL NOT be called — in 2.1.0+ they throw `LocalError` with explicit migration hints.

#### Scenario: SDK pin exposes unified apply
- **WHEN** a contributor installs dependencies from `package-lock.json`
- **THEN** `@run402/sdk` resolves to version `2.2.0`
- **AND** TypeScript accepts `(await r.project(id)).apply(spec, opts)` as the public release-write surface
- **AND** TypeScript accepts `(await r.project(id)).assets.put(key, source, opts)` as the public asset-write surface (deploy-time code)
- **AND** edge-function code accepts `assets.put(key, source, opts)` imported from `@run402/functions` as the public asset-write surface (with service-key auth injected by the runtime)
- **AND** `r.deploy.apply` is no longer callable from user code (the property is internal-only per the SDK's `_applyEngine` marker)

#### Scenario: SDK remains exact-pinned
- **WHEN** a dependency update changes `@run402/sdk`
- **THEN** the package manifest keeps an exact version string without `^` or `~`
- **AND** the change is reviewed as an intentional Run402 contract update

#### Scenario: Deploy uses scoped project sub-client for the apply call
- **WHEN** the deploy entry point assembles a `ReleaseSpec` and submits it
- **THEN** the submission goes through `(await r.project(projectId)).apply(spec, opts)`
- **AND** the spec retains its existing slices (`database`, `site` with `public_paths` explicit mode, `subdomains`, `routes`, optional `functions`)
- **AND** the spec MAY omit a top-level `project` field because the scope binds it

#### Scenario: Errors keep typed envelope
- **WHEN** the gateway rejects the apply (e.g. invalid migration, expired tier, malformed `public_paths` map)
- **THEN** the SDK throws a typed error subclass (`Run402DeployError`, `PaymentRequired`, `Unauthorized`, `ApiError`, `NetworkError`, or `LocalError`)
- **AND** the script's error formatter prints a human-readable diagnostic
- **AND** no downstream step runs as if the deploy had succeeded
