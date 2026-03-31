## ADDED Requirements

### Requirement: Skip navigation link
Every Wild Lychee page SHALL include a visually hidden link as the first focusable element that reads "Skip to main content" and targets `#main-content`. The link SHALL become visible when focused.

#### Scenario: Skip-nav visible on focus
- **WHEN** a user presses Tab on any page and the skip-nav link receives focus
- **THEN** the link becomes visible at the top of the viewport with sufficient contrast

#### Scenario: Skip-nav jumps to main content
- **WHEN** a user activates the skip-nav link
- **THEN** keyboard focus moves to the element with `id="main-content"` and the page scrolls to it

### Requirement: ARIA landmarks on all pages
Every page SHALL have ARIA landmark roles: `banner` (header), `navigation` (nav), `main` (content area), and `contentinfo` (footer). Each landmark SHALL have a descriptive `aria-label` when multiple landmarks of the same role exist.

#### Scenario: Screen reader identifies page regions
- **WHEN** a screen reader user navigates by landmarks
- **THEN** they can jump between header, navigation, main content, and footer regions

#### Scenario: Multiple nav elements are distinguishable
- **WHEN** a page has both a primary nav and a footer nav
- **THEN** each `<nav>` element has a unique `aria-label` (e.g., "Primary navigation", "Footer navigation")

### Requirement: Font size scaling
The system SHALL provide a 3-step font size control (100%, 125%, 150%) accessible from the accessibility toolbar in the nav bar. The selected size SHALL be persisted in `localStorage` and applied before first paint on subsequent page loads.

#### Scenario: User increases font size
- **WHEN** a user selects 125% or 150% from the font size control
- **THEN** all text on the page scales proportionally using the `--wl-font-scale` CSS custom property
- **AND** the preference is saved to `localStorage('wl_font_scale')`

#### Scenario: Font size persists across pages
- **WHEN** a user has previously set font size to 150% and navigates to a new page
- **THEN** the page renders at 150% scale immediately without a flash of default-sized text

#### Scenario: Font size resets
- **WHEN** a user selects 100% from the font size control
- **THEN** all text returns to the base size and `localStorage` is updated

### Requirement: High-contrast mode
The system SHALL provide a high-contrast toggle in the accessibility toolbar that swaps CSS custom properties to WCAG AAA contrast ratios (7:1 minimum for normal text). The toggle SHALL be persisted in `localStorage`.

#### Scenario: Activating high contrast
- **WHEN** a user enables high-contrast mode
- **THEN** the `<html>` element receives a `wl-high-contrast` class
- **AND** text-to-background contrast ratios meet WCAG AAA (7:1) for all body text
- **AND** the preference is saved to `localStorage('wl_high_contrast')`

#### Scenario: High contrast persists
- **WHEN** a user with high-contrast enabled loads any page
- **THEN** high-contrast styles are applied before first paint

### Requirement: Reduced motion support
The system SHALL respect the `prefers-reduced-motion: reduce` media query by disabling all CSS transitions, animations, and smooth scrolling. A manual toggle in the accessibility toolbar SHALL override the OS setting in either direction.

#### Scenario: OS prefers reduced motion
- **WHEN** the user's OS is set to reduce motion and no manual override exists
- **THEN** all CSS transitions have `duration: 0s`, all CSS animations are `animation: none`, and `scroll-behavior` is `auto`

#### Scenario: Manual reduced motion toggle
- **WHEN** a user enables reduced motion via the accessibility toolbar regardless of OS setting
- **THEN** all motion is disabled and the preference is saved to `localStorage('wl_reduced_motion')`

#### Scenario: User overrides OS to allow motion
- **WHEN** a user's OS prefers reduced motion but they explicitly disable the toggle
- **THEN** animations and transitions are restored

### Requirement: Focus management
All interactive elements SHALL have a visible focus indicator. Modal dialogs SHALL trap focus within them. Closing a modal SHALL return focus to the element that opened it.

#### Scenario: Visible focus ring
- **WHEN** any interactive element (link, button, input, select) receives keyboard focus
- **THEN** a visible focus ring is displayed with at least 3:1 contrast against the background

#### Scenario: Modal focus trap
- **WHEN** a modal dialog is open and the user presses Tab
- **THEN** focus cycles within the modal and does not escape to background content

#### Scenario: Focus restoration on modal close
- **WHEN** a user closes a modal dialog (via button, Escape key, or overlay click)
- **THEN** focus returns to the element that triggered the modal

### Requirement: Keyboard navigation
All interactive elements SHALL be reachable via Tab. Dropdown menus SHALL be navigable with arrow keys. Escape SHALL close any open overlay, dropdown, or modal.

#### Scenario: Tab order covers all controls
- **WHEN** a user tabs through a page
- **THEN** every interactive element (links, buttons, inputs, dropdowns, toolbar controls) receives focus in a logical reading order

#### Scenario: Arrow key navigation in dropdowns
- **WHEN** a dropdown menu is open and the user presses the down arrow key
- **THEN** focus moves to the next menu item
- **AND** pressing up arrow moves to the previous item

#### Scenario: Escape closes overlays
- **WHEN** a dropdown, modal, or overlay is open and the user presses Escape
- **THEN** the overlay closes and focus returns to the trigger element

### Requirement: Screen reader announcements for dynamic content
Dynamic content changes (toast notifications, form submission results, page transitions, activity feed updates) SHALL be announced to screen readers via `aria-live` regions.

#### Scenario: Toast notification announced
- **WHEN** a toast notification appears
- **THEN** its text content is announced by screen readers via an `aria-live="polite"` region

#### Scenario: Form submission result announced
- **WHEN** a form is submitted and a success or error message appears
- **THEN** the message is announced to screen readers

### Requirement: Accessibility toolbar
The accessibility toolbar SHALL be a dropdown menu in the nav bar, triggered by a universal access icon button. The toolbar SHALL contain controls for font size, high contrast, and reduced motion. The toolbar itself SHALL be fully keyboard-navigable.

#### Scenario: Opening the toolbar
- **WHEN** a user clicks or activates (Enter/Space) the accessibility icon button
- **THEN** the dropdown opens and focus moves to the first control

#### Scenario: Toolbar keyboard navigation
- **WHEN** the toolbar is open and the user presses arrow keys
- **THEN** focus moves between toolbar controls

#### Scenario: Toolbar closes on Escape
- **WHEN** the toolbar dropdown is open and the user presses Escape
- **THEN** the dropdown closes and focus returns to the trigger button
