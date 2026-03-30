## ADDED Requirements

### Requirement: Translation Trigger

The AI translation function SHALL be triggered when an admin publishes content (announcement, event, or page). It MUST require the feature_ai_translation flag to be enabled and the AI_API_KEY secret to be set.

#### Scenario: Admin publishes an announcement with translation enabled
- **WHEN** an admin publishes an announcement and feature_ai_translation is enabled and AI_API_KEY is set
- **THEN** the translation function SHALL be triggered for that announcement

#### Scenario: Admin publishes content with translation disabled
- **WHEN** an admin publishes content but feature_ai_translation is disabled
- **THEN** the translation function SHALL NOT be triggered

#### Scenario: Translation skipped when API key missing
- **WHEN** an admin publishes content and feature_ai_translation is enabled but AI_API_KEY is not set
- **THEN** the translation function SHALL NOT execute and SHALL log a warning

### Requirement: Language Configuration

The system SHALL read configured target languages from brand.json. Translations SHALL be generated for each configured language.

#### Scenario: brand.json has three configured languages
- **WHEN** the translation function runs and brand.json specifies three target languages
- **THEN** translations SHALL be generated for all three languages

#### Scenario: No languages configured
- **WHEN** the translation function runs and brand.json has no configured languages
- **THEN** the function SHALL complete without generating translations

### Requirement: Content Translation via AI

The system SHALL translate both the title and body of the published content by sending them to the AI API. Translations SHALL be stored in the content_translations table.

#### Scenario: Title and body translated for each language
- **WHEN** the translation function processes a published announcement with two configured languages
- **THEN** the AI API SHALL receive the title and body for translation into each language, and the results SHALL be stored in the content_translations table

#### Scenario: Translation stored with correct reference
- **WHEN** a translation is completed
- **THEN** the content_translations record SHALL reference the original content, the target language, and the translated title and body

### Requirement: Localized Content Display

Content pages SHALL display the translated version based on the user's locale when a translation exists. If no translation exists for the user's locale, the original content SHALL be displayed.

#### Scenario: User with matching locale views translated content
- **WHEN** a user whose locale matches a translated language views a content page
- **THEN** the translated title and body SHALL be displayed

#### Scenario: User with unsupported locale views content
- **WHEN** a user whose locale has no matching translation views a content page
- **THEN** the original title and body SHALL be displayed
