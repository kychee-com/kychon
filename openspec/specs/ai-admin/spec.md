## Purpose

The admin settings surface exposes Kychon's AI controls: per-feature toggles for the two platform-native AI capabilities, a recent-activity summary, and the moderation review queue.

## Requirements

### Requirement: AI Configuration Panel

The system SHALL provide an AI configuration section within admin-settings. The panel SHALL include per-feature toggles for moderation and translation only. The panel SHALL NOT include an API key input field, a provider selector, or toggles for insights, onboarding, newsletter, or event recaps.

#### Scenario: Admin enables moderation feature toggle
- **WHEN** an admin enables the moderation toggle in the AI configuration panel
- **THEN** the feature_ai_moderation flag SHALL be set to enabled

#### Scenario: Admin disables translation feature toggle
- **WHEN** an admin disables the translation toggle in the AI configuration panel
- **THEN** the feature_ai_translation flag SHALL be set to disabled

### Requirement: AI Activity Summary

The AI configuration panel SHALL display an activity summary for the last 7 days, including the number of posts moderated and translations made. The summary SHALL NOT include an insights count.

#### Scenario: Admin views AI activity summary
- **WHEN** an admin opens the AI configuration panel
- **THEN** the panel SHALL display counts for posts moderated and translations made over the last 7 days

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
