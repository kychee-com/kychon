## ADDED Requirements

### Requirement: Demo reset is an explicit re-import that clears history
The hourly demo reset SHALL restore seed content as an explicit re-import of the demo's seed. It SHALL clear the demo's content history (changesets and revisions), so history reflects only edits since the last reset. It SHALL keep the demo marked as installed, so normal deploys do not re-apply the seed. Demo seed edits reach live demos through the next reset, not through deploys.

#### Scenario: Visitor edits are cleared with their history
- **WHEN** a visitor using the demo admin edits a block and the hourly reset runs
- **THEN** the block returns to its seed value
- **AND** the demo's history no longer contains that edit
