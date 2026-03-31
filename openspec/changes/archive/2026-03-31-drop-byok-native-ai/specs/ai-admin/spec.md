## MODIFIED Requirements

### Requirement: AI Configuration Panel

The system SHALL provide an AI configuration section within admin-settings. The panel SHALL include per-feature toggles for moderation and translation only. The panel SHALL NOT include an API key input field, provider selector, or toggles for insights, onboarding, newsletter, or event recaps.

#### Scenario: Admin enables moderation feature toggle
- **WHEN** an admin enables the moderation toggle in the AI configuration panel
- **THEN** the feature_ai_moderation flag SHALL be set to enabled

#### Scenario: Admin disables translation feature toggle
- **WHEN** an admin disables the translation toggle in the AI configuration panel
- **THEN** the feature_ai_translation flag SHALL be set to disabled

### Requirement: AI Activity Summary

The AI configuration panel SHALL display an activity summary for the last 7 days, including the number of posts moderated and translations made. The summary SHALL NOT include insights count.

#### Scenario: Admin views AI activity summary
- **WHEN** an admin opens the AI configuration panel
- **THEN** the panel SHALL display counts for posts moderated and translations made over the last 7 days

#### Scenario: No AI activity in the last 7 days
- **WHEN** an admin opens the AI configuration panel and no AI activity has occurred in the last 7 days
- **THEN** the activity summary SHALL display zero counts for all metrics

## REMOVED Requirements

### Requirement: API Key Test Button
**Reason**: BYOK architecture removed. No API key to test.
**Migration**: Remove test button from admin settings. Native `ai.moderate()` and `ai.translate()` are platform-managed.

### Requirement: Admin toggles insights feature
**Reason**: Generative AI features hidden pending Run402 LLM endpoint.
**Migration**: Remove toggle from admin UI. Feature flag remains in site_config with default false.

### Requirement: Admin toggles onboarding feature
**Reason**: Generative AI features hidden pending Run402 LLM endpoint.
**Migration**: Remove toggle from admin UI. Feature flag remains in site_config with default false.
