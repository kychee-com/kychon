## MODIFIED Requirements

### Requirement: STRUCTURE.md AI-readable manifest

STRUCTURE.md SHALL be updated to include: new page files (events, resources, forum, committees), new edge functions (check-expirations, event-reminders, moderate-content, translate-content, export-csv, upload-resource), new feature flags, AI feature configuration, and scheduled function cron schedules.

#### Scenario: STRUCTURE.md lists new modules
- **WHEN** an AI agent reads STRUCTURE.md
- **THEN** it finds entries for events, resources, forum, committees pages and their JS files

#### Scenario: STRUCTURE.md lists AI features
- **WHEN** an AI agent reads STRUCTURE.md
- **THEN** it finds AI feature descriptions, required secrets (AI_PROVIDER, AI_API_KEY), and scheduled function schedules

### Requirement: CUSTOMIZING.md agent guide

CUSTOMIZING.md SHALL be updated with new recipes: create an event (SQL), add a forum category, configure AI features (set secrets, enable flags), add a resource category, create a committee.

#### Scenario: Agent enables AI moderation
- **WHEN** an AI agent follows the "Configure AI features" instructions
- **THEN** the instructions cover: set AI_API_KEY secret, set AI_PROVIDER secret, enable feature_ai_moderation flag
