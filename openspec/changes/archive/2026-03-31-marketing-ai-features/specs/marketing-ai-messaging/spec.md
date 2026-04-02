## ADDED Requirements

### Requirement: AI section heading reflects platform-native AI

The AI section heading SHALL read "AI that works from day one." and the tagline SHALL communicate that moderation and translation are built-in with no API keys or setup required. The section SHALL NOT reference BYOK, "bring your own key", or API keys.

#### Scenario: Visitor views the AI section on the homepage
- **WHEN** a visitor scrolls to the AI section on index.html
- **THEN** the heading SHALL read "AI that works from day one." and the tagline SHALL mention that moderation and translation are built-in with no setup

### Requirement: Only active AI features are shown

The AI feature grid SHALL contain exactly two cards: Content Moderation and Auto-Translation. The four generative features (Newsletter Writer, Smart Onboarding, Member Insights, Event Recaps) SHALL NOT appear.

#### Scenario: Visitor views the AI feature grid
- **WHEN** a visitor views the AI section on index.html
- **THEN** exactly two feature cards SHALL be displayed: Content Moderation and Auto-Translation

#### Scenario: Generative features are not shown
- **WHEN** a visitor views the AI section on index.html
- **THEN** no cards for Newsletter Writer, Smart Onboarding, Member Insights, or Event Recaps SHALL be present

### Requirement: BYOK badge is removed

The AI section SHALL NOT contain a BYOK badge or any messaging about bringing your own API key.

#### Scenario: Visitor looks for BYOK messaging
- **WHEN** a visitor views the AI section
- **THEN** no BYOK badge, lock icon, or "bring your own API key" text SHALL be present

### Requirement: Comparison table reflects current AI availability

The compare.html feature table SHALL show AI moderation and AI translation as available (checkmark). The AI newsletter row SHALL be removed.

#### Scenario: Visitor views comparison table
- **WHEN** a visitor views the feature comparison on compare.html
- **THEN** AI moderation and AI translation rows SHALL show checkmarks for Kychon, and no AI newsletter row SHALL exist

### Requirement: Niche pages remove BYOK AI references

All niche landing pages (churches, associations, sports, hoa) SHALL describe AI features without referencing API keys or BYOK. AI mentions SHALL emphasize "built-in" capability.

#### Scenario: Visitor views a niche landing page
- **WHEN** a visitor views any niche landing page
- **THEN** AI feature mentions SHALL use "built-in" language and SHALL NOT reference API keys or BYOK
