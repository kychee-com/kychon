## Context

Wild Lychee uses vanilla JS with no build step. All frontend code is in `site/js/*.js` (one file per page), edge functions in `functions/*.js`, and tests in `tests/`. There's no TypeScript, no bundler, no framework.

## Goals / Non-Goals

**Goals:**
- Consistent code style across all JS files without manual effort
- Type safety for key functions (API calls, config, auth) without converting to TypeScript
- CI that blocks merging broken code
- Fast — tooling should not slow down the dev loop

**Non-Goals:**
- Converting to TypeScript (conflicts with no-build-step philosophy)
- 100% type coverage (annotate where it helps, not everywhere)
- Pre-commit hooks (keep it simple — CI is the gate)
- Linting HTML content or SQL files

## Decisions

### D1: Biome over ESLint + Prettier

Biome is a single binary that lints and formats. No plugin ecosystem to manage, no config conflicts between ESLint and Prettier, 100x faster.

**Config approach:** Start with Biome's recommended rules. Disable rules that conflict with the project's style (e.g., allow `console.warn` in catch blocks). Format with tabs=2 spaces, single quotes, trailing commas.

**Alternatives considered:**
- ESLint + Prettier: More ecosystem but config complexity is high for a vanilla JS project.
- oxlint: Lint-only, no formatting.

### D2: JSDoc @ts-check over TypeScript

Add `// @ts-check` to each JS file and `jsconfig.json` with `"checkJs": true`. TypeScript's compiler checks the JS files using JSDoc annotations — no `.ts` files, no build step, no `tsc --build`.

**What to annotate:** Function parameters and return types for exported functions in `site/js/` (api.js, auth.js, config.js, i18n.js). Internal/private functions get annotated only when the types aren't obvious.

**Type check command:** `npx tsc --noEmit` (uses jsconfig.json).

**Alternatives considered:**
- Full TypeScript conversion: Requires a build step, contradicts project philosophy.
- No type checking: Misses bugs that tests don't cover (wrong argument types, missing properties).

### D3: GitHub Actions CI

Single workflow file at `.github/workflows/ci.yml`. Triggers on push to `main` and on PRs. Three jobs (or one job with sequential steps):

1. `npx vitest run` — tests
2. `npx biome check .` — lint + format check (no auto-fix, just fail)
3. `npx tsc --noEmit` — type check

Uses Node 20. Caches node_modules for speed.

## Risks / Trade-offs

**[Biome formatting churn]** → First `biome format --write` will touch many files. **Mitigation:** Do it in one commit ("format codebase with Biome") so the diff is isolated and reviewable.

**[JSDoc annotation effort]** → Adding `@ts-check` to existing files may surface many type errors. **Mitigation:** Start with the core modules (api.js, auth.js, config.js) and add `@ts-check` incrementally. Use `// @ts-ignore` sparingly for known-safe patterns that TypeScript can't infer.

**[CI minutes]** → GitHub Actions free tier has 2,000 minutes/month. Our pipeline is fast (~30s). **Mitigation:** Not a concern at this scale.
