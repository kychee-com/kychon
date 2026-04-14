## 1. Biome Setup

- [x] 1.1 Install `@biomejs/biome` as devDependency
- [x] 1.2 Create `biome.json` with recommended rules, project-specific overrides (allow console.warn, 2-space indent, single quotes)
- [x] 1.3 Add `lint` and `format` scripts to `package.json`
- [x] 1.4 Run `biome format --write .` to format all existing code
- [x] 1.5 Fix any lint errors reported by `biome check .`
- [x] 1.6 Verify `npm run lint` passes with zero errors (3 warnings demoted intentionally)

## 2. JSDoc Type Checking

- [x] 2.1 Install `typescript` as devDependency (for `tsc --noEmit` only)
- [x] 2.2 Create `jsconfig.json` with `checkJs: true`, include core modules, exclude DOM-heavy pages
- [x] 2.3 Add `// @ts-check` and JSDoc annotations to `site/js/api.js`
- [x] 2.4 Add `// @ts-check` to `site/js/auth.js`
- [x] 2.5 Add `// @ts-check` and JSDoc annotations to `site/js/config.js`
- [x] 2.6 Add `// @ts-check` to `site/js/i18n.js`
- [x] 2.7 Add `typecheck` script to `package.json`
- [x] 2.8 Verify `npm run typecheck` passes with zero errors

## 3. GitHub Actions CI

- [x] 3.1 Create `.github/workflows/ci.yml` with Node 20, dependency caching, and three steps: test, lint, typecheck
- [x] 3.2 Push and verify the workflow runs on GitHub (passed in 25s)

## 4. Verification

- [x] 4.1 Run full quality suite locally: `npm test && npm run lint && npm run typecheck`
- [x] 4.2 Update `/deploy` skill to include lint + typecheck before deploy
