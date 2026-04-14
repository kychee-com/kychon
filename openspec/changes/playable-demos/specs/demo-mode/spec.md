## ADDED Requirements

### Requirement: Demo mode detection via site_config

The system SHALL detect demo mode by reading the `demo_mode` key from `site_config`. When `demo_mode` is `true`, the system SHALL render the `DemoBanner` component above the navigation in `Portal.astro`. When `demo_mode` is absent or `false`, no demo UI SHALL be shown.

#### Scenario: Demo site loads with demo_mode enabled
- **WHEN** a visitor loads any page on a demo site
- **AND** `site_config` contains `demo_mode` = `true`
- **THEN** the DemoBanner component is rendered above the navigation bar

#### Scenario: Production site has no demo UI
- **WHEN** a visitor loads any page on a production portal
- **AND** `site_config` does not contain `demo_mode` or it is `false`
- **THEN** no DemoBanner is rendered and no demo-related UI is visible

### Requirement: Demo banner displays current role and demo status

The DemoBanner SHALL be a sticky top banner (above nav, `z-index: 1001`) that displays: a demo site indicator, the current role (Visitor / Member / Admin), role-switching buttons, a reset countdown, and a "Get Your Own Portal" CTA link.

#### Scenario: Unauthenticated visitor sees banner with role options
- **WHEN** a visitor loads a demo site without being signed in
- **THEN** the banner shows "Demo Site" indicator
- **AND** the current role displays as "Visitor"
- **AND** two buttons are shown: "Try as Admin" and "Try as Member"
- **AND** a "Get Your Own Portal" link is visible pointing to kychon.com

#### Scenario: Signed-in admin sees banner with role indicator
- **WHEN** a visitor is signed in as the demo admin
- **THEN** the banner shows the current role as "Admin"
- **AND** buttons to "Switch to Member" and "Just Browse" are shown

#### Scenario: Signed-in member sees banner with role indicator
- **WHEN** a visitor is signed in as the demo member
- **THEN** the banner shows the current role as "Member"
- **AND** buttons to "Switch to Admin" and "Just Browse" are shown

### Requirement: One-click role switching via auto-login

The DemoBanner SHALL provide instant role switching by calling `signIn(email, password)` with hardcoded demo credentials. Switching roles SHALL sign out the current session first, then sign in with the target role's credentials, then reload the page.

#### Scenario: Visitor clicks "Try as Admin"
- **WHEN** an unauthenticated visitor clicks "Try as Admin"
- **THEN** the system calls `signIn('demo-admin@kychon.com', 'demo123')`
- **AND** the page reloads with the admin session active
- **AND** all admin features (inline editing, admin dashboard, settings) are functional with real writes

#### Scenario: Admin switches to Member
- **WHEN** an admin clicks "Switch to Member"
- **THEN** the system signs out the current session
- **AND** calls `signIn('demo-member@kychon.com', 'demo123')`
- **AND** the page reloads with the member session active

#### Scenario: Any role clicks "Just Browse"
- **WHEN** a signed-in user clicks "Just Browse"
- **THEN** the system signs out the current session
- **AND** the page reloads as an unauthenticated visitor

### Requirement: Reset countdown in banner

The DemoBanner SHALL display a countdown to the next hourly reset. The countdown SHALL be computed client-side from the `last_reset` value in `site_config` (set by the reset function). The next reset time is `last_reset + 60 minutes`.

#### Scenario: Banner shows time remaining until reset
- **WHEN** a demo page loads
- **AND** `site_config` contains `last_reset` with an ISO timestamp
- **THEN** the banner displays "Resets in Xm" where X is minutes until `last_reset + 60min`
- **AND** the countdown updates every 30 seconds

#### Scenario: Banner shows fallback when no last_reset exists
- **WHEN** a demo page loads
- **AND** `site_config` does not contain `last_reset`
- **THEN** the banner displays "Resets hourly" as a static message

### Requirement: Force-reload on reset

When the countdown reaches zero (or the client detects the reset has occurred), the DemoBanner SHALL display a brief "Demo resetting..." overlay and force-reload the page.

#### Scenario: Countdown reaches zero
- **WHEN** the client-side timer detects that the current time is past `last_reset + 60min`
- **THEN** the banner displays a full-width overlay with "Demo resetting..."
- **AND** the page reloads after a 2-second delay

#### Scenario: Recovery after reset
- **WHEN** the page reloads after a reset
- **THEN** the user's previous session may be invalid (member record re-created)
- **AND** the banner returns to the "Visitor" state with "Try as Admin" / "Try as Member" buttons

### Requirement: Demo credentials are hardcoded and transparent

The demo account credentials SHALL be hardcoded in the DemoBanner component's client-side JavaScript. The credentials are: `demo-admin@kychon.com` / `demo123` for admin, `demo-member@kychon.com` / `demo123` for member. These are intentionally visible in view-source.

#### Scenario: Credentials visible in page source
- **WHEN** a visitor views the page source of a demo site
- **THEN** the demo email addresses and passwords are visible in the DemoBanner script
- **AND** this is by design for demo transparency
