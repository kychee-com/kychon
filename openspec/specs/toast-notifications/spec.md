## ADDED Requirements

### Requirement: Toast notification display

The system SHALL provide a `showToast(message, type)` function that displays a slide-in notification. The `type` parameter SHALL accept `success`, `error`, or `info`, each with a distinct icon and color accent. The toast SHALL appear at the bottom-right of the viewport.

#### Scenario: Success toast shown
- **WHEN** `showToast('You are going!', 'success')` is called
- **THEN** a toast with a checkmark icon and success color accent slides in from the bottom-right

#### Scenario: Error toast shown
- **WHEN** `showToast('Could not RSVP', 'error')` is called
- **THEN** a toast with an X icon and danger color accent slides in from the bottom-right

#### Scenario: Info toast shown
- **WHEN** `showToast('Announcement posted', 'info')` is called
- **THEN** a toast with an info icon and primary color accent slides in from the bottom-right

### Requirement: Toast auto-dismiss

Each toast SHALL automatically dismiss after 3 seconds with a slide-out animation. Only one toast SHALL be visible at a time — a new toast replaces the previous one.

#### Scenario: Toast auto-dismisses
- **WHEN** a toast is displayed
- **THEN** it automatically slides out and is removed after 3 seconds

#### Scenario: New toast replaces existing
- **WHEN** a toast is visible and a new `showToast` call is made
- **THEN** the previous toast is immediately replaced by the new one

### Requirement: Toast accessibility

The toast container SHALL have `role="status"` and `aria-live="polite"` so screen readers announce toast messages.

#### Scenario: Screen reader announces toast
- **WHEN** a toast is displayed
- **THEN** screen readers announce the toast message via the `aria-live` region

### Requirement: Toasts on user actions

The system SHALL show toast notifications for key user actions: RSVP confirmation, announcement creation, and error states.

#### Scenario: RSVP shows toast
- **WHEN** a user RSVPs to an event
- **THEN** a success toast is shown (e.g., "You're going!")

#### Scenario: Announcement post shows toast
- **WHEN** an admin posts an announcement
- **THEN** an info toast is shown (e.g., "Announcement posted")
