## Purpose

A versioned, self-describing export bundle of a portal's content and asset references supports backups, clubs leaving, cloning a portal, and copy-website imports, without git.

## ADDED Requirements

### Requirement: Admins can export a content bundle
The system SHALL let an owner or admin export a bundle that contains the format version, engine version, export time, source project, every row of the history-tracked content tables, and, for every asset referenced by that content, its URL, SHA-256, content type, and size. Member records SHALL be included only when explicitly requested. History SHALL NOT be included.

#### Scenario: Default export
- **WHEN** an admin exports the portal
- **THEN** the bundle contains pages, sections, site configuration, and events, plus asset references with SHA-256 values
- **AND** it contains no member records and no revisions

### Requirement: A bundle can be imported as a portal's initial import
The system SHALL accept a bundle as a project's initial import. It SHALL copy each referenced asset into the target project, verify each copy's SHA-256 against the bundle, and rewrite content URLs to the target project's asset URLs. Importing into an installed project SHALL follow the explicit re-import rules. An asset whose SHA-256 does not match SHALL fail the import, listing that asset.

#### Scenario: Clone a portal
- **WHEN** a bundle exported from portal A is imported into a new project B
- **THEN** B renders A's pages with images served from B's own asset URLs

#### Scenario: Tampered asset
- **WHEN** an asset fetched during import does not match its bundle SHA-256
- **THEN** the import fails, names the asset, and leaves B uninstalled
