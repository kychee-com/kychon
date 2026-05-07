## Purpose

Kychon uses Astro view transitions to keep portal navigation smooth while preserving persistent chrome, authentication state, and accessibility preferences.

## Requirements

### Requirement: Client-side navigation via ClientRouter

The portal SHALL use Astro's `<ClientRouter />` component in the Portal layout to enable client-side page transitions for supported browsers.

#### Scenario: Navigate between pages
- **WHEN** a user clicks an internal nav link
- **THEN** the page transitions without a full browser reload when the browser supports the router behavior
- **AND** the URL updates in the browser address bar
- **AND** the browser back and forward buttons work correctly

#### Scenario: Fallback for unsupported browsers
- **WHEN** a browser does not support the required transition behavior
- **THEN** navigation falls back to standard full page loads
- **AND** all functionality remains intact

### Requirement: Persistent elements across transitions

Shared header and footer chrome SHALL persist across page transitions using `transition:persist`. Config and auth provider islands SHALL persist or re-initialize idempotently so auth state and configuration do not visibly flicker during navigation.

#### Scenario: Nav persists during navigation
- **WHEN** a user navigates from Events to Directory
- **THEN** the nav bar remains stable during the transition
- **AND** the active nav item updates to reflect the current page

#### Scenario: Auth state persists during navigation
- **WHEN** a logged-in user navigates between pages
- **THEN** the session remains available from localStorage-backed auth helpers
- **AND** admin controls remain consistently gated

### Requirement: Page transition animations

Page transitions SHALL use motion that respects the user's `prefers-reduced-motion` setting.

#### Scenario: Reduced motion preference
- **WHEN** a user has `prefers-reduced-motion: reduce` set
- **THEN** page transitions avoid non-essential animation

#### Scenario: Default transition animation
- **WHEN** a user navigates between pages with no reduced-motion preference
- **THEN** supported transitions may animate the outgoing and incoming page content smoothly
