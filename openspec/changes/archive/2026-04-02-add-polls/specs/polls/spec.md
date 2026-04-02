## ADDED Requirements

### Requirement: Poll CRUD

The system SHALL support creating, reading, and deleting polls. Each poll MUST have: question (TEXT), poll_type ('single' or 'multiple'), is_anonymous (BOOLEAN), results_visible ('always', 'after_vote', or 'after_close'), is_open (BOOLEAN), and optional description, closes_at, attached_to, and attached_id fields. Only admin users SHALL be able to create polls by default. Members MAY create polls when `polls_member_create` is `true` in site_config.

#### Scenario: Admin creates a standalone poll
- **WHEN** an admin submits the poll creation form on `/polls` with question, options (minimum 2), and settings
- **THEN** a poll row is inserted with `attached_to = NULL`
- **THEN** poll_options rows are inserted for each option with sequential position values
- **THEN** an activity_log entry is created with action `poll_create`
- **THEN** the poll appears on the `/polls` page

#### Scenario: Admin creates a poll attached to an announcement
- **WHEN** an admin clicks "Add Poll" in the announcement editor and fills in the poll form
- **THEN** the announcement is saved first, returning its ID
- **THEN** the poll is created with `attached_to = 'announcement'` and `attached_id` = the announcement ID
- **THEN** the poll widget renders below the announcement body

#### Scenario: Admin creates a poll attached to a forum topic
- **WHEN** an admin clicks "Add Poll" in the forum topic creation form and fills in the poll form
- **THEN** the topic is saved first, returning its ID
- **THEN** the poll is created with `attached_to = 'forum_topic'` and `attached_id` = the topic ID
- **THEN** the poll widget renders in the topic detail view

#### Scenario: Member creates a poll (when allowed)
- **WHEN** `polls_member_create` is `true` and an authenticated member submits the poll creation form
- **THEN** the poll is created with `created_by` = the member's ID

#### Scenario: Member cannot create polls when disabled
- **WHEN** `polls_member_create` is `false` and a non-admin member views `/polls`
- **THEN** the "Create Poll" button is not shown

#### Scenario: Admin deletes a poll
- **WHEN** an admin deletes a poll
- **THEN** the poll, its options, and all votes are deleted (CASCADE)

#### Scenario: Minimum two options required
- **WHEN** a user attempts to create a poll with fewer than 2 options
- **THEN** the form prevents submission and shows a validation message

### Requirement: Voting

Members SHALL be able to vote on open polls. Single-choice polls allow one selection; multiple-choice polls allow multiple selections. Members MAY change their vote on open polls.

#### Scenario: Member votes on a single-choice poll
- **WHEN** an authenticated member clicks an option on a single-choice poll
- **THEN** any existing vote by that member on that poll is deleted
- **THEN** a new poll_votes row is inserted with the selected option
- **THEN** an activity_log entry is created with action `poll_vote`
- **THEN** the poll widget re-renders with updated counts

#### Scenario: Member changes vote on a single-choice poll
- **WHEN** a member clicks a different option on a single-choice poll they already voted on
- **THEN** the previous vote is replaced with the new selection
- **THEN** the poll widget re-renders showing the new selection

#### Scenario: Member votes on a multiple-choice poll
- **WHEN** an authenticated member clicks an option on a multiple-choice poll
- **THEN** if the member has not voted for that option, a poll_votes row is inserted
- **THEN** if the member has already voted for that option, the poll_votes row is deleted (toggle)
- **THEN** the poll widget re-renders with updated counts

#### Scenario: Duplicate vote prevented
- **WHEN** a member attempts to insert a duplicate (poll_id, member_id, option_id) row
- **THEN** the UNIQUE constraint prevents the duplicate

#### Scenario: Voting on closed poll prevented
- **WHEN** a member attempts to vote on a poll where `is_open = false`
- **THEN** the vote buttons are not shown and no vote can be submitted

#### Scenario: Unauthenticated users cannot vote
- **WHEN** an unauthenticated user views a poll
- **THEN** the poll results are displayed (per results_visible policy) but no vote buttons are shown

### Requirement: Results visibility

Poll results SHALL be displayed according to the poll's `results_visible` setting.

#### Scenario: results_visible = 'always'
- **WHEN** any user (authenticated or not) views the poll
- **THEN** option labels, vote counts, and percentage bars are shown
- **THEN** if the user has voted, their selection is highlighted

#### Scenario: results_visible = 'after_vote' (before voting)
- **WHEN** an authenticated member who has not voted views the poll
- **THEN** option labels are shown as selectable buttons without counts or bars
- **THEN** the total vote count is shown (e.g., "72 votes")

#### Scenario: results_visible = 'after_vote' (after voting)
- **WHEN** an authenticated member who has voted views the poll
- **THEN** option labels, vote counts, and percentage bars are shown
- **THEN** the member's selection is highlighted with a checkmark

#### Scenario: results_visible = 'after_close' (while open)
- **WHEN** a member views an open poll with `results_visible = 'after_close'`
- **THEN** option labels are shown; if the member voted, their selection is indicated
- **THEN** no counts or percentage bars are shown
- **THEN** a message reads "Results shown after poll closes"

#### Scenario: results_visible = 'after_close' (after close)
- **WHEN** any user views a closed poll with `results_visible = 'after_close'`
- **THEN** full results with counts and bars are shown

### Requirement: Anonymous polls

When `is_anonymous = true`, voter identity SHALL NOT be exposed in the UI or API responses. The system SHALL still store `member_id` internally to enforce vote uniqueness.

#### Scenario: Anonymous poll hides voter identity
- **WHEN** a user views results of an anonymous poll
- **THEN** no voter names or member IDs are displayed
- **THEN** only aggregate counts and percentages are shown

#### Scenario: Non-anonymous poll shows voters (optional)
- **WHEN** a user views results of a non-anonymous poll
- **THEN** voter names MAY be shown (e.g., on hover or in a details panel)

### Requirement: Poll auto-close on page load

Polls with a `closes_at` timestamp in the past SHALL be treated as closed when rendered.

#### Scenario: Expired poll auto-closes
- **WHEN** a poll with `closes_at` in the past is rendered and `is_open` is still `true`
- **THEN** the UI treats the poll as closed (no vote buttons, full results per visibility policy)
- **THEN** a PATCH request sets `is_open = false` on the poll

#### Scenario: Poll with no expiry stays open
- **WHEN** a poll has `closes_at = NULL`
- **THEN** the poll remains open until manually closed by an admin

### Requirement: Poll deletion cascades with parent content

When a content item with an attached poll is deleted, the attached poll SHALL also be deleted.

#### Scenario: Deleting announcement deletes attached poll
- **WHEN** an admin deletes an announcement that has an attached poll
- **THEN** the poll with `attached_to = 'announcement'` and `attached_id` = the announcement ID is also deleted

#### Scenario: Deleting forum topic deletes attached poll
- **WHEN** an admin deletes a forum topic that has an attached poll
- **THEN** the poll with `attached_to = 'forum_topic'` and `attached_id` = the topic ID is also deleted

### Requirement: Polls are feature-flagged

The polls UI SHALL only render when `feature_polls` is `true` in `site_config`. The `/polls` nav item SHALL only appear when the flag is enabled.

#### Scenario: Feature flag enabled
- **WHEN** `feature_polls` is `true`
- **THEN** the `/polls` page is accessible, polls render in announcements/forum/homepage, and the nav item is shown

#### Scenario: Feature flag disabled
- **WHEN** `feature_polls` is `false`
- **THEN** no poll UI renders anywhere, the nav item is hidden, and existing poll data is preserved

### Requirement: Polls homepage section

A new section type `polls` SHALL be supported on the homepage. The section config specifies which polls to feature.

#### Scenario: Homepage polls section renders featured polls
- **WHEN** a section with `section_type = 'polls'` exists and is visible
- **THEN** the polls specified in `config.poll_ids` are rendered as interactive poll widgets
- **THEN** members can vote directly from the homepage

### Requirement: Standalone polls page

The `/polls` page SHALL list all standalone polls (where `attached_to IS NULL`) and provide a creation form for authorized users.

#### Scenario: Viewing the polls page
- **WHEN** a user visits `/polls`
- **THEN** open polls are listed first, followed by closed polls
- **THEN** each poll shows the question, option count, total votes, and status (open/closed)

#### Scenario: Viewing poll detail on the polls page
- **WHEN** a user clicks on a poll in the list
- **THEN** the full poll widget expands or navigates to show all options and results per visibility policy
