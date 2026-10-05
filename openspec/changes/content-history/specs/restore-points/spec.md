## Purpose

Named whole-site restore points let a portal return to a known-good state after a bad engine upgrade, agent run, or import, without relying on per-row history.

## ADDED Requirements

### Requirement: Restore points are taken around risky operations
The system SHALL take a labelled restore point of the whole portal before an engine upgrade, before a re-import, before an AI agent session that edits content, and before a restore. Each restore point SHALL record its label, reason, creator, and time, and SHALL appear in the portal's restore-point list.

#### Scenario: Fleet upgrade
- **WHEN** the fleet upgrade upgrades a portal's engine
- **THEN** a restore point with reason `before_engine_upgrade` exists for that portal, taken before the upgrade

### Requirement: Admins can create restore points
The system SHALL let an owner or admin create a restore point with a label at any time.

#### Scenario: Manual restore point
- **WHEN** an admin creates a restore point labelled `Before spring redesign`
- **THEN** it appears in the list with that label and the admin as creator

### Requirement: Restoring is owner-only, confirmed, and undoable
Restoring a restore point SHALL require the owner role and an explicit confirmation naming the site. Before restoring, the system SHALL take a `before_restore` restore point. After restoring, it SHALL record a changeset stating which restore point was restored. A restore without confirmation, or by a non-owner, SHALL be refused without changes.

#### Scenario: Owner restores
- **WHEN** the owner restores `Before spring redesign` and confirms the site name
- **THEN** the portal content matches that point
- **AND** a `before_restore` restore point exists from just before the restore

#### Scenario: Admin cannot restore
- **WHEN** a non-owner admin requests a restore
- **THEN** the request is refused and nothing changes
