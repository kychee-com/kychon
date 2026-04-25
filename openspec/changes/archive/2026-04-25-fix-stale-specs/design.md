## Context

This is a spec-hygiene change. Two existing specs drifted from reality:

- `ci-pipeline/spec.md` was written when CI ran Node 20. The workflow was bumped to Node 22 (almost certainly when `engines.node >= 22` requirements landed via Astro, Vitest, or `@run402/sdk`); the spec was never updated to match.
- `marketing-deploy/spec.md` was written when the marketing site lived in this repo. Per saas-factory F12 the marketing site moved to `kychee-com/kychon-private`. The spec stayed behind as a stub describing a script and directory that no longer exist in this repo.

No design decisions to make — both fixes are mechanical.

## Goals / Non-Goals

**Goals:**

- Specs in `openspec/specs/` reflect what the system actually is on this branch.
- Future readers of `marketing-deploy/spec.md` are pointed at the right repo for implementation details.
- Future readers of `ci-pipeline/spec.md` see Node 22 and don't get confused.

**Non-Goals:**

- Changing CI behavior. The workflow is already on Node 22; no `.github/workflows/ci.yml` edit is part of this change.
- Migrating any code. There's no code in this repo for `marketing-deploy` to apply to.
- Rewriting the marketing-site implementation. That's the private repo's concern.
- Touching any other spec in `openspec/specs/`.

## Decisions

### Decision: REMOVE + ADD on `marketing-deploy`, not MODIFY

The four existing requirements (Dedicated Run402 project, Static-only deployment, Subdomain and domain configuration, Deploy script) prescribe specific commands (`run402 sites deploy`, `node marketing/deploy-marketing.js`) and a specific file path that doesn't exist in this repo. Modifying them in place would leave artificial-looking shells.

Instead: REMOVE all four with a clear reason + migration pointing at the private repo, and ADD a single new requirement that captures only what's observable from this repo (the marketing site is live, deployed elsewhere).

### Decision: simple MODIFY on `ci-pipeline`

The `CI uses Node 20 with caching` requirement is structurally fine; only the version number is wrong. MODIFY in place.

## Risks / Trade-offs

- **`marketing-deploy` archived → future agents may forget the cross-repo dependency exists.** Mitigated by leaving a stub requirement that explicitly references `kychon-private`.
- **Spec drift could happen again.** The proper long-term fix is having CI verify the workflow's Node version against the spec. Out of scope for this hygiene change; could be a separate follow-up if drift keeps happening.

## Migration Plan

1. Write the spec deltas under `openspec/changes/fix-stale-specs/specs/`.
2. Run `openspec archive fix-stale-specs` to apply the deltas to `openspec/specs/` and move the change to `openspec/changes/archive/`.
3. Commit + push.
4. Close [kychon#6](https://github.com/kychee-com/kychon/issues/6) and [kychon#9](https://github.com/kychee-com/kychon/issues/9) with the commit SHA.

No rollback complexity — `git revert` of the archive commit restores both specs.

## Open Questions

None.
