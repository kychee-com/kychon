## MODIFIED Requirements

### Requirement: Members can react to announcements with emoji

Authenticated members SHALL be able to add emoji reactions to announcements. The available emoji set SHALL be: `like`, `heart`, `celebrate`, `laugh`, `think`. Each member MAY add at most one reaction of each emoji type per announcement. When a reaction is added, the emoji badge SHALL play a pop animation and a floating emoji SHALL drift upward and fade out (see `reaction-animations` spec).

#### Scenario: Member adds a reaction
- **WHEN** an authenticated member clicks a reaction emoji on an announcement
- **THEN** a row is inserted into `reactions` with `content_type = 'announcement'`, `content_id` = the announcement ID, `member_id` = the member's ID, and `emoji` = the selected emoji code
- **THEN** the reaction count for that emoji on that announcement increments by 1
- **THEN** the reaction badge plays a pop animation and a floating emoji drifts upward

#### Scenario: Member toggles off their reaction
- **WHEN** an authenticated member clicks a reaction emoji they have already added
- **THEN** the corresponding `reactions` row is deleted
- **THEN** the reaction count for that emoji decrements by 1
- **THEN** no animation plays on removal

#### Scenario: Duplicate reaction prevented
- **WHEN** a member attempts to add a reaction with the same `content_type`, `content_id`, `member_id`, and `emoji` as an existing row
- **THEN** the unique constraint prevents the duplicate (the UI handles this via toggle behavior)

#### Scenario: Unauthenticated users see reactions but cannot react
- **WHEN** an unauthenticated user views an announcement with reactions
- **THEN** the reaction counts are visible
- **THEN** clicking a reaction emoji does nothing (or prompts sign-in)
