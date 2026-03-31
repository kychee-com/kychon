## ADDED Requirements

### Requirement: jsconfig.json enables type checking

The project SHALL have a `jsconfig.json` at the root with `"checkJs": true` and appropriate include/exclude paths. TypeScript SHALL be a devDependency for the `tsc --noEmit` type check command.

#### Scenario: jsconfig present with checkJs
- **WHEN** a developer opens the project in VS Code
- **THEN** JS files SHALL show type errors inline based on JSDoc annotations

### Requirement: Core modules have @ts-check and JSDoc annotations

The following files in `site/js/` SHALL have `// @ts-check` at the top and JSDoc type annotations on exported functions: `api.js`, `auth.js`, `config.js`, `i18n.js`. Annotations SHALL include parameter types and return types.

#### Scenario: api.js is type-checked
- **WHEN** `tsc --noEmit` runs
- **THEN** `site/js/api.js` SHALL be checked and pass without type errors

#### Scenario: auth.js is type-checked
- **WHEN** `tsc --noEmit` runs
- **THEN** `site/js/auth.js` SHALL be checked and pass without type errors

### Requirement: Type check command available

The project SHALL have an `npm run typecheck` script that runs `tsc --noEmit` and exits non-zero on type errors.

#### Scenario: Type check passes
- **WHEN** `npm run typecheck` is run on code with valid JSDoc annotations
- **THEN** the command SHALL exit with code 0

#### Scenario: Type check fails on errors
- **WHEN** a function is called with wrong argument types
- **THEN** `npm run typecheck` SHALL exit non-zero and report the error
