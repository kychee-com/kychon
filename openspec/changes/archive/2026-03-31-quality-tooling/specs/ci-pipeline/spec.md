## ADDED Requirements

### Requirement: CI workflow runs on push and PR

A GitHub Actions workflow SHALL run on every push to `main` and on every pull request. The workflow SHALL execute tests, lint, and type checks.

#### Scenario: Push to main triggers CI
- **WHEN** code is pushed to the `main` branch
- **THEN** the CI workflow SHALL run all checks

#### Scenario: PR triggers CI
- **WHEN** a pull request is opened or updated
- **THEN** the CI workflow SHALL run all checks

### Requirement: CI runs tests

The CI workflow SHALL run `npx vitest run` and fail if any test fails.

#### Scenario: Tests pass in CI
- **WHEN** all tests pass
- **THEN** the test step SHALL succeed

#### Scenario: Test failure blocks CI
- **WHEN** any test fails
- **THEN** the CI workflow SHALL report failure

### Requirement: CI runs lint check

The CI workflow SHALL run `npx biome check .` and fail if any lint or format violation is found.

#### Scenario: Lint passes in CI
- **WHEN** code passes all lint and format rules
- **THEN** the lint step SHALL succeed

### Requirement: CI runs type check

The CI workflow SHALL run `npx tsc --noEmit` and fail if any type error is found.

#### Scenario: Type check passes in CI
- **WHEN** all JSDoc annotations are correct
- **THEN** the type check step SHALL succeed

### Requirement: CI uses Node 20 with caching

The CI workflow SHALL use Node.js 20 and cache `node_modules` to speed up runs.

#### Scenario: CI completes in under 2 minutes
- **WHEN** the CI workflow runs with cached dependencies
- **THEN** the total runtime SHALL be under 2 minutes
