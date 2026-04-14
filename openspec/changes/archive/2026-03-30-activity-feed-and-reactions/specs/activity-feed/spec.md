## ADDED Requirements

### Requirement: Activity feed section renders on homepage

The system SHALL render an activity feed section on the homepage when `feature_activity_feed` is enabled and a `sections` row with `section_type = 'activity_feed'` exists. The feed SHALL display the most recent 20 activity log entries in reverse chronological order, showing member avatar, display name, action description, and relative timestamp.

#### Scenario: Activity feed renders with entries
- **WHEN** the homepage loads and `feature_activity_feed` is `true`
- **THEN** the activity feed section displays up to 20 recent activity entries
- **THEN** each entry shows the member's avatar (or initials fallback), display name, action description, and relative time (e.g., "2 hours ago")

#### Scenario: Activity feed hidden when feature flag is off
- **WHEN** `feature_activity_feed` is `false`
- **THEN** the activity feed section SHALL NOT render, even if a `sections` row exists for it

#### Scenario: Activity feed empty state
- **WHEN** the activity feed is enabled but `activity_log` has no entries
- **THEN** the section SHALL display a placeholder message: "No recent activity yet."

### Requirement: Activity feed entry rendering by action type

The system SHALL render each activity log entry using a human-readable template based on the `action` field. The `metadata` JSONB column SHALL provide context for interpolation.

#### Scenario: Member join action
- **WHEN** an activity entry has `action = 'member_join'`
- **THEN** it renders as "{display_name} joined the community"

#### Scenario: Announcement action
- **WHEN** an activity entry has `action = 'announcement'`
- **THEN** it renders as "{display_name} posted an announcement: {title}"
- **THEN** `title` is read from `metadata.title`

#### Scenario: RSVP action
- **WHEN** an activity entry has `action = 'rsvp'`
- **THEN** it renders as "{display_name} is going to {event_title}"
- **THEN** `event_title` is read from `metadata.event_title`

#### Scenario: Resource upload action
- **WHEN** an activity entry has `action = 'resource_upload'`
- **THEN** it renders as "{display_name} shared a resource: {title}"
- **THEN** `title` is read from `metadata.title`

#### Scenario: Forum post action
- **WHEN** an activity entry has `action = 'forum_post'`
- **THEN** it renders as "{display_name} started a discussion: {title}"
- **THEN** `title` is read from `metadata.title`

#### Scenario: Unknown action type
- **WHEN** an activity entry has an unrecognized `action` value
- **THEN** it renders as "{display_name} was active" (graceful fallback)

### Requirement: Activity feed queries members for display

The system SHALL join or enrich activity log entries with member data (`display_name`, `avatar_url`) from the `members` table using `member_id`. Entries whose `member_id` references a deleted or missing member SHALL display "Former member" as the name.

#### Scenario: Activity entry with valid member
- **WHEN** an activity entry has a `member_id` matching a row in `members`
- **THEN** the entry displays that member's `display_name` and `avatar_url`

#### Scenario: Activity entry with missing member
- **WHEN** an activity entry has a `member_id` that does not match any `members` row
- **THEN** the entry displays "Former member" and a generic avatar

### Requirement: Activity feed as a config-driven section type

The `activity_feed` section type SHALL be supported by the homepage section renderer. It SHALL be insertable via a `sections` table row with `section_type = 'activity_feed'` and configurable via the `config` JSONB column.

#### Scenario: Section config options
- **WHEN** an `activity_feed` section has `config.limit`
- **THEN** the feed displays at most `config.limit` entries (default: 20)

#### Scenario: Section positioned via sections table
- **WHEN** an `activity_feed` section has `position = 2`
- **THEN** it renders after sections with `position = 1` and before sections with `position = 3`

### Requirement: Expanded activity logging across features

The system SHALL log activity for these actions beyond the existing `announcement` and `member_join` types: `rsvp` (when a member RSVPs to an event), `resource_upload` (when a resource is created), `forum_post` (when a forum topic is created), and `reaction` (when a member reacts to content). Each log entry SHALL include relevant context in the `metadata` JSONB.

#### Scenario: RSVP logs activity
- **WHEN** a member RSVPs to an event
- **THEN** an `activity_log` entry is created with `action = 'rsvp'` and `metadata = { event_title, event_id }`

#### Scenario: Resource upload logs activity
- **WHEN** a member uploads a resource
- **THEN** an `activity_log` entry is created with `action = 'resource_upload'` and `metadata = { title, resource_id }`

#### Scenario: Forum topic logs activity
- **WHEN** a member creates a forum topic
- **THEN** an `activity_log` entry is created with `action = 'forum_post'` and `metadata = { title, topic_id }`

#### Scenario: Reaction logs activity
- **WHEN** a member adds a reaction
- **THEN** an `activity_log` entry is created with `action = 'reaction'` and `metadata = { content_type, content_id, emoji }`
