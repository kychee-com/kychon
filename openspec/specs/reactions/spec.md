## ADDED Requirements

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

### Requirement: Reaction counts display on announcements

Each announcement SHALL display reaction counts grouped by emoji type. Only emoji types with at least one reaction SHALL be shown. The current user's own reactions SHALL be visually highlighted.

#### Scenario: Announcement with reactions shows counts
- **WHEN** an announcement has 5 `like` reactions and 2 `heart` reactions
- **THEN** the announcement displays two reaction badges: "like: 5" and "heart: 2"
- **THEN** emoji types with zero reactions are not displayed as badges (but the reaction button/picker is still accessible)

#### Scenario: Current user's reactions are highlighted
- **WHEN** the current authenticated member has added a `like` reaction to an announcement
- **THEN** the `like` badge on that announcement is visually highlighted (e.g., filled/active state)

#### Scenario: Announcement with no reactions
- **WHEN** an announcement has zero reactions
- **THEN** a subtle reaction button/picker is shown (e.g., a "+" or smiley icon)
- **THEN** no reaction badges are displayed

### Requirement: Reaction emoji rendering

The system SHALL render emoji codes as Unicode emoji characters. The mapping SHALL be: `like` = "👍", `heart` = "❤️", `celebrate` = "🎉", `laugh` = "😄", `think` = "🤔".

#### Scenario: Emoji code renders as Unicode
- **WHEN** a reaction with `emoji = 'celebrate'` is displayed
- **THEN** it renders as the "🎉" Unicode character

### Requirement: Reactions are feature-flagged

The reaction UI SHALL only render when `feature_reactions` is `true` in `site_config`. When disabled, announcements render without any reaction UI.

#### Scenario: Feature flag enabled
- **WHEN** `feature_reactions` is `true`
- **THEN** announcements display the reaction picker and any existing reaction counts

#### Scenario: Feature flag disabled
- **WHEN** `feature_reactions` is `false`
- **THEN** announcements render without reaction UI
- **THEN** existing reaction data is preserved in the database but not displayed
