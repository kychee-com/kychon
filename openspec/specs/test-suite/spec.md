## ADDED Requirements

### Requirement: Unit tests for shared modules

The system SHALL have Vitest unit tests (Node environment) for `api.js`, `config.js`, `i18n.js`, `auth.js`, and format/validation helpers. Tests SHALL mock `fetch` and `localStorage` to test logic in isolation.

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

`tests/fixtures/` SHALL contain reusable mock data: `configs.js` (site_config variations) and `members.js` (sample member objects). Fixtures SHALL be importable by both unit and integration tests.

#### Scenario: Fixtures are consistent
- **WHEN** a test imports `configs.js`
- **THEN** it gets well-formed site_config objects that match the expected schema

### Requirement: Coverage threshold

`vitest.config.js` SHALL configure `@vitest/coverage-v8` with a minimum threshold of 85% on `site/js/**` files. `npm test` SHALL fail if coverage drops below this threshold.

#### Scenario: Coverage gate enforced
- **WHEN** `npm test` is run and coverage on `site/js/` is below 85%
- **THEN** the test run fails with a coverage error

<!-- Phase 2 additions -->
## ADDED Requirements

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

The test coverage threshold SHALL remain at 85% on `site/js/**` after adding all new modules.

#### Scenario: Coverage gate holds
- **WHEN** `npm test` is run with coverage
- **THEN** coverage on `site/js/` remains at or above 85%
