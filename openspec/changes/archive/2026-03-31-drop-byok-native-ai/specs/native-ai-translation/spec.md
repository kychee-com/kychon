## ADDED Requirements

### Requirement: Native translation via ai.translate()

The translation function SHALL use `ai.translate()` from `@run402/functions` instead of calling external AI APIs directly. The function SHALL NOT require `AI_API_KEY` or `AI_PROVIDER` secrets.

#### Scenario: Translation uses native helper
- **WHEN** the translation function translates content to a target language
- **THEN** it SHALL call `ai.translate(text, targetLang, { context })` and use the `text` field from the response

#### Scenario: No API key required
- **WHEN** the translation function runs
- **THEN** it SHALL NOT check for or require `AI_API_KEY` in process.env

### Requirement: Context hint for translation quality

The function SHALL pass a context hint to `ai.translate()` derived from the content type, formatted as `"{content_type} on a community portal"`.

#### Scenario: Announcement translation includes context
- **WHEN** translating an announcement title
- **THEN** the call SHALL include `context: "announcement on a community portal"`

#### Scenario: Event translation includes context
- **WHEN** translating an event description
- **THEN** the call SHALL include `context: "event on a community portal"`

### Requirement: Graceful handling of translation quota errors

The function SHALL catch quota exceeded errors from `ai.translate()` and skip remaining translations without failing the entire request.

#### Scenario: Translation quota exceeded mid-batch
- **WHEN** `ai.translate()` fails with a quota error after translating 2 of 4 fields
- **THEN** the 2 successful translations SHALL be saved, the remaining fields SHALL be skipped, and the response SHALL indicate partial completion with the count of successful translations

#### Scenario: Translation API unavailable
- **WHEN** `ai.translate()` throws a non-quota error
- **THEN** the field SHALL be skipped, a warning SHALL be logged, and processing SHALL continue with the next field
