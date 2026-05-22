## ADDED Requirements

### Requirement: Admin bar renders above every page for admins only

`Portal.astro` SHALL render an `<AdminBar />` Astro component unconditionally before the main flex column (the same slot occupied by `<DemoBanner />`). The `AdminBarIsland.tsx` React island loaded inside it SHALL call `getRole()` on mount and render `null` when the role is not `'admin'`, making the bar invisible to members and visitors without a server round-trip.

#### Scenario: Admin sees the bar on every page
- **WHEN** an admin loads any portal page (home, custom page, events, directory, etc.)
- **THEN** the admin bar is visible at the top of the viewport above the site navigation

#### Scenario: Member sees no admin bar
- **WHEN** a logged-in member (non-admin) loads any portal page
- **THEN** no admin bar is visible and the page layout is identical to the visitor view

#### Scenario: Visitor sees no admin bar
- **WHEN** an unauthenticated visitor loads any portal page
- **THEN** no admin bar is visible

### Requirement: Admin bar is sticky and layered above all other chrome

The admin bar container SHALL have Tailwind classes `sticky top-0 z-[9999] h-9` so it remains fixed at the viewport top during scroll and sits above all modals, dropdowns, and toast notifications (which use lower z-indices).

#### Scenario: Bar remains at top during scroll
- **WHEN** an admin scrolls down a long page
- **THEN** the admin bar stays pinned at the top of the viewport

#### Scenario: Bar sits above site navigation
- **WHEN** the site navigation is also sticky
- **THEN** the admin bar occupies the top position and the site nav sits below it

### Requirement: Pages dropdown lists all pages with current-page highlight

The admin bar SHALL include a `DropdownMenu` labelled "Pages" that, on open, fetches all rows from the `pages` table and renders each as a `DropdownMenuItem`. The item whose slug matches the current page slug SHALL be visually distinguished (bold or primary colour). A `DropdownMenuSeparator` SHALL precede a final item "+ New Page" that opens the page creator Dialog.

#### Scenario: All pages appear in the dropdown
- **WHEN** an admin opens the Pages dropdown
- **THEN** every page in the `pages` table appears as a menu item with its title

#### Scenario: Current page is highlighted
- **WHEN** the admin is viewing a page whose slug matches a pages row
- **THEN** that item in the dropdown is visually distinguished from the others

#### Scenario: Navigating to a page from the dropdown
- **WHEN** an admin clicks a page item in the dropdown
- **THEN** the browser navigates to that page's URL

#### Scenario: "+ New Page" opens the creator
- **WHEN** an admin clicks "+ New Page" in the Pages dropdown
- **THEN** the page creator Dialog opens

### Requirement: Add Block button opens the block picker in the current page's main zone

The admin bar SHALL include a `Button` labelled "+ Add Block". Clicking it SHALL dispatch the same event or call the same function that the `AdminZoneAddButton` component uses to open the block picker for `zone='main'` on the current page.

#### Scenario: Add Block button triggers block picker
- **WHEN** an admin clicks "+ Add Block" in the admin bar
- **THEN** the block picker opens for the main zone of the current page

### Requirement: Language switcher is hidden when the portal has only one enabled language

The language switcher `DropdownMenu` SHALL only render when `site_config.languages_enabled` (the runtime-mutable JSONB array — see design.md Decision 9 for why this is distinct from `spec.i18n.locales`) contains more than one entry. When only one language is enabled the switcher SHALL be absent from the admin bar DOM entirely.

The switcher SHALL list languages from `site_config.languages_enabled`, NOT from the gateway's `spec.i18n.locales` pool (which is the kitchen-sink 50-entry pre-allocation, irrelevant to UI).

#### Scenario: Single-enabled-language portal hides the switcher
- **WHEN** the portal's `site_config.languages_enabled` has exactly one entry (e.g. `["en"]`)
- **THEN** no language switcher appears in the admin bar
- **AND** the fact that the gateway accepts 50 locales is invisible to the admin

#### Scenario: Multi-enabled-language portal shows the switcher
- **WHEN** the portal's `site_config.languages_enabled` has two or more entries
- **THEN** a language switcher DropdownMenu labelled with the current locale appears in the admin bar
- **AND** the dropdown lists only the languages in `languages_enabled` (not the 50-entry pool)

### Requirement: Language switcher activates translation mode for the selected locale

Selecting a non-default language from the switcher SHALL activate translation mode. In translation mode the admin bar SHALL display a `Badge` reading "Translating: {lang}" and the block edit affordances SHALL open the `BlockTranslationEditor` for that locale instead of the normal block editor. Selecting the default language (English) SHALL deactivate translation mode and restore normal editing behaviour.

#### Scenario: Selecting a non-English locale activates translation mode
- **WHEN** an admin selects "Español" from the language switcher
- **THEN** the admin bar shows a badge "Translating: ES"
- **AND** clicking a block's edit affordance opens the BlockTranslationEditor for that locale

#### Scenario: Returning to English deactivates translation mode
- **WHEN** an admin in translation mode selects "English" from the language switcher
- **THEN** the translation badge disappears
- **AND** block edit affordances return to the normal block editor

#### Scenario: "+ Add language..." opens the Add Language dialog
- **WHEN** an admin clicks "+ Add language..." in the language switcher dropdown
- **THEN** the Add Language Dialog opens

### Requirement: Preview toggle hides admin chrome temporarily

The admin bar SHALL include a `Button` labelled "Preview". Clicking it SHALL hide all admin editing affordances (edit buttons, drag handles, zone add buttons, the admin bar itself) so the admin can see the page as a member would. Clicking "Exit preview" (or navigating) SHALL restore the admin chrome.

#### Scenario: Preview hides admin chrome
- **WHEN** an admin clicks "Preview"
- **THEN** all admin editing affordances (hover highlights, add-block buttons, admin bar) are hidden

#### Scenario: Exiting preview restores admin chrome
- **WHEN** an admin is in preview mode and clicks "Exit preview" (which appears in place of the bar)
- **THEN** all admin chrome reappears

### Requirement: Exit button hides the admin bar until next login

The admin bar SHALL include a `Button` with an "✕" icon at the far right. Clicking it SHALL write a flag to `localStorage` (e.g. `wl_admin_bar_hidden = '1'`) and hide the bar for the remainder of the session. On next login (or on clearing localStorage) the bar SHALL reappear.

#### Scenario: Exit hides the bar for the session
- **WHEN** an admin clicks the ✕ button
- **THEN** the admin bar disappears for the current session

#### Scenario: Bar reappears on next login
- **WHEN** the admin logs out and back in
- **THEN** the admin bar is visible again (localStorage flag is cleared on logout)
