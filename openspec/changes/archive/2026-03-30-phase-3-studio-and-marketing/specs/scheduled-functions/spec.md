## ADDED Requirements

### Requirement: Newsletter generation scheduled function

The system SHALL include a scheduled function `generate-newsletter.js` with cron schedule `0 9 * * 1` (Monday 9 AM). The function SHALL be deployed alongside existing scheduled functions (check-expirations, event-reminders) and follow the same cron comment convention for deploy.js parsing.

#### Scenario: Newsletter function deployed with cron schedule
- **WHEN** deploy.js processes `generate-newsletter.js`
- **THEN** the function SHALL be deployed with cron schedule `0 9 * * 1`

#### Scenario: Newsletter function coexists with existing functions
- **WHEN** all scheduled functions are deployed
- **THEN** `generate-newsletter.js`, `check-expirations.js`, `event-reminders.js`, `moderate-content.js`, and `translate-content.js` SHALL all be active with their respective schedules

### Requirement: Event recap on-demand function

The system SHALL include an edge function `generate-recap.js` that is invoked on-demand (not scheduled). It SHALL accept an event ID parameter and return the generated recap content.

#### Scenario: Recap function deployed as on-demand
- **WHEN** deploy.js processes `generate-recap.js`
- **THEN** the function SHALL be deployed as an invocable edge function without a cron schedule
