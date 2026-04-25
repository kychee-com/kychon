## REMOVED Requirements

### Requirement: CI uses Node 20 with caching
**Reason**: The CI workflow uses Node.js 22 (matching `@run402/sdk`'s `engines.node >= 22` requirement and current Astro/Vitest baselines), not Node 20 as the original spec stated. Replaced by the new "CI uses Node 22 with caching" requirement below.
**Migration**: No code change needed — `.github/workflows/ci.yml` already uses `node-version: 22`. This is a spec-only correction.

## ADDED Requirements

### Requirement: CI uses Node 22 with caching

The CI workflow SHALL use Node.js 22 (matching `@run402/sdk`'s `engines.node` requirement and current Astro/Vitest baselines) and cache `node_modules` to speed up runs.

#### Scenario: CI completes in under 2 minutes
- **WHEN** the CI workflow runs with cached dependencies
- **THEN** the total runtime SHALL be under 2 minutes
