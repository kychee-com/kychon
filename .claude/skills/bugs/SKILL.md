---
name: bugs
description: Automated bug triage and fix pipeline for Kychon. Fetches open GitHub Issues, performs root cause analysis, writes failing tests, fixes bugs in isolated worktrees, and deploys. Use when the user says /bugs, "check for bugs", "triage bugs", "work on the gh issues", or "fix production errors".
---

# /bugs — Triage, Fix, Deploy

Autonomous bug triage pipeline. Fetches all open GitHub issues, analyzes root causes, fixes what can be fixed, and deploys.

> Adapted from the run402 `bugs` skill. Differences: GitHub Issues only (Kychon has no Bugsnag), targets `kychee-com/kychon`, and uses Kychon's Vitest/Biome/Astro tooling + `deploy` skill. For *finding new* bugs and filing them as issues, use the `qa` skill instead — this skill triages and fixes issues that already exist.

Execute all steps in order. Do NOT ask for confirmation until Step 6.

## Step 1: Fetch all open issues

`gh issue list` defaults to **30 results** — without an explicit `--limit`, anything past the first 30 is silently dropped. Pass `--limit 1000` so the triage sees every open issue:

```
gh issue list --repo kychee-com/kychon --state open --limit 1000 --json number,title,body,labels,createdAt
```

After the fetch, sanity-check the count against the totals shown on the GitHub Issues tab. If you see exactly 30 (or 100, or another round number), suspect a hidden cap and re-run with a higher `--limit`.

Assign each bug an ID for reference throughout the pipeline: `GH-<number>` (using the actual issue number).

If zero issues found, report "No open bugs" and stop.

## Step 2: Root cause analysis

For each bug:

1. Read the issue title, body, and any labels
2. Trace through the source code — Kychon source lives in `src/` (Astro pages/components/lib), `functions/` (Run402 edge functions), and `scripts/` (deploy/seed tooling)
3. Check git log to see if the relevant code has already been changed
4. Categorize into exactly one bucket:

| Category | Criteria | Action |
|----------|----------|--------|
| `already-fixed` | Code already changed, or the issue can no longer be reproduced after a deploy | Close |
| `not-a-bug` | Expected behavior, transient infra blip, or user error | Close with explanation |
| `needs-spec-change` | "Bug" is actually missing functionality or a design decision | Flag as feature request — do NOT fix |
| `fixable` | Real code bug with a clear fix | Spawn fix agent |

Print a summary table as you go so progress is visible.

## Step 3: Close resolved bugs and flag feature requests

This step closes ONLY `already-fixed` and `not-a-bug` reports — bugs whose resolution is already in production. **Bugs in the `fixable` bucket are NEVER closed here** — their close happens in Step 7c, only after the new fix is deployed AND health-verified.

### Already-fixed / not-a-bug

Before closing an `already-fixed` bug, confirm the referenced commit is actually deployed. A push to `main` auto-deploys all demos via patchDeploy, so verify CI is green for that SHA (or a later one): `gh run list --repo kychee-com/kychon --branch main`. A merged-but-not-deployed fix is NOT a close criterion.

```
gh issue close <NUMBER> --repo kychee-com/kychon --comment "<one-line explanation>"
```

### Needs-spec-change

Add label and comment, do NOT close:

```
gh issue edit <NUMBER> --repo kychee-com/kychon --add-label "feature-request"
gh issue comment <NUMBER> --repo kychee-com/kychon --body "Triaged as feature request: <explanation>"
```

If no fixable bugs remain, skip to Step 5.

## Step 4: Fix bugs in isolated worktrees

For each fixable bug, launch an Agent tool call with `isolation: "worktree"`. Launch all fixable bugs in parallel (single message, multiple Agent tool calls).

Each agent prompt MUST be self-contained — include the literal issue details, file paths, and root cause analysis. The agent has no access to this conversation's context.

**Agent prompt template:**

> Fix bug {ID}: {issue title}
>
> Root cause: {analysis}
> Files: {file paths with line numbers}
>
> Steps:
> 1. Write a failing test in the appropriate `*.test.ts` file under `tests/unit/` or `tests/integration/` (Vitest — `import { describe, expect, it } from 'vitest'`, matching existing tests; happy-dom + fast-check are available)
> 2. Run the test to confirm it fails: `npx vitest run <test-file>`
> 3. Implement the fix in the source file (`src/`, `functions/`, or `scripts/`)
> 4. Run the test again to confirm it passes: `npx vitest run <test-file>`
> 5. Run `npx biome check .` from the repo root
> 6. Run `npx tsc --noEmit --project jsconfig.json` from the repo root
> 7. If all pass, commit with message: `fix(<scope>): <description>`
>    Add `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` to the commit.
>    **Do NOT include `Closes #N` / `Fixes #N` / `Resolves #N` trailers or any other GitHub close-keyword referencing the bug.** GitHub auto-closes those issues the moment the commit lands on `main`, and a push to `main` auto-deploys, so the close races the deploy and closes the bug before production verification — violating the after-deploy-only rule in Step 7c. Reference the issue with a bare `#N` link in the body if useful; close happens in Step 7c.
> 8. If any step fails, do NOT commit. Report what went wrong.
>
> IMPORTANT: Never use `$()` command substitution in shell commands. Run commands separately and use literal values.

If more than 10 fixable bugs are found, warn the user and suggest batching before spawning agents.

## Step 5: Report

After all agents complete (or if there were no fixable bugs), present the full report:

```
## Bug Triage Report

### Summary
- Total: N open issues
- Closed (already-fixed): N
- Closed (not-a-bug): N
- Feature requests (flagged): N
- Fixes ready: N
- Fix failures: N

### Fixes Ready to Merge
| ID | Title | Worktree Branch | Test | Lint | TSC |
|---|---|---|---|---|---|

### Failed Fixes (if any)
| ID | Title | What went wrong |
|---|---|---|

### Closed Bugs
| ID | Title | Reason |
|---|---|---|

### Feature Requests (not auto-fixed)
| ID | Title | Recommendation |
|---|---|---|
```

If there are no fixes to merge, stop here.

## Step 6: User decision

Use AskUserQuestion with these options:
- **Merge all** — merge all ready fixes, deploy, and close bugs
- **Exclude specific bugs** — let the user type which bug IDs to skip

Wait for the user's response before proceeding.

## Step 7: Merge, deploy, close

### 7a. Merge fix branches

For each included fix, the Agent tool with `isolation: "worktree"` returns the worktree path and branch name. Merge each branch:

```
git merge <branch-name> --no-edit
```

If a merge conflict occurs, stop and report which branches conflict. Let the user resolve manually.

### 7b. Deploy

Invoke the deploy skill:

```
Use the Skill tool: Skill(skill: "deploy")
```

This runs Kychon's full pipeline: quality checks (`npm run check`), commit, push, deploy to Run402, Chrome verification, and GitHub release. The push to `main` auto-deploys all 3 demos via patchDeploy; monitor CI to completion.

### 7c. Close fixed bugs

**Close ONLY after the deploy pipeline is live and verified in production.** Specifically, ALL of these must be true before issuing a single close command:

1. CI workflow status is `completed` with conclusion `success` for the pushed SHA on `kychee-com/kychon` (`gh run list --repo kychee-com/kychon --branch main`). Since the push auto-deploys all 3 demos, this covers the fleet.
2. The deploy skill's Chrome verification of the affected demo site(s) passed — the changed behavior is confirmed live, not just built.

CI green alone is NOT sufficient — a workflow can finish "success" before the new release is actually serving traffic. The live Chrome verification is what authorizes the close.

If any of those checks fail, the bug stays open. Investigate via the deploy skill's troubleshooting steps, fix forward, re-deploy, and retry the close only after verification passes against the new deploy.

```
gh issue close <NUMBER> --repo kychee-com/kychon --comment "Fixed and deployed in <commit-hash>"
```

If a GitHub issue was already auto-closed by a `Closes #N` trailer that slipped through Step 4 (despite the rule there), still validate the post-deploy checks above, then add a confirming comment via `gh issue comment <NUMBER>` — do NOT trust the auto-close as a deploy signal.

### 7d. Clean up

Excluded fix worktrees are kept (user can revisit). Merged worktrees are cleaned up automatically by the Agent tool.

Report final summary: which bugs were fixed, deployed, and closed.
