## MODIFIED Requirements

### Requirement: Test file paths match new project structure
All test files SHALL import from the new Astro project paths (`src/lib/`, `src/schemas/`, etc.) instead of the old paths (`site/js/`). Test file organization SHALL mirror the source structure:

```
tests/
├── unit/
│   ├── api.test.ts          (tests src/lib/api.ts)
│   ├── i18n.test.ts         (tests src/lib/i18n.ts)
│   ├── auth.test.ts         (tests src/lib/auth.ts)
│   ├── schemas.test.ts      (tests src/schemas/*.ts)
│   └── ...
├── integration/
│   ├── config-ui.test.ts    (tests ConfigProvider behavior)
│   ├── events.test.ts       (tests EventList island)
│   ├── forum.test.ts        (tests Forum island)
│   └── ...
└── fixtures/
    ├── configs.ts
    ├── members.ts
    └── ...
```

#### Scenario: Tests pass after migration
- **WHEN** `npm run test` executes
- **THEN** all existing tests pass with updated import paths
- **AND** coverage remains at or above 85% threshold

#### Scenario: Test fixtures in TypeScript
- **WHEN** test fixtures are loaded
- **THEN** they use TypeScript types matching the Zod schemas
- **AND** type errors in fixtures are caught at build time

### Requirement: Vitest configuration for Astro
The vitest config SHALL be updated to resolve Astro project paths and handle `.astro` file imports in tests. The coverage threshold of 85% SHALL apply to `src/lib/**` and `src/schemas/**` (replacing `site/js/**`).

#### Scenario: Coverage threshold applies to new paths
- **WHEN** `npm run test -- --coverage` executes
- **THEN** coverage is measured against `src/lib/**` and `src/schemas/**`
- **AND** the build fails if coverage drops below 85%

### Requirement: Schema validation tests
New tests SHALL verify that Zod schemas correctly validate and reject data. Each schema in `src/schemas/` SHALL have corresponding test cases.

#### Scenario: Schema test catches invalid data
- **WHEN** a test passes malformed data to `EventSchema.parse()`
- **THEN** the test verifies a ZodError is thrown with the expected field errors
