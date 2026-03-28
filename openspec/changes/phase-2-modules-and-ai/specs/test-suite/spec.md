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
