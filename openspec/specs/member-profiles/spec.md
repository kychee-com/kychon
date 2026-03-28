## ADDED Requirements

### Requirement: Member record creation on signup

The system SHALL create a `members` row when a user signs up, populated with `user_id`, `email`, `display_name`, and `avatar_url` from the auth provider. The `custom_fields` column SHALL default to `'{}'::jsonb`.

#### Scenario: Google user gets member record
- **WHEN** a Google OAuth user signs up
- **THEN** a `members` row is created with `display_name` and `avatar_url` from Google profile

#### Scenario: Password user gets member record
- **WHEN** a password user signs up
- **THEN** a `members` row is created with `display_name` derived from email (before @) and `avatar_url` as null

### Requirement: Profile editor page

The system SHALL provide `profile.html` where authenticated members can edit their `display_name`, `bio`, `avatar_url`, and any custom fields defined in `member_custom_fields`. Changes SHALL be saved via PATCH to the `members` REST endpoint.

#### Scenario: Member edits their display name
- **WHEN** a member changes their display name and saves
- **THEN** a PATCH request updates their `members` row
- **THEN** the updated name appears on the page without reload

#### Scenario: Member uploads avatar
- **WHEN** a member clicks their avatar and selects a file
- **THEN** the file is uploaded to Run402 storage
- **THEN** the `avatar_url` is updated in their `members` row
- **THEN** the new avatar displays immediately

### Requirement: Custom fields render dynamically

The profile editor SHALL read `member_custom_fields` from the database and render form inputs matching each field's `field_type` (text, select, multiselect, date, url, textarea). Field values SHALL be stored in the member's `custom_fields` JSONB column.

#### Scenario: Text custom field
- **WHEN** a custom field of type `text` exists (e.g., "Company Name")
- **THEN** the profile editor shows a text input with the field's label
- **THEN** saving updates `custom_fields.company` in the member's row

#### Scenario: Select custom field
- **WHEN** a custom field of type `select` exists with `options: ["Option A", "Option B"]`
- **THEN** the profile editor shows a dropdown with those options

### Requirement: Profile requires authentication

`profile.html` SHALL redirect unauthenticated users to the login page.

#### Scenario: Unauthenticated user visits profile
- **WHEN** an unauthenticated user navigates to `profile.html`
- **THEN** they are redirected to `index.html` with a login prompt
