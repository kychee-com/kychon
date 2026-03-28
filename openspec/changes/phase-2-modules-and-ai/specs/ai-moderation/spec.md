## ADDED Requirements

### Requirement: AI Moderation Scheduling

The AI moderation function SHALL run as a scheduled function every 15 minutes. It MUST require the feature_ai_moderation flag to be enabled and the AI_API_KEY secret to be set.

#### Scenario: AI moderation runs on schedule
- **WHEN** 15 minutes have elapsed since the last run and feature_ai_moderation is enabled
- **THEN** the AI moderation function SHALL execute

#### Scenario: AI moderation skipped when feature flag disabled
- **WHEN** the scheduled time arrives but feature_ai_moderation is disabled
- **THEN** the AI moderation function SHALL NOT execute

#### Scenario: AI moderation skipped when API key missing
- **WHEN** the scheduled time arrives but AI_API_KEY is not set
- **THEN** the AI moderation function SHALL NOT execute and SHALL log a warning

### Requirement: Content Classification

The AI moderation function SHALL read all new forum topics and replies created since the last moderation check and send them to the AI API for spam and toxicity classification. The AI API SHALL return a confidence score between 0 and 1.

#### Scenario: New topic classified by AI
- **WHEN** the moderation function runs and finds a new forum topic since the last check
- **THEN** the topic content SHALL be sent to the AI API for spam and toxicity classification

#### Scenario: New reply classified by AI
- **WHEN** the moderation function runs and finds a new forum reply since the last check
- **THEN** the reply content SHALL be sent to the AI API for spam and toxicity classification

#### Scenario: No new content to classify
- **WHEN** the moderation function runs and no new topics or replies exist since the last check
- **THEN** the function SHALL complete without calling the AI API

### Requirement: Auto-Hide High Confidence Content

Content classified with a confidence score greater than 0.7 SHALL be automatically hidden.

#### Scenario: Content with confidence above 0.7
- **WHEN** the AI API returns a confidence score greater than 0.7 for a topic or reply
- **THEN** the content SHALL be automatically hidden from members

### Requirement: Flag Medium Confidence Content

Content classified with a confidence score between 0.3 and 0.7 SHALL be flagged for admin review.

#### Scenario: Content with confidence between 0.3 and 0.7
- **WHEN** the AI API returns a confidence score between 0.3 and 0.7 for a topic or reply
- **THEN** the content SHALL be flagged for review without being hidden

#### Scenario: Content with confidence below 0.3
- **WHEN** the AI API returns a confidence score below 0.3 for a topic or reply
- **THEN** the content SHALL remain visible and not be flagged

### Requirement: Moderation Logging

All AI moderation decisions SHALL be logged to the moderation_log table, including the content reference, classification result, confidence score, and action taken.

#### Scenario: Moderation decision logged
- **WHEN** the AI API classifies a piece of content
- **THEN** a record SHALL be written to moderation_log with the content reference, classification result, confidence score, and action taken

### Requirement: Admin Moderation Review Dashboard

Admin users SHALL see flagged items in a dashboard view with approve and reject buttons. Approving SHALL unflag the content. Rejecting SHALL hide the content.

#### Scenario: Admin views flagged content
- **WHEN** an admin opens the moderation review dashboard
- **THEN** all flagged content items SHALL be displayed with their classification details

#### Scenario: Admin approves flagged content
- **WHEN** an admin clicks approve on a flagged content item
- **THEN** the content SHALL be unflagged and remain visible

#### Scenario: Admin rejects flagged content
- **WHEN** an admin clicks reject on a flagged content item
- **THEN** the content SHALL be hidden from members
