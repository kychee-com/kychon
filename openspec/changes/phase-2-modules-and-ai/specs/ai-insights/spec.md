## ADDED Requirements

### Requirement: AI Insights Scheduling

The AI insights function SHALL run as a daily scheduled function. It MUST require the feature_ai_insights flag to be enabled and the AI_API_KEY secret to be set.

#### Scenario: AI insights runs daily
- **WHEN** the daily schedule triggers and feature_ai_insights is enabled and AI_API_KEY is set
- **THEN** the AI insights function SHALL execute

#### Scenario: AI insights skipped when feature flag disabled
- **WHEN** the daily schedule triggers but feature_ai_insights is disabled
- **THEN** the AI insights function SHALL NOT execute

#### Scenario: AI insights skipped when API key missing
- **WHEN** the daily schedule triggers but AI_API_KEY is not set
- **THEN** the AI insights function SHALL NOT execute and SHALL log a warning

### Requirement: Member Identification

The AI insights function SHALL identify members in the following categories: memberships expiring in 7, 14, or 30 days; members inactive for 30 or more days; and pending applications older than 7 days.

#### Scenario: Member expiring in 7 days identified
- **WHEN** the insights function runs and a member's membership expires in 7 days
- **THEN** that member SHALL be included in the insights processing batch

#### Scenario: Member inactive for 30+ days identified
- **WHEN** the insights function runs and a member has been inactive for 30 or more days
- **THEN** that member SHALL be included in the insights processing batch

#### Scenario: Pending application older than 7 days identified
- **WHEN** the insights function runs and a pending membership application is older than 7 days
- **THEN** that applicant SHALL be included in the insights processing batch

#### Scenario: Active member with current membership not flagged
- **WHEN** the insights function runs and a member is active with a membership not near expiration
- **THEN** that member SHALL NOT be included in the insights processing batch

### Requirement: AI-Generated Outreach Suggestions

For each identified member, the system SHALL call the AI API to generate a personalized outreach suggestion. The suggestion SHALL be stored in the member_insights table.

#### Scenario: AI generates outreach suggestion for expiring member
- **WHEN** a member expiring in 7 days is sent to the AI API
- **THEN** the AI SHALL return a personalized outreach suggestion and it SHALL be stored in the member_insights table

#### Scenario: AI generates outreach suggestion for inactive member
- **WHEN** an inactive member is sent to the AI API
- **THEN** the AI SHALL return a personalized re-engagement suggestion and it SHALL be stored in the member_insights table

### Requirement: Admin Insights Dashboard

The admin dashboard SHALL display a "Members Needing Attention" section showing the latest insights for identified members. Each insight SHALL include the member name, reason for attention, and the AI-generated suggestion.

#### Scenario: Admin views members needing attention
- **WHEN** an admin opens the dashboard
- **THEN** the "Members Needing Attention" section SHALL display members with their latest insights and outreach suggestions

#### Scenario: No members needing attention
- **WHEN** an admin opens the dashboard and no insights exist
- **THEN** the "Members Needing Attention" section SHALL display an empty state message

### Requirement: Insight Actions

Insights SHALL support being marked as actioned or dismissed by an admin. Actioned or dismissed insights SHALL be visually distinguished or hidden from the active list.

#### Scenario: Admin marks insight as actioned
- **WHEN** an admin marks an insight as actioned
- **THEN** the insight SHALL be recorded as actioned and removed from the active insights list

#### Scenario: Admin dismisses an insight
- **WHEN** an admin dismisses an insight
- **THEN** the insight SHALL be recorded as dismissed and removed from the active insights list
