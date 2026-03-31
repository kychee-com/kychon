## ADDED Requirements

### Requirement: Dark mode toggle in navigation

The navigation bar SHALL include a dark mode toggle button (sun/moon icon). Clicking the toggle SHALL switch between light and dark themes.

#### Scenario: User enables dark mode
- **WHEN** the user clicks the dark mode toggle while in light mode
- **THEN** the page switches to the dark color palette
- **THEN** the toggle icon changes to a sun icon

#### Scenario: User disables dark mode
- **WHEN** the user clicks the dark mode toggle while in dark mode
- **THEN** the page switches to the light color palette
- **THEN** the toggle icon changes to a moon icon

### Requirement: Dark mode color palette

When dark mode is active (`[data-theme="dark"]` on `<html>`), all `--color-*` CSS custom properties SHALL be overridden with a dark palette. The dark palette SHALL use dark backgrounds, light text, and adjusted accent colors that maintain readability and contrast.

#### Scenario: Dark palette applied
- **WHEN** `data-theme="dark"` is set on `<html>`
- **THEN** `--color-bg` is a dark color (e.g., `#0f172a`)
- **THEN** `--color-text` is a light color (e.g., `#e2e8f0`)
- **THEN** `--color-surface` is a slightly lighter dark (e.g., `#1e293b`)
- **THEN** all components using CSS custom properties automatically adapt

#### Scenario: Light palette is default
- **WHEN** no `data-theme` attribute is present
- **THEN** the existing light palette from `theme.css` `:root` is used

### Requirement: Dark mode preference persistence

The dark mode preference SHALL be stored in `localStorage` under key `wl_theme`. On page load, the system SHALL check: (1) `localStorage` value, then (2) `prefers-color-scheme` system media query, then (3) default to light.

#### Scenario: Preference saved to localStorage
- **WHEN** the user toggles dark mode
- **THEN** the preference (`dark` or `light`) is saved to `localStorage` key `wl_theme`

#### Scenario: Preference restored on reload
- **WHEN** the page loads and `localStorage` has `wl_theme = 'dark'`
- **THEN** dark mode is applied immediately (no flash of light mode)

#### Scenario: System preference respected
- **WHEN** the page loads with no `localStorage` preference and the system has `prefers-color-scheme: dark`
- **THEN** dark mode is applied automatically

### Requirement: Dark mode glassmorphic nav adaptation

The glassmorphic nav background SHALL adapt to dark mode, using a semi-transparent dark background (`rgba(15,23,42,0.8)`) instead of the light semi-transparent white.

#### Scenario: Nav in dark mode
- **WHEN** dark mode is active
- **THEN** the nav background uses a semi-transparent dark color with backdrop blur
