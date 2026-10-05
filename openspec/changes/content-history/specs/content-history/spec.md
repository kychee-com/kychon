## Purpose

Every change to a portal's content is recorded as an immutable revision, grouped into attributed changesets, so admins can see what changed, who or what changed it, and revert it, whether the change came from the inline editor, an edge function, or an AI agent's SQL.

## ADDED Requirements

### Requirement: Every content write is recorded as a revision
The system SHALL record a revision for every insert, update, and delete on the history-tracked content tables (`site_config`, `pages`, `sections`, `section_translations`, `content_translations`, `events`, `event_registration_options`, `announcements`, `resources`, `committees`, `membership_tiers`, `member_custom_fields`, `polls`, `poll_options`, `forum_categories`), whatever the write path. Each revision SHALL capture the table, the row key, the operation, the full row before and after, and the time. An update that changes no column SHALL NOT produce a revision. Revisions SHALL be append-only: no API SHALL update or delete a revision except retention pruning.

#### Scenario: Inline edit is recorded
- **WHEN** an admin edits a hero heading in the inline editor
- **THEN** a revision exists for that `sections` row with the old and new config

#### Scenario: Raw agent SQL is recorded
- **WHEN** an agent runs `UPDATE pages SET title = 'Join us' WHERE slug = 'about'` through service-key SQL
- **THEN** a revision exists for that `pages` row with the old and new title

#### Scenario: Untracked tables are not recorded
- **WHEN** a member RSVPs to an event or a member profile changes
- **THEN** no revision is recorded

### Requirement: Revisions are grouped into attributed changesets
Every revision SHALL belong to exactly one changeset, and all revisions from one database transaction SHALL share a changeset. Each changeset SHALL record an actor type (`admin`, `agent`, `jwt`, `system`, or `unattributed`), an actor id when known, an optional label, and the originating capability execution when there is one. Changes made through the capability API SHALL be attributed to the authenticated admin. Agent SQL that labels its transaction SHALL be attributed to that agent with that label. SQL that does neither SHALL be recorded as `unattributed`, never dropped.

#### Scenario: Capability save is attributed
- **WHEN** admin Alice saves a section through the capability API
- **THEN** the changeset's actor is `admin` with Alice's user id and the capability execution is linked

#### Scenario: Labelled agent run
- **WHEN** the Pro agent updates three sections in one transaction and labels it `Restyle hero`
- **THEN** one changeset with actor `agent` and label `Restyle hero` contains all three revisions

#### Scenario: Unlabelled SQL
- **WHEN** a service-key SQL call updates a page without labelling
- **THEN** its changeset's actor is `unattributed`

### Requirement: Admins can browse history
The system SHALL let an admin list changesets site-wide, newest first, with actor, label, time, and the affected pages and blocks. It SHALL also let an admin list the revisions of a single page or block, and view a before/after diff of any revision. Non-admins SHALL NOT be able to read history.

#### Scenario: Block history
- **WHEN** an admin opens history on a block edited three times
- **THEN** three revisions are listed with who, when, and a before/after view

#### Scenario: Member cannot read history
- **WHEN** a signed-in non-admin requests the history list
- **THEN** the request is refused

### Requirement: Admins can revert a changeset safely
The system SHALL let an admin revert a changeset by restoring every affected row to its state before that changeset, as one atomic operation recorded as a new changeset that references the reverted one. If any affected row changed after the changeset, the revert SHALL be refused with the list of conflicting rows and nothing changed, unless the admin explicitly forces it. A revert SHALL only ever write to history-tracked tables.

#### Scenario: Clean revert
- **WHEN** an admin reverts a changeset whose rows have not changed since
- **THEN** those rows return to their prior state, including re-creating deleted rows and removing inserted ones
- **AND** a new changeset labelled as a revert of the original is recorded

#### Scenario: Conflicting revert
- **WHEN** an admin reverts a changeset but one of its rows was edited later
- **THEN** the revert is refused, lists the conflicting row, and changes nothing

#### Scenario: Forced revert is itself revertible
- **WHEN** an admin forces a conflicting revert
- **THEN** the rows are restored and the forced revert appears as a changeset that can be reverted

### Requirement: Undo after an admin save
After an admin save that the inline editor makes, the system SHALL offer an undo action for that save, which reverts its changeset under the same conflict rules.

#### Scenario: Undo a heading edit
- **WHEN** an admin changes a heading and clicks Undo in the confirmation
- **THEN** the heading returns to its previous value

### Requirement: History retention
The system SHALL delete revisions older than the configured retention period (default 365 days), SHALL always keep the newest revision for each row, and SHALL delete changesets left with no revisions.

#### Scenario: Old revisions pruned
- **WHEN** retention runs and a row has revisions from 400 days ago and from yesterday
- **THEN** the 400-day-old revision is deleted and yesterday's is kept

### Requirement: Content referenced by history keeps its assets
Uploaded assets referenced by any retained revision SHALL remain retrievable, so reverting restores working images. New admin uploads SHALL be referenced in content by their content-addressed (immutable) URL.

#### Scenario: Revert restores an old image
- **WHEN** an admin replaces a hero image and later reverts that change
- **THEN** the hero shows the original image and it loads successfully
