## ADDED Requirements

### Requirement: Member directory listing

The system SHALL provide `directory.html` displaying active members in a searchable grid/list. Each member card SHALL show `avatar_url`, `display_name`, `tier` name, and any custom fields marked `visible_in_directory = true`.

#### Scenario: Directory shows active members
- **WHEN** an authenticated user visits `directory.html`
- **THEN** all members with `status = 'active'` are displayed
- **THEN** pending, expired, and suspended members are not shown

#### Scenario: Directory shows tier badge
- **WHEN** a member has an assigned tier
- **THEN** the tier name is displayed on their directory card

### Requirement: Directory search and filter

The directory SHALL support real-time search by `display_name` and `email` (client-side filtering). It SHALL support filtering by membership tier via a dropdown.

#### Scenario: Search by name
- **WHEN** a user types "Sarah" in the search box
- **THEN** only members whose `display_name` contains "Sarah" (case-insensitive) are shown

#### Scenario: Filter by tier
- **WHEN** a user selects "Gold" from the tier filter dropdown
- **THEN** only members with the "Gold" tier are displayed

### Requirement: Directory respects authentication

The directory page SHALL be visible only to authenticated users when `site_config` key `directory_public` is `false`. When `directory_public` is `true`, it SHALL be visible to everyone.

#### Scenario: Auth-gated directory
- **WHEN** `directory_public` is `false` and an unauthenticated user visits `directory.html`
- **THEN** they are redirected to login

#### Scenario: Public directory
- **WHEN** `directory_public` is `true`
- **THEN** unauthenticated users can view the directory

### Requirement: Member detail view

Clicking a member in the directory SHALL show their full profile: `display_name`, `avatar_url`, `bio`, `tier`, `joined_at`, and all visible custom fields.

#### Scenario: View member profile
- **WHEN** a user clicks on a member card
- **THEN** a detail view (modal or expanded card) shows the member's full profile information
