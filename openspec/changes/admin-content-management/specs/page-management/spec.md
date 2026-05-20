## ADDED Requirements

### Requirement: Admin can create a new page from the admin bar

Clicking "+ New Page" in the admin bar Pages dropdown SHALL open a `Dialog` (shadcn) containing a form with: a Title `Input`, a slug `Input` (auto-generated from the title by lowercasing and replacing non-alphanumeric runs with hyphens, but editable), an "Add to navigation" `Checkbox`, and a "Members only" `Checkbox`. The Create button SHALL be disabled until the slug is non-empty and passes uniqueness validation. On submit the Dialog SHALL call `pages.create` via `kychon-api.js`.

#### Scenario: Slug is auto-generated from title
- **WHEN** an admin types "About Our Club" in the Title field
- **THEN** the slug field auto-populates with "about-our-club"

#### Scenario: Slug collision appends a suffix
- **WHEN** the admin submits with a slug that already exists in the `pages` table
- **THEN** the server returns a slug-conflict error
- **AND** the Dialog shows "This slug is already taken. Try: about-our-club-2"

#### Scenario: Page is created and admin is navigated to it
- **WHEN** the admin clicks "Create Page →" with a valid slug
- **THEN** a row is inserted into `pages`
- **AND** the browser navigates to `/{slug}`
- **AND** the main zone is empty (no page-scoped sections)

#### Scenario: Members-only page redirects unauthenticated visitors
- **WHEN** a page is created with `requires_auth = true`
- **THEN** unauthenticated visitors to that page are redirected to the login flow

### Requirement: Page creation auto-inserts a nav item when "Add to navigation" is checked

When `show_in_nav` is `true` on `pages.create`, the `kychon-api.js` custom handler SHALL locate the first `sections` row with `section_type = 'nav'`, `scope = 'global'`, `zone = 'header'` and append `{ label: page.title, href: '/' + page.slug, public: true }` to its `config.items` array via a PATCH. If no such nav block exists the page SHALL still be created and the response SHALL include `nav_not_found: true`; the client SHALL show a toast "Page created — add it to your navigation manually."

#### Scenario: Nav item is inserted when "Add to navigation" is checked
- **WHEN** an admin creates a page with "Add to navigation" checked
- **THEN** the global nav block's `config.items` gains a new entry `{ label, href, public: true }`
- **AND** the site navigation renders the new link on next page load

#### Scenario: No nav block produces a toast warning
- **WHEN** an admin creates a page with "Add to navigation" checked but no global nav block exists
- **THEN** the page is created successfully
- **AND** the client shows a toast "Page created — add it to your navigation manually."

#### Scenario: "Add to navigation" unchecked skips nav side-effect
- **WHEN** an admin creates a page with "Add to navigation" unchecked
- **THEN** no nav block config is modified

### Requirement: Admin can delete a page from the admin bar

The Pages dropdown SHALL include a delete affordance (e.g. a `Button variant="ghost"` with a trash icon) next to each non-system page. Clicking it SHALL open a `Dialog` with a destructive confirmation: "This will permanently delete the page and all its blocks." If the page has `show_in_nav = true`, the description SHALL additionally read "It will also be removed from the navigation." The dialog SHALL have a "Cancel" `Button variant="outline"` and a "Delete page" `Button variant="destructive"`. Confirming SHALL call `pages.delete`.

#### Scenario: Confirmation dialog appears before delete
- **WHEN** an admin clicks the delete affordance for a page
- **THEN** a Dialog opens with a destructive confirmation message
- **AND** the delete is not executed until the admin confirms

#### Scenario: Deleting cascades all page-scoped sections
- **WHEN** an admin confirms deletion of a page
- **THEN** all `sections` rows with `page_slug = slug` AND `scope = 'page'` are deleted
- **AND** the `pages` row is deleted

#### Scenario: Delete removes the nav item
- **WHEN** an admin confirms deletion of a page that was in the navigation
- **THEN** the matching item (by `href`) is removed from the global nav block's `config.items`

#### Scenario: Delete of a page not in nav skips nav side-effect
- **WHEN** an admin confirms deletion of a page with `show_in_nav = false`
- **THEN** no nav block config is modified

### Requirement: Newly created pages render as a blank main zone for admins

After navigating to a newly created page, the main zone (`#sections`) SHALL be empty. For admins the zone SHALL display the `AdminZoneAddButton` prompt so they can immediately add blocks. For non-admins the page SHALL render with only the global header and footer chrome.

#### Scenario: Admin sees add-block prompt on a new blank page
- **WHEN** an admin navigates to a newly created page with no page-scoped sections
- **THEN** the main zone shows the AdminZoneAddButton "+ Add Block" prompt

#### Scenario: Non-admin sees an empty page body
- **WHEN** a member navigates to a newly created page with no sections
- **THEN** the page renders with the global header and footer but no main content
