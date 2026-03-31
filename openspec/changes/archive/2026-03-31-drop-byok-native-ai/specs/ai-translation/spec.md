## MODIFIED Requirements

### Requirement: Translation Trigger

The AI translation function SHALL be triggered when an admin publishes content (announcement, event, or page). It MUST require the feature_ai_translation flag to be enabled. It SHALL NOT require the AI_API_KEY secret.

#### Scenario: Admin publishes an announcement with translation enabled
- **WHEN** an admin publishes an announcement and feature_ai_translation is enabled
- **THEN** the translation function SHALL be triggered for that announcement

#### Scenario: Admin publishes content with translation disabled
- **WHEN** an admin publishes content but feature_ai_translation is disabled
- **THEN** the translation function SHALL NOT be triggered

## REMOVED Requirements

### Requirement: Translation skipped when API key missing
**Reason**: BYOK architecture replaced by native `ai.translate()`. No API key needed.
**Migration**: Remove `AI_API_KEY` check from `translate-content.js`. The function uses `ai.translate()` from `@run402/functions` which requires no secrets.
