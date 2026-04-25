## 1. Validate the deltas

- [x] 1.1 Run `openspec validate fix-stale-specs --strict` to ensure the delta files parse correctly
- [x] 1.2 Verify `openspec/specs/ci-pipeline/spec.md` currently contains the `Requirement: CI uses Node 20 with caching` block that the delta will MODIFY
- [x] 1.3 Verify `openspec/specs/marketing-deploy/spec.md` currently contains all four requirement blocks the delta will REMOVE

## 2. Apply via archive

- [x] 2.1 Run `openspec archive fix-stale-specs --yes` to apply the deltas to `openspec/specs/` and move the change to `openspec/changes/archive/`
- [x] 2.2 Confirm `openspec/specs/ci-pipeline/spec.md` now says "Node 22"
- [x] 2.3 Confirm `openspec/specs/marketing-deploy/spec.md` is the new cross-repo-dependency single-requirement form

## 3. Commit + close issues

- [x] 3.1 Commit the spec changes with a message referencing kychon#6 and kychon#9
- [x] 3.2 Push and verify CI green
- [x] 3.3 Close [kychon#6](https://github.com/kychee-com/kychon/issues/6) with the commit SHA
- [x] 3.4 Close [kychon#9](https://github.com/kychee-com/kychon/issues/9) with the commit SHA
