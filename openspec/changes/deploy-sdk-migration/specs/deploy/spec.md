## MODIFIED Requirements

### Requirement: Single-command deploy to Run402

The system SHALL provide a TypeScript deploy entry point at `scripts/deploy.ts` that assembles the Run402 bundle-deploy options from project files and invokes the `apps.bundleDeploy()` method of `@run402/sdk/node`. The options object SHALL include `migrations` (contents of `schema.sql` combined with the optional seed), `rls` configuration, `files` (site output), `functions` (edge functions with cron schedules), `subdomain`, and `inherit: true` for incremental file batches. The script SHALL be executed via `tsx`.

#### Scenario: Deploy from clean checkout
- **WHEN** a developer runs `npx tsx scripts/deploy.ts` with a valid Run402 project
- **THEN** the script reads all files under `dist/` (after `astro build`), all functions under `functions/`, `schema.sql`, and `seed.sql`
- **THEN** it assembles valid `BundleDeployOptions` and calls `r.apps.bundleDeploy(projectId, opts)` against the configured project
- **THEN** the site is accessible at `{subdomain}.run402.com`

#### Scenario: Re-deploy preserves existing data
- **WHEN** `npx tsx scripts/deploy.ts` is run against a project that already has data
- **THEN** migrations are idempotent (no data loss), site files are updated via `inherit: true`, functions are redeployed
- **THEN** the subdomain automatically points to the new deployment

#### Scenario: Typed errors surface contract violations
- **WHEN** the Run402 server rejects the request (e.g. invalid RLS template, expired tier, malformed migration)
- **THEN** the script catches `PaymentRequired`, `ApiError`, or `LocalError` from `@run402/sdk` and exits with a non-zero status and a human-readable diagnostic
- **THEN** no downstream step runs as if the deploy had succeeded

### Requirement: Deploy script reads project config

The deploy script SHALL resolve the target project id in this order: (1) `RUN402_PROJECT_ID` environment variable, (2) the active project returned by `r.projects.active()` via the SDK's Node credential provider. The subdomain SHALL be configurable via `SUBDOMAIN` environment variable or default to the project name.

#### Scenario: Project ID from environment
- **WHEN** `RUN402_PROJECT_ID` is set and `npx tsx scripts/deploy.ts` is run
- **THEN** the deploy targets that project ID

#### Scenario: Project ID from active project
- **WHEN** `RUN402_PROJECT_ID` is not set
- **THEN** the script calls `r.projects.active()` and uses the returned id
- **THEN** the script exits with a clear error if `active()` returns `null`

### Requirement: Deploy includes scheduled functions with cron

The deploy options SHALL include all edge functions with their cron schedules parsed from `// schedule:` comments. Required scheduled functions: `check-expirations` (`"0 8 * * *"`), `event-reminders` (`"0 * * * *"`), `moderate-content` (`"*/15 * * * *"`).

#### Scenario: Scheduled functions deployed
- **WHEN** `npx tsx scripts/deploy.ts` runs
- **THEN** the `functions` field of the bundle-deploy options includes `check-expirations` with `"0 8 * * *"`, `event-reminders` with `"0 * * * *"`, and `moderate-content` with `"*/15 * * * *"`

## ADDED Requirements

### Requirement: New Node tooling targeting Run402 uses @run402/sdk

New Node scripts or modules under `scripts/` (or elsewhere in this repo) that interact with the Run402 platform SHALL import from `@run402/sdk/node` and call typed SDK methods. New code SHALL NOT introduce `execSync('run402 …')` or equivalent subprocess shell-outs to the Run402 CLI. The one exception is the standalone `run402 functions deploy reset-demo` invocation in demo wrappers, retained because the reset-demo bundle exceeds current bundle-deploy size; this exception is documented and will be removed when the size constraint is lifted.

#### Scenario: New deploy helper uses the SDK
- **WHEN** a contributor adds a new Node helper that deploys or queries a Run402 project
- **THEN** the helper imports from `@run402/sdk/node`
- **THEN** code review rejects any new `execSync('run402 …')` call sites

### Requirement: @run402/sdk version is exact-pinned

The `devDependencies` entry for `@run402/sdk` SHALL use an exact-version specifier (e.g. `"1.44.0"`) rather than caret (`^`) or tilde (`~`). Bumping the pinned version SHALL be a deliberate code change reviewed on its own.

#### Scenario: Caret/tilde specifiers rejected
- **WHEN** a PR changes `@run402/sdk` in `package.json` to `^x.y.z` or `~x.y.z`
- **THEN** CI or a reviewer flags the change and the PR is updated to an exact-version pin

### Requirement: Deploy is single-shot via apps.bundleDeploy

The deploy script SHALL ship the entire bundle (migrations, RLS, functions, files, subdomain) in a single `apps.bundleDeploy()` call. No batching loop, no `sites.deploy()` follow-ups. This supersedes the earlier "batching preserved" requirement now that `@run402/sdk@1.44.0` removed the legacy `sites.deploy()` inline-bytes path (gateway returns 410 Gone) and `apps.bundleDeploy` accepts production-sized payloads (~50MB+) reliably.

#### Scenario: Single SDK call covers everything
- **WHEN** `npx tsx scripts/deploy.ts` runs against any project (production or demo)
- **THEN** the script issues exactly one `apps.bundleDeploy` HTTP call
- **THEN** that call carries the full migrations text, RLS template + tables, every function, every file, and the subdomain
- **THEN** no `sites.deploy()` follow-up is issued

#### Scenario: Demo deploys reuse the same entry point
- **WHEN** a demo wrapper (`demo/eagles/deploy.sh`, `demo/barrio-unido/deploy.sh`, `demo/silver-pines/deploy.sh`) runs the deploy step
- **THEN** it invokes `npx tsx scripts/deploy.ts` (with `SUBDOMAIN`, `SEED_FILE`, `EXCLUDE_FUNCTIONS` env vars), not a separate batched script
