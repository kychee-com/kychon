## ADDED Requirements

### Requirement: Membership Expiration Reminders

The system SHALL run a daily scheduled function that checks for members whose membership expires in 7, 14, or 30 days. Each identified member SHALL receive an email reminder via the Run402 notification template.

#### Scenario: Member expiring in 7 days
- **WHEN** the daily expiration check runs and a member's membership expires in 7 days
- **THEN** the system SHALL send an expiration reminder email to that member using the Run402 notification template

#### Scenario: Member expiring in 14 days
- **WHEN** the daily expiration check runs and a member's membership expires in 14 days
- **THEN** the system SHALL send an expiration reminder email to that member using the Run402 notification template

#### Scenario: Member expiring in 30 days
- **WHEN** the daily expiration check runs and a member's membership expires in 30 days
- **THEN** the system SHALL send an expiration reminder email to that member using the Run402 notification template

#### Scenario: Member not near expiration
- **WHEN** the daily expiration check runs and a member's membership is not expiring in 7, 14, or 30 days
- **THEN** the system SHALL NOT send a reminder email to that member

### Requirement: Event Reminders

The system SHALL run an hourly scheduled function that identifies events starting within the next 1 hour and notifies all members who have RSVPd (going or maybe) to those events.

#### Scenario: Event starting within 1 hour with RSVPd members
- **WHEN** the hourly event reminder function runs and an event starts within 1 hour
- **THEN** all members with a going or maybe RSVP SHALL receive a reminder notification

#### Scenario: No events starting within 1 hour
- **WHEN** the hourly event reminder function runs and no events start within the next hour
- **THEN** no reminder notifications SHALL be sent

### Requirement: Cron Schedule Configuration

Scheduled functions SHALL use cron schedules parsed from comments in the function source files by deploy.js. Each scheduled function MUST declare its schedule as a comment that deploy.js can parse.

#### Scenario: deploy.js reads cron schedule from function comment
- **WHEN** deploy.js processes a scheduled function file containing a cron schedule comment
- **THEN** the function SHALL be deployed with the specified cron schedule

<!-- Phase 3 additions -->
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
