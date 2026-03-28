## MODIFIED Requirements

### Requirement: Config-driven navigation

The nav config SHALL include items for events, resources, forum, and committees, each gated by their respective feature flag.

#### Scenario: Events nav item shown when enabled
- **WHEN** `feature_events` is true
- **THEN** the nav includes an "Events" link to `/events.html`

#### Scenario: Forum nav item hidden when disabled
- **WHEN** `feature_forum` is false
- **THEN** the nav does not include a "Forum" link

## ADDED Requirements

### Requirement: Feature flags for new modules

The seed data SHALL include feature flags: `feature_events` (default true), `feature_resources` (default true), `feature_forum` (default false), `feature_committees` (default false). AI feature flags: `feature_ai_moderation`, `feature_ai_translation`, `feature_ai_insights`, `feature_ai_onboarding` (all default false).

#### Scenario: Events enabled by default
- **WHEN** a fresh deployment runs seed.sql
- **THEN** `feature_events` is `true` in site_config

#### Scenario: AI features disabled by default
- **WHEN** a fresh deployment runs seed.sql
- **THEN** all `feature_ai_*` flags are `false` in site_config

### Requirement: Content translation display

Pages that display announcements, events, or page content SHALL check the `content_translations` table for a translation matching the user's current locale. If a translation exists, it SHALL be displayed instead of the original content.

#### Scenario: Translated announcement shown
- **WHEN** a user with locale `pt` views an announcement that has a Portuguese translation in content_translations
- **THEN** the translated title and body are displayed

#### Scenario: Original shown when no translation exists
- **WHEN** a user with locale `pt` views content with no Portuguese translation
- **THEN** the original content is displayed
