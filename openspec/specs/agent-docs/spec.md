## Purpose

Kychon ships two root-level agent manifests — `STRUCTURE.md` (what the codebase is) and `CUSTOMIZING.md` (how to change it) — so an AI agent can work the project without reading every file.

## Requirements

### Requirement: STRUCTURE.md AI-readable manifest

The system SHALL include a `STRUCTURE.md` file at the project root describing: the file structure, key architecture patterns, schema overview (tables and key columns), brand identity and feature-flag keys, naming conventions, how to add a feature, a page, and a block type, the embed provider registry, the CSP baseline, and the block-type catalog.

#### Scenario: Agent reads STRUCTURE.md
- **WHEN** an AI agent opens the project for the first time
- **THEN** `STRUCTURE.md` provides sufficient context to understand the codebase without reading every file
- **THEN** the manifest accurately reflects the current state of the project

#### Scenario: STRUCTURE.md lists the shipped modules
- **WHEN** an AI agent reads STRUCTURE.md
- **THEN** it finds entries for every portal page and its source files, and for every deployed edge function

### Requirement: CUSTOMIZING.md agent guide

The system SHALL include a `CUSTOMIZING.md` file at the project root with step-by-step recipes for common customization tasks: branding, add a membership tier, add a custom member field, enable a feature flag, change theme colours, rename the site, create a custom page, add a new language, add a scheduled edge function, restructure the homepage, modify navigation, create an event, add a forum category, configure AI features, add a resource category, create a committee, and add an embed block.

#### Scenario: Agent adds a membership tier
- **WHEN** an AI agent follows the "Add a Membership Tier" instructions in CUSTOMIZING.md
- **THEN** the instructions include the exact SQL to run
- **THEN** the new tier appears in the site after deploy

#### Scenario: Agent adds a new language
- **WHEN** an AI agent follows the "Add a New Language" instructions
- **THEN** the instructions cover the full path from copying the base locale file to deploying
- **THEN** the new language is selectable in the language picker

#### Scenario: Agent enables AI moderation
- **WHEN** an AI agent follows the "Configure AI Features" instructions
- **THEN** the instructions cover enabling the `feature_ai_moderation` flag, with no API key or provider secret required

### Requirement: Agent docs stay current

STRUCTURE.md and CUSTOMIZING.md SHALL accurately reflect the current file structure, schema, and available features. They SHALL be updated whenever the structure changes.

#### Scenario: Docs match reality
- **WHEN** a developer compares STRUCTURE.md to the actual file tree
- **THEN** every file and directory mentioned exists
- **THEN** every table mentioned matches `schema.sql`
