## ADDED Requirements

### Requirement: STRUCTURE.md AI-readable manifest

The system SHALL include a `STRUCTURE.md` file at the project root that describes: current version, enabled features, file structure, schema overview (tables and key columns), how to add new features, how to add new pages, how to deploy changes, and common naming conventions.

#### Scenario: Agent reads STRUCTURE.md
- **WHEN** an AI agent opens the project for the first time
- **THEN** `STRUCTURE.md` provides sufficient context to understand the codebase without reading every file
- **THEN** the manifest accurately reflects the current state of the project

### Requirement: CUSTOMIZING.md agent guide

The system SHALL include a `CUSTOMIZING.md` file at the project root with step-by-step examples for common customization tasks: add a membership tier, add a custom member field, enable a feature flag, create a new page, add a new language, add a scheduled job, modify the homepage layout.

#### Scenario: Agent adds a membership tier
- **WHEN** an AI agent follows the "Add a membership tier" instructions in CUSTOMIZING.md
- **THEN** the instructions include the exact SQL to run
- **THEN** the new tier appears in the site after deploy

#### Scenario: Agent adds a new language
- **WHEN** an AI agent follows the "Add a new language" instructions
- **THEN** the instructions cover: copy en.json, translate keys, update brand.json, deploy
- **THEN** the new language is selectable in the language picker

### Requirement: Agent docs stay current

STRUCTURE.md and CUSTOMIZING.md SHALL accurately reflect the current file structure, schema, and available features. They SHALL be updated whenever the structure changes.

#### Scenario: Docs match reality
- **WHEN** a developer compares STRUCTURE.md to the actual file tree
- **THEN** every file and directory mentioned exists
- **THEN** every table mentioned matches `schema.sql`

<!-- Phase 2 additions -->
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
