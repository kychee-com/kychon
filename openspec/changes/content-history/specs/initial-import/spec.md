## Purpose

A portal's seed or import bundle is its initial import. It is applied exactly once per project, so no later deploy, schema change, or engine upgrade can overwrite or delete a live portal's content.

## ADDED Requirements

### Requirement: The initial import is applied exactly once per project
The system SHALL apply a project's seed or import bundle only when the project has no install record, and SHALL write the install record (time, import source, import checksum, engine version) atomically with the import. Once a project is installed, the system SHALL NOT apply any seed or bundle content to it except through an explicit re-import.

#### Scenario: Fresh project receives its import
- **WHEN** a project with no install record is deployed with a seed
- **THEN** the seed content is inserted
- **AND** an install record is created in the same transaction

#### Scenario: Installed project keeps its edits across a schema change
- **WHEN** an installed project whose admin edited a hero heading and deleted a block is redeployed with a changed `schema.sql` and an unchanged or changed seed
- **THEN** the edited heading and the deletion persist
- **AND** no content row is truncated, re-inserted, or updated by the seed

### Requirement: Existing live projects are adopted without re-import
On the first deploy that introduces install records, a project that already has site configuration SHALL be recorded as installed with import source `adopted`, before any import logic runs, so its content is left unchanged.

#### Scenario: Live port upgraded to the new engine
- **WHEN** a live port with existing content is deployed with the engine version that introduces install records
- **THEN** it is marked installed as `adopted`
- **AND** its content row counts are identical before and after the deploy

### Requirement: Re-import is explicit, confirmed, and recoverable
Re-applying a project's import SHALL require an explicit re-import request that names the project's subdomain. Before re-importing, the system SHALL take a restore point. A re-import request that does not name the subdomain SHALL be refused without changing anything.

#### Scenario: Unconfirmed re-import is refused
- **WHEN** a deploy requests re-import without the matching subdomain confirmation
- **THEN** the deploy is refused with an error naming the missing confirmation
- **AND** no content changes

#### Scenario: Confirmed re-import
- **WHEN** a deploy requests re-import with the matching subdomain confirmation
- **THEN** a restore point labelled `before_reimport` is taken
- **AND** the import is applied and the install record is replaced

### Requirement: Import content is validated before deploy
The system SHALL reject, before contacting the platform, an import that contains statements other than data-manipulation statements on the project's own tables, and SHALL report the offending statement.

#### Scenario: Import with a schema statement
- **WHEN** a port seed contains `CREATE TABLE` or `ALTER TABLE`
- **THEN** the deploy fails locally with a message identifying the statement
