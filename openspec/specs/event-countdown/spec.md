## ADDED Requirements

### Requirement: Event countdown section on homepage

A new `event-countdown` section type SHALL display a countdown to the next upcoming event. The section SHALL fetch the soonest event where `start_date > now()` from the events API. It SHALL display the event title and a countdown showing days, hours, and minutes. The countdown SHALL update every 60 seconds.

#### Scenario: Upcoming event exists
- **WHEN** the homepage loads and there is at least one future event
- **THEN** the event-countdown section displays the event title and a countdown (e.g., "3d 14h 22m")
- **THEN** the countdown updates every 60 seconds

#### Scenario: No upcoming events
- **WHEN** there are no future events in the database
- **THEN** the event-countdown section is not rendered (hidden)

#### Scenario: Event time passes while page is open
- **WHEN** the countdown reaches zero (event start time has passed)
- **THEN** the section displays "Happening now!" instead of the countdown
- **THEN** after the event end time passes, the section fetches the next upcoming event or hides

### Requirement: Event countdown gated by feature flag

The event-countdown section SHALL only render when `feature_events` is `true` in `site_config`. When events are disabled, the section is hidden regardless of section config.

#### Scenario: Events feature enabled
- **WHEN** `feature_events` is `true` and an `event-countdown` section exists
- **THEN** the countdown renders normally

#### Scenario: Events feature disabled
- **WHEN** `feature_events` is `false`
- **THEN** the event-countdown section is not rendered

### Requirement: Event countdown links to the event

The countdown section SHALL link to the event detail page so users can RSVP directly.

#### Scenario: User clicks the countdown
- **WHEN** a user clicks the event title or a CTA in the countdown section
- **THEN** they are navigated to `event.html?id={event_id}`
