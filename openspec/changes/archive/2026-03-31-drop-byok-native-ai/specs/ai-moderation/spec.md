## MODIFIED Requirements

### Requirement: AI Moderation Scheduling

The AI moderation function SHALL run as a scheduled function every 15 minutes. It MUST require the feature_ai_moderation flag to be enabled. It SHALL NOT require the AI_API_KEY secret.

#### Scenario: AI moderation runs on schedule
- **WHEN** 15 minutes have elapsed since the last run and feature_ai_moderation is enabled
- **THEN** the AI moderation function SHALL execute

#### Scenario: AI moderation skipped when feature flag disabled
- **WHEN** the scheduled time arrives but feature_ai_moderation is disabled
- **THEN** the AI moderation function SHALL NOT execute

## REMOVED Requirements

### Requirement: AI moderation skipped when API key missing
**Reason**: BYOK architecture replaced by native `ai.moderate()`. No API key needed.
**Migration**: Remove `AI_API_KEY` check from `moderate-content.js`. The function uses `ai.moderate()` from `@run402/functions` which requires no secrets.
