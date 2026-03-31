## Why

The project has 205 tests with 85% coverage thresholds, but zero linting, formatting, or type checking. Inconsistent code style, untyped function signatures, and no CI mean issues are only caught when something breaks at runtime. Adding quality tooling now — while the codebase is still small — prevents tech debt from compounding.

## What Changes

- **Biome** for linting and formatting. Single tool, zero-config, fast. Replaces the need for ESLint + Prettier. Added as a devDependency with a `biome.json` config.
- **JSDoc type checking** via `jsconfig.json` with `checkJs: true`. Adds `// @ts-check` to JS files and JSDoc type annotations where they help. TypeScript-level type safety without changing file extensions or adding a build step.
- **GitHub Actions CI** pipeline that runs on every push and PR: tests, lint, type check. Catches what's missed locally.

## Capabilities

### New Capabilities
- `biome-lint-format`: Biome configuration for linting and formatting all JS/HTML/CSS files with project-specific rules
- `jsconfig-type-check`: JSDoc-based type checking via jsconfig.json for vanilla JS files
- `ci-pipeline`: GitHub Actions workflow running tests, lint, and type checks on push/PR

### Modified Capabilities

(none — this is tooling, not feature behavior)

## Impact

- **New files:** `biome.json`, `jsconfig.json`, `.github/workflows/ci.yml`
- **New devDependency:** `@biomejs/biome`
- **Modified files:** JS files in `site/js/` get `// @ts-check` and JSDoc annotations for key functions
- **package.json:** new scripts (`lint`, `format`, `check`)
- **No runtime impact** — all changes are dev/CI tooling only
