## MODIFIED Requirements

### Requirement: Deploy includes scheduled functions with cron

The deploy manifest SHALL include all edge functions with their cron schedules parsed from `// schedule:` comments. The manifest SHALL include scheduled functions for: check-expirations (daily), event-reminders (hourly), moderate-content (every 15 min).

#### Scenario: Scheduled functions deployed
- **WHEN** `node deploy.js` runs
- **THEN** the manifest includes functions with schedule fields: `check-expirations` with `"0 8 * * *"`, `event-reminders` with `"0 * * * *"`, `moderate-content` with `"*/15 * * * *"`

## ADDED Requirements

### Requirement: Deploy includes RLS for new tables

The deploy manifest RLS configuration SHALL include the new tables: `events`, `event_rsvps`, `resources`, `forum_categories`, `forum_topics`, `forum_replies`, `committees`, `committee_members`.

#### Scenario: New tables have RLS
- **WHEN** the deploy completes
- **THEN** new content tables have `public_read` RLS applied
