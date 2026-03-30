## ADDED Requirements

### Requirement: On-demand event recap generation

The system SHALL provide an edge function (`generate-recap.js`) that generates a recap announcement for a specific event. It SHALL read the event details (title, description, date, location) and attendance count (RSVPs with status `going`), send this data to the AI API with community context, and save the AI-generated recap as a draft announcement.

#### Scenario: Successful recap generation
- **WHEN** an admin triggers recap generation for an event that has ended
- **THEN** the system SHALL query the event details and RSVP count, call the AI API to generate a recap, and insert a draft row into `announcements` with the generated title and body

#### Scenario: Event has not ended yet
- **WHEN** an admin triggers recap generation for an event whose end time is in the future
- **THEN** the system SHALL reject the request and return an error indicating the event has not ended

#### Scenario: AI API key not configured
- **WHEN** recap generation is triggered but no AI API key is set
- **THEN** the function SHALL return an error indicating that an AI API key is required for recap generation

#### Scenario: AI API call fails
- **WHEN** the AI API returns an error during recap generation
- **THEN** the function SHALL return the error to the admin and NOT create a draft announcement

### Requirement: Recap trigger from admin UI

Admins SHALL be able to trigger event recap generation from the event detail view in the admin dashboard. A "Generate Recap" button SHALL appear for past events.

#### Scenario: Generate recap button visibility
- **WHEN** an admin views an event whose end time has passed
- **THEN** a "Generate Recap" button SHALL be visible

#### Scenario: Generate recap button hidden for future events
- **WHEN** an admin views an event whose end time is in the future
- **THEN** the "Generate Recap" button SHALL NOT be visible

#### Scenario: Admin clicks generate recap
- **WHEN** an admin clicks "Generate Recap" for a past event
- **THEN** the system SHALL call the recap edge function and display the generated recap as a draft announcement for review

### Requirement: Recap feature flag

Event recap generation SHALL be controlled by the `feature_event_recaps` flag in `site_config`. When disabled, the "Generate Recap" button SHALL not appear.

#### Scenario: Feature flag disabled
- **WHEN** `feature_event_recaps` is false in `site_config`
- **THEN** the "Generate Recap" button SHALL be hidden on all event pages

#### Scenario: Feature flag enabled
- **WHEN** `feature_event_recaps` is true in `site_config`
- **THEN** the "Generate Recap" button SHALL appear for past events
