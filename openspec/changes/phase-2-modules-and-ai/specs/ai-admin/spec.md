## ADDED Requirements

### Requirement: AI Configuration Panel

The system SHALL provide an AI configuration section within admin-settings. The panel SHALL include an API key input field (masked), a provider selector supporting OpenAI and Anthropic, and per-feature toggles for moderation, translation, insights, and onboarding.

#### Scenario: Admin enters API key
- **WHEN** an admin enters an API key in the AI configuration panel
- **THEN** the key SHALL be saved securely and displayed in masked form

#### Scenario: Admin selects AI provider
- **WHEN** an admin selects OpenAI or Anthropic from the provider selector
- **THEN** the selected provider SHALL be saved and used for all AI API calls

#### Scenario: Admin enables moderation feature toggle
- **WHEN** an admin enables the moderation toggle in the AI configuration panel
- **THEN** the feature_ai_moderation flag SHALL be set to enabled

#### Scenario: Admin disables translation feature toggle
- **WHEN** an admin disables the translation toggle in the AI configuration panel
- **THEN** the feature_ai_translation flag SHALL be set to disabled

#### Scenario: Admin toggles insights feature
- **WHEN** an admin toggles the insights feature in the AI configuration panel
- **THEN** the feature_ai_insights flag SHALL be updated accordingly

#### Scenario: Admin toggles onboarding feature
- **WHEN** an admin toggles the onboarding feature in the AI configuration panel
- **THEN** the feature_ai_onboarding flag SHALL be updated accordingly

### Requirement: API Key Test Button

The AI configuration panel SHALL include a test button that verifies the configured API key works with the selected provider.

#### Scenario: Admin tests a valid API key
- **WHEN** an admin clicks the test button and the API key is valid for the selected provider
- **THEN** the system SHALL display a success confirmation

#### Scenario: Admin tests an invalid API key
- **WHEN** an admin clicks the test button and the API key is invalid or rejected by the provider
- **THEN** the system SHALL display an error message indicating the key is invalid

#### Scenario: Admin tests with no API key configured
- **WHEN** an admin clicks the test button and no API key has been entered
- **THEN** the system SHALL display a message prompting the admin to enter an API key first

### Requirement: AI Activity Summary

The AI configuration panel SHALL display an activity summary for the last 7 days, including the number of posts moderated, translations made, and insights generated.

#### Scenario: Admin views AI activity summary
- **WHEN** an admin opens the AI configuration panel
- **THEN** the panel SHALL display counts for posts moderated, translations made, and insights generated over the last 7 days

#### Scenario: No AI activity in the last 7 days
- **WHEN** an admin opens the AI configuration panel and no AI activity has occurred in the last 7 days
- **THEN** the activity summary SHALL display zero counts for all metrics

### Requirement: Moderation Review Queue

The AI admin panel SHALL include a moderation review queue showing all flagged content items. Each item SHALL have approve and reject action buttons.

#### Scenario: Admin views moderation review queue
- **WHEN** an admin navigates to the moderation review queue
- **THEN** all flagged forum topics and replies SHALL be displayed with their content preview and classification details

#### Scenario: Admin approves content from review queue
- **WHEN** an admin clicks approve on a flagged item in the review queue
- **THEN** the content SHALL be unflagged, remain visible, and be removed from the queue

#### Scenario: Admin rejects content from review queue
- **WHEN** an admin clicks reject on a flagged item in the review queue
- **THEN** the content SHALL be hidden from members and removed from the queue

#### Scenario: Empty moderation review queue
- **WHEN** an admin views the moderation review queue and no flagged items exist
- **THEN** the queue SHALL display an empty state message indicating no items need review
