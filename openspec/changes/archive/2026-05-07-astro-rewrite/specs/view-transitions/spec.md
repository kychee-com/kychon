## ADDED Requirements

### Requirement: Client-side navigation via ClientRouter
The portal SHALL use Astro's `<ClientRouter />` component in the Portal layout to enable client-side page transitions. All internal link clicks SHALL be intercepted by the router, fetching the target page as HTML and swapping the DOM without a full browser reload.

#### Scenario: Navigate between pages
- **WHEN** a user clicks a nav link (e.g., from Home to Events)
- **THEN** the page transitions smoothly without a full browser reload
- **AND** the URL updates in the browser address bar
- **AND** the browser back/forward buttons work correctly

#### Scenario: Fallback for unsupported browsers
- **WHEN** a browser does not support the View Transition API
- **THEN** navigation falls back to standard full page loads
- **AND** all functionality remains intact

### Requirement: Persistent elements across transitions
The nav bar and footer SHALL persist across page transitions using `transition:persist`. The ConfigProvider and AuthProvider islands SHALL also persist so that auth state and config are not re-fetched on every navigation.

#### Scenario: Nav persists during navigation
- **WHEN** a user navigates from Events to Directory
- **THEN** the nav bar does not re-render or flash
- **AND** the active nav item updates to reflect the current page

#### Scenario: Auth state persists during navigation
- **WHEN** a logged-in user navigates between pages
- **THEN** the auth session is not re-checked or re-fetched
- **AND** admin controls remain visible without flickering

### Requirement: Page transition animations
Page transitions SHALL use a fade animation by default. The animation SHALL respect the user's `prefers-reduced-motion` setting.

#### Scenario: Reduced motion preference
- **WHEN** a user has `prefers-reduced-motion: reduce` set
- **THEN** page transitions use an instant swap with no animation

#### Scenario: Default transition animation
- **WHEN** a user navigates between pages with no motion preference
- **THEN** the outgoing page fades out and the incoming page fades in
