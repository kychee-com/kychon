## ADDED Requirements

### Requirement: Native moderation via ai.moderate()

The moderation function SHALL use `ai.moderate()` from `@run402/functions` instead of calling external AI APIs directly. The function SHALL NOT require `AI_API_KEY` or `AI_PROVIDER` secrets.

#### Scenario: Moderation uses native helper
- **WHEN** the moderation function processes a forum post
- **THEN** it SHALL call `ai.moderate(text)` and receive a response with `flagged`, `categories`, and `category_scores` fields

#### Scenario: No API key required
- **WHEN** the moderation function runs
- **THEN** it SHALL NOT check for or require `AI_API_KEY` in process.env

### Requirement: Confidence score mapping from category_scores

The function SHALL derive a confidence score from `ai.moderate()` response by taking the maximum value from `category_scores`. The reason field SHALL be set to the name of the highest-scoring category.

#### Scenario: Map category_scores to confidence
- **WHEN** `ai.moderate()` returns `category_scores: { harassment: 0.85, violence: 0.02, sexual: 0.01 }`
- **THEN** the confidence score SHALL be 0.85 and the reason SHALL be "harassment"

#### Scenario: Low scores across all categories
- **WHEN** `ai.moderate()` returns all category_scores below 0.1
- **THEN** the confidence score SHALL be the maximum score and the content SHALL be approved

### Requirement: Auto-hide uses flagged boolean plus threshold

Content SHALL be auto-hidden only when `flagged` is `true` AND the max category score exceeds 0.7. Content SHALL be flagged for review when `flagged` is `true` AND the max score is 0.7 or below.

#### Scenario: Flagged with high confidence
- **WHEN** `ai.moderate()` returns `flagged: true` and max category_score is 0.82
- **THEN** the content SHALL be auto-hidden and logged with action "hidden"

#### Scenario: Flagged with medium confidence
- **WHEN** `ai.moderate()` returns `flagged: true` and max category_score is 0.55
- **THEN** the content SHALL be flagged for admin review and logged with action "flagged"

#### Scenario: Not flagged
- **WHEN** `ai.moderate()` returns `flagged: false`
- **THEN** the content SHALL remain visible and be logged with action "approved"

### Requirement: Graceful handling of moderation API errors

The function SHALL catch errors from `ai.moderate()` and treat the content as approved when the API is unavailable.

#### Scenario: ai.moderate() throws an error
- **WHEN** `ai.moderate()` throws an error for a piece of content
- **THEN** the content SHALL remain visible, be logged with action "approved" and reason "moderation unavailable", and processing SHALL continue with the next item
