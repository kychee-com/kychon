## ADDED Requirements

### Requirement: CI runs deploy smoke-test against a scratch project

The CI workflow SHALL include a `deploy-smoke-test` job that runs the TypeScript deploy script in dry-run mode against a dedicated scratch Run402 project on every push to `main`. The scratch project SHALL be separate from production projects (eagles, silver-pines, barrio, marketing) and its project id SHALL be held as a GitHub secret `RUN402_SMOKE_PROJECT_ID`. The job's allowance SHALL be written from a GitHub secret `RUN402_SMOKE_ALLOWANCE_JSON` to a tmpfile consumed by `@run402/sdk/node`'s `NodeRun402Options.allowancePath`.

#### Scenario: Smoke-test passes on a valid SDK contract
- **WHEN** code is pushed to `main` and the SDK contract is unchanged
- **THEN** the smoke-test job builds the deploy options, calls `apps.bundleDeploy` in dry-run mode against `RUN402_SMOKE_PROJECT_ID`, and exits with status 0
- **THEN** the resulting scratch deployment is cleaned up before the job exits

#### Scenario: Smoke-test catches SDK signature drift
- **WHEN** an `@run402/sdk` version bump introduces a signature or field change incompatible with our call sites
- **THEN** the smoke-test fails at the type-check step or at the `bundleDeploy` call
- **THEN** the failure blocks merge and surfaces in the PR status

#### Scenario: Smoke-test fails fast on scratch-project tier expiry
- **WHEN** the scratch project's tier lease has expired
- **THEN** the smoke-test job detects this before attempting the deploy (by checking `r.tier.status()` or catching `PaymentRequired` on the first SDK call)
- **THEN** the job fails with a human-readable message pointing the operator at renewing the scratch project's tier

### Requirement: Smoke-test uses the same script as production deploys

The `deploy-smoke-test` job SHALL invoke the same `scripts/deploy.ts` entry point production deploys use, differentiated only by the `--dry-run` flag (and the scratch project id from the secret). No forked or parallel codepath SHALL exist for smoke-testing.

#### Scenario: Production and smoke-test share the script
- **WHEN** a maintainer modifies `scripts/deploy.ts`
- **THEN** both production deploys and the smoke-test job exercise the same changed code on the next run
