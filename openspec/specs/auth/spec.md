## ADDED Requirements

### Requirement: Google OAuth login with PKCE

The system SHALL implement Google OAuth login using Run402's built-in auth. The frontend (`auth.js`) SHALL generate a PKCE verifier/challenge, call `/auth/v1/oauth/google/start` with a redirect URL, navigate to Google, and exchange the returned code for tokens via `/auth/v1/token?grant_type=authorization_code`.

#### Scenario: Successful Google login
- **WHEN** a user clicks "Sign in with Google" and completes Google consent
- **THEN** the browser receives `#code=xxx&state=yyy` in the URL hash
- **THEN** `auth.js` exchanges the code for `access_token`, `refresh_token`, and user object
- **THEN** session is stored in `localStorage`
- **THEN** the URL hash is cleaned via `history.replaceState`

#### Scenario: Returning user login
- **WHEN** a user who previously signed up logs in again
- **THEN** they receive a new session with their existing user data

### Requirement: Password auth (signup + login)

The system SHALL support email/password signup via `/auth/v1/signup` and login via `/auth/v1/token?grant_type=password`.

#### Scenario: New user signs up with password
- **WHEN** a user submits email and password on the signup form
- **THEN** the system calls `/auth/v1/signup` and shows a success message
- **THEN** the user can then log in via the login form

#### Scenario: Existing user logs in with password
- **WHEN** a user submits valid email and password
- **THEN** the system receives `access_token`, `refresh_token`, and user object
- **THEN** session is stored in `localStorage`

### Requirement: Session persistence and token refresh

The system SHALL store the session (`access_token`, `refresh_token`, user object) in `localStorage`. On page load, `auth.js` SHALL check for an existing session. On 401 responses, `api.js` SHALL attempt token refresh via `/auth/v1/token?grant_type=refresh_token`.

#### Scenario: Page reload preserves session
- **WHEN** a logged-in user reloads the page
- **THEN** `auth.js` reads the session from `localStorage` and restores the authenticated state

#### Scenario: Expired token triggers refresh
- **WHEN** an API call returns 401
- **THEN** `api.js` attempts a token refresh using the stored `refresh_token`
- **THEN** if successful, the original request is retried with the new token
- **THEN** if refresh fails, the user is logged out and redirected to login

### Requirement: First-user-admin flow

The `on-signup` edge function SHALL check if the `members` table is empty. If empty, the new user is assigned `role: 'admin'`. Otherwise, the user is assigned `role: 'member'` with `status: 'pending'` (or 'active' depending on site config for open vs. approved signup).

#### Scenario: First user becomes admin
- **WHEN** the first user signs up and the `on-signup` function runs
- **THEN** a row is inserted into `members` with `role = 'admin'` and `status = 'active'`

#### Scenario: Subsequent users become members
- **WHEN** a user signs up and there are already members in the table
- **THEN** a row is inserted with `role = 'member'` and `status = 'pending'`

### Requirement: On-signup resilience

`config.js` SHALL check on every page load whether the current authenticated user exists in the `members` table. If not, it SHALL call the `on-signup` function. This handles the case where the user closed the tab before the initial `on-signup` call completed.

#### Scenario: Missed on-signup is recovered
- **WHEN** an authenticated user loads any page and has no row in `members`
- **THEN** `config.js` calls the `on-signup` function to create their member record

### Requirement: Role-based UI gating

`auth.js` SHALL expose a function to check the current user's role. Pages SHALL use this to show/hide admin controls. Admin-only pages (`admin.html`, `admin-members.html`, etc.) SHALL redirect non-admin users.

#### Scenario: Admin sees admin controls
- **WHEN** an admin loads any page
- **THEN** admin-specific UI elements (edit buttons, admin nav items) are visible

#### Scenario: Member cannot access admin pages
- **WHEN** a non-admin user navigates to `admin.html`
- **THEN** they are redirected to the home page
