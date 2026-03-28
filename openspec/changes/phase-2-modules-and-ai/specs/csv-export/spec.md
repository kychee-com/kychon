## ADDED Requirements

### Requirement: CSV Export Edge Function

The system SHALL provide an edge function that exports data as CSV. The function SHALL be triggered from the admin UI and return the CSV as a downloadable response.

#### Scenario: Admin triggers CSV export
- **WHEN** an admin clicks the export button in the admin UI
- **THEN** the system SHALL generate a CSV file and return it as a downloadable response

### Requirement: Members CSV Export

The members CSV export SHALL include the following fields: display_name, email, status, role, tier, joined_at, and custom_fields.

#### Scenario: Admin exports members as CSV
- **WHEN** an admin triggers the members CSV export
- **THEN** the downloaded CSV SHALL contain columns for display_name, email, status, role, tier, joined_at, and custom_fields with one row per member

#### Scenario: Members export includes all members
- **WHEN** an admin exports members as CSV
- **THEN** all members in the system SHALL be included in the export

### Requirement: Events CSV Export

The events CSV export SHALL include the following fields: title, starts_at, ends_at, location, and rsvp_count.

#### Scenario: Admin exports events as CSV
- **WHEN** an admin triggers the events CSV export
- **THEN** the downloaded CSV SHALL contain columns for title, starts_at, ends_at, location, and rsvp_count with one row per event

#### Scenario: Events export includes RSVP count
- **WHEN** an admin exports events as CSV
- **THEN** each event row SHALL include the total count of going RSVPs as the rsvp_count

### Requirement: Export Access Control

Only admin users SHALL be able to trigger CSV exports. Non-admin users MUST be denied access to the export edge function.

#### Scenario: Non-admin attempts CSV export
- **WHEN** a non-admin user attempts to call the CSV export edge function
- **THEN** the system SHALL deny the request and return an unauthorized error
