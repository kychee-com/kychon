## ADDED Requirements

### Requirement: Deploys never re-apply content to an installed project
A deploy SHALL apply schema changes to an installed project without re-applying its seed or import bundle, whatever changed in `schema.sql`, the seed, or the engine version. Only an explicit, confirmed re-import (see `initial-import`) MAY re-apply content.

#### Scenario: Comment-only schema edit
- **WHEN** `schema.sql` changes only in comments and an installed demo or port is redeployed
- **THEN** the deploy succeeds and no content row changes
