## MODIFIED Requirements

### Requirement: Announcement display

The system SHALL display announcements on the home page and/or a dedicated announcements section. Pinned announcements SHALL appear first. Announcements SHALL be ordered by `created_at` descending. Each announcement SHALL display a reaction bar below its metadata when `feature_reactions` is enabled.

#### Scenario: Announcements render on home page
- **WHEN** a user visits the home page
- **THEN** the latest announcements are displayed in a list/feed
- **THEN** pinned announcements appear before non-pinned ones

#### Scenario: Empty state
- **WHEN** no announcements exist
- **THEN** the announcements section shows a placeholder message

#### Scenario: Announcements display reaction bar
- **WHEN** `feature_reactions` is `true` and a user views announcements
- **THEN** each announcement displays a reaction bar below the announcement metadata
- **THEN** the reaction bar shows existing reaction counts and a picker to add new reactions
