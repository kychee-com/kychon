## Why

Two specs in `openspec/specs/` no longer reflect reality:

1. **`ci-pipeline`** requires Node 20 with caching, but `.github/workflows/ci.yml` actually uses Node 22 (and `@run402/sdk` requires `engines.node >= 22`, so we couldn't downgrade even if we wanted to). Caught while writing the `deploy-sdk-migration` change; tracked in [kychon#9](https://github.com/kychee-com/kychon/issues/9).
2. **`marketing-deploy`** describes a `marketing/deploy-marketing.js` script that lives in the sibling `kychee-com/kychon-private` repo (per saas-factory F12). The script and the `marketing/` directory aren't in this repo, so the existing requirements can't be tested, satisfied, or maintained from here. Tracked in [kychon#6](https://github.com/kychee-com/kychon/issues/6).

Both are factual corrections — no behavior changes, just bringing specs in sync with what the system actually is.

## What Changes

- **`ci-pipeline`**: bump the Node version requirement from 20 to 22 in the requirement title, prose, and scenario.
- **`marketing-deploy`**: replace the four implementation-prescriptive requirements (dedicated project, static-only deployment, subdomain/domain config, deploy script) with one cross-repo dependency requirement that documents only what's observable from this repo: kychon.com is live, deployed by the sibling `kychon-private` repo.

## Capabilities

### New Capabilities

<!-- None — modifying existing specs only. -->

### Modified Capabilities

- `ci-pipeline`: Node version requirement updated to 22; remainder of the spec unchanged.
- `marketing-deploy`: requirements rewritten to a cross-repo dependency note. The four implementation-detail requirements are removed (with reason + migration pointing at the private repo); one new cross-repo requirement is added in their place.

## Impact

- **Code**: no code changes. Spec edits only.
- **Specs**: `openspec/specs/ci-pipeline/spec.md` and `openspec/specs/marketing-deploy/spec.md` are updated when this change is archived.
- **Issues closed by this change**: [kychon#6](https://github.com/kychee-com/kychon/issues/6), [kychon#9](https://github.com/kychee-com/kychon/issues/9).
- **CI**: no impact. The CI workflow itself is already on Node 22; this just makes the spec match.
