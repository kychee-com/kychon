## ADDED Requirements

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

### Requirement: Admin creates announcements

Admins SHALL be able to create announcements with a `title` and `body` (rich text). The `author_id` SHALL be set to the current admin's member ID. Announcements SHALL appear immediately after creation.

#### Scenario: Admin creates announcement
- **WHEN** an admin writes a title and body and clicks "Post"
- **THEN** a new row is inserted into `announcements`
- **THEN** the announcement appears in the feed without page reload

### Requirement: Admin pins and unpins announcements

Admins SHALL be able to toggle `is_pinned` on an announcement.

#### Scenario: Pin an announcement
- **WHEN** an admin clicks "Pin" on an announcement
- **THEN** `is_pinned` is set to `true`
- **THEN** the announcement moves to the top of the feed

#### Scenario: Unpin an announcement
- **WHEN** an admin clicks "Unpin" on a pinned announcement
- **THEN** `is_pinned` is set to `false`
- **THEN** the announcement returns to chronological order

### Requirement: Admin edits and deletes announcements

Admins SHALL be able to edit the title and body of existing announcements (via inline editing) and delete announcements.

#### Scenario: Edit announcement
- **WHEN** an admin edits an announcement's title or body
- **THEN** the changes are saved via PATCH to the `announcements` endpoint

#### Scenario: Delete announcement
- **WHEN** an admin clicks "Delete" on an announcement
- **THEN** the announcement is removed from the database and disappears from the feed

### Requirement: Announcements log to activity

Creating an announcement SHALL insert a row into `activity_log` with `action = 'announcement'`.

#### Scenario: Activity logged on create
- **WHEN** an admin creates an announcement
- **THEN** an `activity_log` entry is created with the admin's `member_id` and `action = 'announcement'`
