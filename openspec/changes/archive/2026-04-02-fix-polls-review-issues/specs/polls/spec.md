## MODIFIED Requirements

### Requirement: Poll CRUD

The system SHALL support creating, reading, and deleting polls. Each poll MUST have: question (TEXT), poll_type (constrained to 'single' or 'multiple'), is_anonymous (BOOLEAN), results_visible (constrained to 'always', 'after_vote', or 'after_close'), is_open (BOOLEAN), and optional description, closes_at, attached_to, and attached_id fields. Only admin users SHALL be able to create polls by default. Members MAY create polls when `polls_member_create` is `true` in site_config.

The `poll_type` column SHALL have a CHECK constraint restricting values to `'single'` and `'multiple'`. The `results_visible` column SHALL have a CHECK constraint restricting values to `'always'`, `'after_vote'`, and `'after_close'`. The Zod schema SHALL use `z.enum()` for both fields.

#### Scenario: Admin creates a standalone poll
- **WHEN** an admin submits the poll creation form on `/polls` with question, options (minimum 2), and settings
- **THEN** a poll row is inserted with `attached_to = NULL`
- **THEN** poll_options rows are inserted for each option with sequential position values
- **THEN** an activity_log entry is created with action `poll_create`
- **THEN** the poll appears on the `/polls` page

#### Scenario: Invalid poll_type rejected at database level
- **WHEN** an insert or update attempts to set `poll_type` to a value other than 'single' or 'multiple'
- **THEN** the database SHALL reject the operation with a constraint violation

#### Scenario: Invalid results_visible rejected at database level
- **WHEN** an insert or update attempts to set `results_visible` to a value other than 'always', 'after_vote', or 'after_close'
- **THEN** the database SHALL reject the operation with a constraint violation

#### Scenario: Minimum two options required
- **WHEN** a user attempts to create a poll with fewer than 2 options
- **THEN** the form prevents submission and shows a validation message
