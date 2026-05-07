## MODIFIED Requirements

### Requirement: Auth as a client:load island
The auth system SHALL be packaged as an `AuthProvider.astro` component loaded with `client:load` in the Portal layout. It SHALL:
- Check for an existing session in localStorage on load
- Handle Google OAuth PKCE callback (hash fragment → session token)
- Expose `getSession()`, `getRole()`, `isAdmin()`, `isAuthenticated()` via a shared module (`src/lib/auth.ts`)
- Refresh tokens on 401 responses
- Persist across view transitions using `transition:persist`

#### Scenario: Auth state available to other islands
- **WHEN** any island component needs to check auth state
- **THEN** it imports from `src/lib/auth.ts` and calls `getSession()` or `isAdmin()`
- **AND** the auth state is consistent across all islands on the page

#### Scenario: Auth persists across page navigations
- **WHEN** a logged-in user navigates via view transitions
- **THEN** the AuthProvider island is not re-created
- **AND** the session is not re-fetched from localStorage

### Requirement: Role-based UI gating
Admin-only UI elements (edit controls, admin nav links, admin pages) SHALL be gated by the auth state. The AdminEditor island SHALL only render when `isAdmin()` returns true.

#### Scenario: Admin controls appear after login
- **WHEN** an admin user logs in on the join page
- **THEN** on the next page navigation, admin controls are visible
- **AND** the admin editor island loads

#### Scenario: Non-admin cannot access admin pages
- **WHEN** a non-admin user navigates to `/admin.html`
- **THEN** the page redirects to the home page or shows an access denied message
