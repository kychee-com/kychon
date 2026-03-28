## MODIFIED Requirements

### Requirement: Admin dashboard with stats cards

`admin.html` SHALL display stats cards showing: total active members, pending members, total announcements, members expiring within 30 days, upcoming events count, total resources, and forum topics count. Stats SHALL be fetched via REST API queries.

#### Scenario: Dashboard shows event stats
- **WHEN** an admin visits `admin.html` and `feature_events` is enabled
- **THEN** they see a card with the count of upcoming events

#### Scenario: Dashboard shows resource stats
- **WHEN** an admin visits `admin.html` and `feature_resources` is enabled
- **THEN** they see a card with the total resource count

#### Scenario: Dashboard shows forum stats
- **WHEN** an admin visits `admin.html` and `feature_forum` is enabled
- **THEN** they see a card with the total forum topics count

## ADDED Requirements

### Requirement: AI insights section on dashboard

When `feature_ai_insights` is enabled, the dashboard SHALL display a "Members Needing Attention" section showing the latest pending member_insights entries with insight type, member name, AI-generated message, and priority. Each insight SHALL have "Action" and "Dismiss" buttons.

#### Scenario: Insights displayed
- **WHEN** an admin views the dashboard and there are pending member_insights
- **THEN** the insights section shows each insight with member name, message, and action buttons

#### Scenario: Dismiss insight
- **WHEN** an admin clicks "Dismiss" on an insight
- **THEN** the insight status changes to "dismissed" and it disappears from the list

#### Scenario: Insights hidden when feature disabled
- **WHEN** `feature_ai_insights` is false
- **THEN** the insights section is not rendered

### Requirement: Moderation queue on dashboard

When `feature_ai_moderation` is enabled, the dashboard SHALL display a "Moderation Queue" section showing flagged forum content (moderation_log entries with action = 'flagged'). Each item SHALL show the content snippet, AI reason, confidence score, and approve/reject buttons.

#### Scenario: Flagged content displayed
- **WHEN** an admin views the dashboard and there are flagged moderation entries
- **THEN** the moderation queue shows each item with content preview, reason, and action buttons

#### Scenario: Approve flagged content
- **WHEN** an admin clicks "Approve" on a flagged item
- **THEN** the content is unhidden and the moderation_log entry is updated with reviewed_by = admin's member ID

#### Scenario: Reject flagged content
- **WHEN** an admin clicks "Reject" on a flagged item
- **THEN** the content remains hidden and the moderation_log action is updated to 'hidden'
