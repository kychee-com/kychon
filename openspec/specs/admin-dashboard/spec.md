## ADDED Requirements

### Requirement: Admin dashboard with stats cards

`admin.html` SHALL display stats cards showing: total active members, pending members, total announcements, and members expiring within 30 days. Stats SHALL be fetched via REST API queries with count headers.

#### Scenario: Dashboard shows member stats
- **WHEN** an admin visits `admin.html`
- **THEN** they see cards with current counts for active members, pending members, announcements, and expiring members

### Requirement: Activity feed on dashboard

The dashboard SHALL display the most recent 20 entries from `activity_log`, showing the member name, action type, and timestamp.

#### Scenario: Activity feed renders
- **WHEN** an admin visits the dashboard
- **THEN** the latest activity entries are displayed in reverse chronological order
- **THEN** each entry shows who did what and when

### Requirement: Admin member management page

`admin-members.html` SHALL list all members with search, filter by status (active/pending/expired/suspended), and filter by tier. Admins SHALL be able to: approve pending members, change member tier, change member role, suspend/activate members, and export members to CSV.

#### Scenario: Approve pending member
- **WHEN** an admin clicks "Approve" on a pending member
- **THEN** the member's `status` changes to `active`
- **THEN** the member list updates without page reload

#### Scenario: Change member tier
- **WHEN** an admin selects a different tier for a member
- **THEN** the member's `tier_id` is updated via PATCH

#### Scenario: Suspend a member
- **WHEN** an admin clicks "Suspend" on an active member
- **THEN** the member's `status` changes to `suspended`

#### Scenario: Export members to CSV
- **WHEN** an admin clicks "Export CSV"
- **THEN** a CSV file downloads containing all member data (display_name, email, tier, status, joined_at, custom_fields)

### Requirement: Site settings panel

`admin-settings.html` SHALL allow admins to edit: site name, tagline, description, logo URL, favicon URL, theme colors, feature flags (toggle switches), membership tier configuration, and custom field configuration.

#### Scenario: Change site name
- **WHEN** an admin changes the site name and saves
- **THEN** `site_config` key `site_name` is updated
- **THEN** the site name updates across all pages on next load

#### Scenario: Toggle feature flag
- **WHEN** an admin toggles `feature_forum` to off
- **THEN** `site_config` key `feature_forum` is set to `false`
- **THEN** the forum nav item disappears on next page load

#### Scenario: Edit theme colors
- **WHEN** an admin changes the primary color to `#dc2626`
- **THEN** the `theme` JSONB in `site_config` is updated
- **THEN** CSS variables update on next page load

### Requirement: Admin pages require admin role

All admin pages (`admin.html`, `admin-members.html`, `admin-settings.html`) SHALL check the current user's role on load. Non-admin users SHALL be redirected to the home page.

#### Scenario: Non-admin redirected
- **WHEN** a member (non-admin) navigates to any admin page
- **THEN** they are redirected to `index.html`
