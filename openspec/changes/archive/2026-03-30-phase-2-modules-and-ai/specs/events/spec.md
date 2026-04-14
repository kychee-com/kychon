## ADDED Requirements

### Requirement: Event Management

The system SHALL support CRUD operations for events. Each event MUST have: title, description, location, starts_at, ends_at, capacity, image_url, and is_members_only fields. Only admin users SHALL be able to create, edit, or delete events.

#### Scenario: Admin creates a new event
- **WHEN** an admin submits the create event form with title, description, location, starts_at, ends_at, capacity, image_url, and is_members_only
- **THEN** the event SHALL be created and visible on the events listing page

#### Scenario: Admin edits an existing event
- **WHEN** an admin modifies an event's details and saves
- **THEN** the event SHALL be updated with the new values

#### Scenario: Admin deletes an event
- **WHEN** an admin deletes an event
- **THEN** the event SHALL be removed from the events listing and no longer accessible

#### Scenario: Non-admin cannot manage events
- **WHEN** a non-admin user attempts to create, edit, or delete an event
- **THEN** the system SHALL deny the action

### Requirement: RSVP System

The system SHALL allow members to RSVP to events with a status of going, maybe, or cancelled. A unique constraint MUST be enforced per event and member combination, preventing duplicate RSVPs.

#### Scenario: Member RSVPs to an event
- **WHEN** a member clicks the RSVP button on an event detail page and selects going or maybe
- **THEN** the RSVP SHALL be recorded and the attendee count SHALL update accordingly

#### Scenario: Member changes RSVP status
- **WHEN** a member changes their RSVP from going to cancelled
- **THEN** the RSVP status SHALL be updated and the attendee count SHALL decrease

#### Scenario: Duplicate RSVP prevented
- **WHEN** a member attempts to create a second RSVP for the same event
- **THEN** the system SHALL reject the duplicate and maintain the existing RSVP

### Requirement: Events Listing Page

The system SHALL display an events listing page showing upcoming events first, sorted by starts_at ascending. Past events SHALL be displayed in a separate section below upcoming events.

#### Scenario: Viewing the events listing
- **WHEN** a user visits the events listing page
- **THEN** upcoming events SHALL appear first sorted by start date, followed by a past events section

### Requirement: Event Detail Page

The system SHALL display an event detail page showing all event information, an RSVP button for members, and the current attendee count.

#### Scenario: Member views event detail
- **WHEN** a member navigates to an event detail page
- **THEN** the page SHALL display the event details, an RSVP button, and the number of attendees

### Requirement: Capacity Enforcement

The system SHALL enforce event capacity limits. When an event reaches its capacity, no additional going RSVPs SHALL be accepted.

#### Scenario: Event at capacity
- **WHEN** a member attempts to RSVP as going to an event that has reached its capacity
- **THEN** the system SHALL reject the RSVP and inform the member the event is full

#### Scenario: Capacity freed by cancellation
- **WHEN** an attendee cancels their RSVP and the event was at capacity
- **THEN** a new member SHALL be able to RSVP as going

### Requirement: Members-Only Events

Events marked as is_members_only SHALL be hidden from anonymous (unauthenticated) users. Only authenticated members SHALL see members-only events in listings and be able to access their detail pages.

#### Scenario: Anonymous user views events listing with members-only events
- **WHEN** an anonymous user visits the events listing page
- **THEN** members-only events SHALL NOT appear in the listing

#### Scenario: Authenticated member views members-only event
- **WHEN** an authenticated member visits the events listing page
- **THEN** members-only events SHALL appear alongside public events
