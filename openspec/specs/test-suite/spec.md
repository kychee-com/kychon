## Purpose

Kychon's test suite combines Vitest unit tests, happy-dom integration tests, fixtures, property-based checks, and coverage thresholds to protect shared modules and user-facing portal behavior.

## Requirements

### Requirement: Unit tests for shared modules

The system SHALL have Vitest unit tests for shared modules in `src/lib/`, including API, config, i18n, auth, and format/validation helpers. Tests SHALL mock `fetch` and `localStorage` to test logic in isolation.

#### Scenario: API wrapper tests
- **WHEN** `npm test` is run
- **THEN** unit tests verify that `api.js` correctly adds auth headers, handles 401 refresh, and parses JSON responses

#### Scenario: i18n tests
- **WHEN** `npm test` is run
- **THEN** unit tests verify `t()` translation, fallback to English, interpolation, and plural handling

### Requirement: Integration tests with happy-dom

The system SHALL have Vitest integration tests using `happy-dom` environment that test DOM rendering, config-driven UI, and page behavior. Tests SHALL load page HTML and verify DOM structure matches config.

#### Scenario: Nav renders from config
- **WHEN** an integration test loads a page with a specific `site_config` nav configuration
- **THEN** the rendered DOM contains the expected nav items with correct labels and hrefs

#### Scenario: Feature flag hides sections
- **WHEN** an integration test sets `feature_forum = false`
- **THEN** forum-related elements are not present in the DOM

### Requirement: Config permutation testing

The system SHALL use `fast-check` property-based tests to verify that random combinations of feature flags never cause the UI to crash (no uncaught exceptions, no undefined errors).

#### Scenario: Random feature flags don't crash
- **WHEN** `fast-check` generates random boolean values for all feature flags
- **THEN** `config.js` processes them without throwing exceptions
- **THEN** the nav renders with some subset of items (possibly empty)

### Requirement: Test fixtures

`tests/fixtures/` SHALL contain reusable mock data such as site_config variations and sample member objects. Fixtures SHALL be importable by both unit and integration tests and SHOULD use TypeScript types where they depend on Zod schemas.

#### Scenario: Fixtures are consistent
- **WHEN** a test imports `configs.js`
- **THEN** it gets well-formed site_config objects that match the expected schema

### Requirement: Coverage threshold

`vitest.config.js` SHALL configure `@vitest/coverage-v8` with a minimum threshold of 85% on `src/lib/**` and `src/schemas/**` files. `npm test` SHALL fail if coverage drops below this threshold.

#### Scenario: Coverage gate enforced
- **WHEN** `npm test` is run and coverage on `src/lib/` or `src/schemas/` is below 85%
- **THEN** the test run fails with a coverage error

<!-- Phase 2 additions -->
<!-- Phase 2 additions -->

### Requirement: Tests for events module

The test suite SHALL include unit tests for event RSVP logic and integration tests for event listing rendering, RSVP button state, and capacity display.

#### Scenario: Event tests pass
- **WHEN** `npm test` is run
- **THEN** event-related unit and integration tests pass

### Requirement: Tests for forum module

The test suite SHALL include integration tests for forum category listing, topic rendering, reply thread, and moderation controls (hidden content not shown to members).

#### Scenario: Forum tests pass
- **WHEN** `npm test` is run
- **THEN** forum rendering and moderation logic tests pass

### Requirement: Tests for AI feature logic

The test suite SHALL include unit tests for AI moderation classification parsing, translation storage logic, and insight generation logic. Tests SHALL mock the AI API calls.

#### Scenario: AI logic tests pass
- **WHEN** `npm test` is run
- **THEN** AI feature logic tests pass with mocked API responses

### Requirement: Coverage maintained at 85%+

The test coverage threshold SHALL remain at 85% on `src/lib/**` and `src/schemas/**` after adding all new modules.

#### Scenario: Coverage gate holds
- **WHEN** `npm test` is run with coverage
- **THEN** coverage on `src/lib/` and `src/schemas/` remains at or above 85%

### Requirement: Test file paths match Astro project structure

All tests SHALL import from Astro project paths such as `src/lib/` and `src/schemas/` instead of retired `site/js/` paths. Test organization SHOULD mirror the source structure across `tests/unit/`, `tests/integration/`, and `tests/fixtures/`.

#### Scenario: Tests pass after Astro migration
- **WHEN** `npm run test` executes
- **THEN** tests pass with updated import paths
- **AND** coverage remains at or above the configured threshold

### Requirement: Vitest configuration for Astro

The Vitest config SHALL resolve Astro project paths and support unit and happy-dom integration test projects. Coverage SHALL be measured against `src/lib/**` and `src/schemas/**`.

#### Scenario: Coverage threshold applies to new paths
- **WHEN** `npm run test -- --coverage` executes
- **THEN** coverage is measured against `src/lib/**` and `src/schemas/**`
- **AND** the run fails if coverage drops below 85%

### Requirement: Schema validation tests

The test suite SHALL include tests that verify Zod schemas correctly validate accepted data and reject malformed data.

#### Scenario: Schema test catches invalid data
- **WHEN** a test passes malformed data to `EventSchema.parse()`
- **THEN** the test verifies a ZodError or equivalent validation failure is thrown with the expected field information
