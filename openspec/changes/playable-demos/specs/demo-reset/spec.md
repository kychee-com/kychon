## ADDED Requirements

### Requirement: Hourly reset scheduled function

The system SHALL provide a `reset-demo.js` edge function scheduled at `0 * * * *` (every hour on the hour). The function SHALL restore the demo site's database to its seed state while preserving demo auth account linkage.

#### Scenario: Reset runs on schedule
- **WHEN** the cron triggers `reset-demo.js` at the top of the hour
- **THEN** the function TRUNCATEs all mutable content tables: `announcements`, `forum_topics`, `forum_replies`, `forum_categories`, `events`, `event_rsvps`, `reactions`, `activity_log`, `resources`, `committees`, `committee_members`, `content_translations`, `moderation_log`, `member_insights`, `newsletter_drafts`
- **AND** DELETEs all rows from `members` except those linked to demo auth accounts (WHERE `user_id` is in the `demo_accounts` config)
- **AND** re-runs the demo's seed INSERT statements to restore all seed data
- **AND** re-links demo auth account `user_id` values to the appropriate seed member records
- **AND** writes `last_reset` to `site_config` with the current ISO timestamp

#### Scenario: Seed data restored after visitor mutations
- **WHEN** visitors have added announcements, forum posts, events, and new member signups during the hour
- **AND** the reset runs
- **THEN** all visitor-created content is removed
- **AND** all seed content (sample events, announcements, forum posts, members) is restored to its original state

#### Scenario: Demo auth accounts survive reset
- **WHEN** the reset runs
- **THEN** the Run402 auth accounts for `demo-admin@wildlychee.com` and `demo-member@wildlychee.com` are unaffected (they live in Run402's auth layer, not in the `members` table)
- **AND** the `members` table retains rows for both demo accounts with correct `user_id`, `role`, and `status`

### Requirement: Demo accounts config key

The system SHALL store demo auth account metadata in `site_config` under the key `demo_accounts`. The value SHALL be a JSON object with `admin_user_id` and `member_user_id` fields containing the Run402 auth UUIDs. The reset function reads this to know which member records to preserve and re-link.

#### Scenario: Reset function reads demo_accounts
- **WHEN** `reset-demo.js` starts execution
- **THEN** it reads `demo_accounts` from `site_config`
- **AND** uses `admin_user_id` and `member_user_id` to identify which member records to preserve during TRUNCATE
- **AND** after re-seeding, updates the admin seed member record with `user_id = admin_user_id` and the first non-admin seed member record with `user_id = member_user_id`

### Requirement: Site config keys preserved across reset

The reset function SHALL NOT truncate the `site_config` table. Instead, it SHALL re-run the seed's `ON CONFLICT DO UPDATE` statements for `site_config`, which restores seed values while preserving keys not in the seed (like `demo_mode`, `demo_accounts`, `last_reset`).

#### Scenario: Demo flags survive reset
- **WHEN** the reset runs
- **THEN** `demo_mode`, `demo_accounts`, and `last_reset` keys in `site_config` are preserved
- **AND** seed config values (branding, theme, features, nav) are restored to their original state

### Requirement: Sections and pages preserved across reset

The reset function SHALL NOT truncate the `sections` or `pages` tables. Instead, seed INSERTs for these tables use `ON CONFLICT DO UPDATE`, restoring seed values without losing the table structure.

#### Scenario: Homepage sections restored
- **WHEN** an admin has modified homepage sections during the demo
- **AND** the reset runs
- **THEN** the homepage sections are restored to their seed state

### Requirement: One-time bootstrap script

The system SHALL provide a `scripts/bootstrap-demo.sh` script that performs initial demo account setup for a given demo site. The script is idempotent and safe to re-run.

#### Scenario: First-time bootstrap
- **WHEN** the bootstrap script runs against a freshly deployed demo site
- **THEN** it signs up `demo-admin@wildlychee.com` with password `demo123` via the Run402 auth API
- **AND** it signs up `demo-member@wildlychee.com` with password `demo123`
- **AND** it calls the `on-signup` function for each account to create member records
- **AND** it updates the admin's member record to `role='admin'`, `status='active'`
- **AND** it updates the member's record to `status='active'`
- **AND** it stores both `user_id` UUIDs in `site_config` as `demo_accounts`

#### Scenario: Re-run bootstrap (idempotent)
- **WHEN** the bootstrap script runs against a demo site that already has demo accounts
- **THEN** it detects existing accounts (signup returns "already exists" or similar)
- **AND** it verifies the `demo_accounts` config key is present and correct
- **AND** it makes no destructive changes

### Requirement: Demo seed config keys

Each demo's `seed.sql` SHALL include the `demo_mode` config flag. The `demo_accounts` and `last_reset` keys are NOT in the seed — they are created by the bootstrap script and reset function respectively.

#### Scenario: Demo seed includes demo_mode
- **WHEN** a demo site is deployed with its seed.sql
- **THEN** `site_config` contains `demo_mode` = `true`
