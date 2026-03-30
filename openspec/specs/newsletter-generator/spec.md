## ADDED Requirements

### Requirement: Weekly newsletter draft generation

The system SHALL provide a scheduled edge function (`generate-newsletter.js`) that runs weekly (Monday 9 AM, cron `0 9 * * 1`). It SHALL query the past week's community activity: new members, upcoming events, recent announcements, top forum posts, and new resources. It SHALL send this data to the configured AI API with the community name and tone context, and save the AI-generated newsletter as a draft in the `newsletter_drafts` table.

#### Scenario: Successful newsletter generation
- **WHEN** the weekly newsletter function runs and the AI API key is configured
- **THEN** the system SHALL query the past 7 days of activity, call the AI API to generate a newsletter, and insert a row into `newsletter_drafts` with status `draft`, the generated subject and body (HTML), and the period start/end dates

#### Scenario: No activity in the past week
- **WHEN** the weekly newsletter function runs but there is no community activity in the past 7 days
- **THEN** the system SHALL skip newsletter generation and log that no draft was created due to insufficient activity

#### Scenario: AI API key not configured
- **WHEN** the weekly newsletter function runs but no AI API key is set
- **THEN** the function SHALL exit gracefully without error and log that newsletter generation is skipped due to missing API key

#### Scenario: AI API call fails
- **WHEN** the AI API returns an error or times out
- **THEN** the function SHALL log the error and NOT create a draft row

### Requirement: Newsletter admin review and send workflow

Admins SHALL be able to view, edit, and approve newsletter drafts from the admin dashboard. The draft SHALL be rendered with inline editing (Tiptap) so admins can modify content before sending. Admins SHALL be able to trigger sending of an approved draft.

#### Scenario: Admin reviews newsletter draft
- **WHEN** an admin navigates to the newsletter section of the admin dashboard
- **THEN** the system SHALL display the most recent draft with its subject, body preview, and period dates

#### Scenario: Admin edits newsletter draft
- **WHEN** an admin clicks to edit a newsletter draft
- **THEN** the system SHALL load the Tiptap editor with the draft body, allowing inline editing

#### Scenario: Admin approves and sends newsletter
- **WHEN** an admin approves a draft and clicks send
- **THEN** the system SHALL update the draft status to `sent`, record `sent_at`, and trigger the email send

#### Scenario: Admin regenerates a draft
- **WHEN** an admin is unsatisfied with a draft and clicks regenerate
- **THEN** the system SHALL call the AI API again to produce a new draft, replacing the current draft body

### Requirement: Newsletter feature flag

Newsletter generation SHALL be controlled by the `feature_newsletter` flag in `site_config`. When disabled, the scheduled function SHALL not run and the admin dashboard SHALL not show the newsletter section.

#### Scenario: Feature flag disabled
- **WHEN** `feature_newsletter` is false in `site_config`
- **THEN** the scheduled function SHALL exit immediately and the newsletter admin UI SHALL be hidden

#### Scenario: Feature flag enabled
- **WHEN** `feature_newsletter` is true in `site_config`
- **THEN** the scheduled function SHALL run normally and the newsletter admin UI SHALL be visible
