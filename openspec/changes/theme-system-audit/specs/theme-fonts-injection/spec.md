## ADDED Requirements

### Requirement: Build-time Google Fonts injection

The system SHALL inject Google Fonts `<link>` tags into every page's HTML head at build time when the active project's theme names a non-system font in `font_heading` or `font_body`. The injection SHALL be deterministic — same theme produces the same `<link>` tags. The injector SHALL skip system fonts (per a fixed allowlist) so projects using OS-default typography produce no font-loading network requests.

The injection SHALL include:

1. A `<link rel="preconnect" href="https://fonts.googleapis.com">` tag.
2. A `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` tag.
3. A `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={…}&display=swap">` tag where the URL contains all named non-system fonts in the theme.

The Google Fonts URL SHALL include `display=swap` to ensure fallback fonts render during font load (no flash of invisible text).

#### Scenario: Theme with named heading font emits Google Fonts link
- **WHEN** `site_config.theme = { font_heading: "Playfair Display", font_body: "system-ui" }` and the build runs
- **THEN** `Portal.astro`'s rendered head contains `<link rel="preconnect" href="https://fonts.googleapis.com">`
- **THEN** the head contains `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap">`
- **THEN** no font is requested for `font_body` (it's a system font)

#### Scenario: Theme with both fonts named emits combined URL
- **WHEN** `theme = { font_heading: "Cormorant Garamond", font_body: "Inter" }`
- **THEN** the rendered Google Fonts URL is `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&family=Inter:wght@400;600&display=swap`

#### Scenario: Same font for heading and body deduplicates
- **WHEN** `theme = { font_heading: "Inter", font_body: "Inter" }`
- **THEN** the rendered Google Fonts URL contains `family=Inter` exactly once

#### Scenario: All-system-fonts theme emits no font links
- **WHEN** `theme = { font_heading: "system-ui", font_body: "system-ui" }`
- **THEN** the rendered head contains NO `<link>` to `fonts.googleapis.com`
- **THEN** the rendered head contains no preconnect to font hosts

#### Scenario: Missing theme fonts fall back to system stack
- **WHEN** `theme.font_heading` and `theme.font_body` are both unset
- **THEN** no Google Fonts links are emitted
- **THEN** rendered text uses the CSS fallback stack (`system-ui, sans-serif` or similar)

#### Scenario: Font name with spaces URL-encodes correctly
- **WHEN** `theme.font_heading = "Playfair Display"`
- **THEN** the rendered URL contains `family=Playfair+Display:wght@400;700` (spaces become `+`, properly encoded)

### Requirement: System-font allowlist excludes common stack names

The font injector SHALL recognize a fixed allowlist of system font names and skip injection for any name in this list (case-insensitive, after stripping surrounding quotes). The allowlist SHALL include at minimum: `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica`, `Helvetica Neue`, `Arial`, `sans-serif`, `serif`, `monospace`.

#### Scenario: Quoted system font is recognized
- **WHEN** `theme.font_body = '"system-ui"'` (quoted)
- **THEN** the injector treats it as a system font and skips it

#### Scenario: Non-system named font is loaded
- **WHEN** `theme.font_heading = "Bitter"` (not in allowlist)
- **THEN** the injector includes Bitter in the Google Fonts URL

### Requirement: CSP permits Google Fonts loading

The deployed CSP SHALL include `https://fonts.googleapis.com` in `style-src` (for the linked stylesheet) and `https://fonts.gstatic.com` in `font-src` (for the actual font files). The deploy-time validator SHALL fail if either is missing when any seed module names a non-system font.

#### Scenario: CSP allows Google Fonts requests
- **WHEN** a deployed Kychon project loads any HTML page that injects Google Fonts
- **THEN** the browser does not report a CSP violation for the stylesheet request to `fonts.googleapis.com`
- **THEN** the browser does not report a CSP violation for the font requests to `fonts.gstatic.com`

#### Scenario: Deploy aborts on missing font CSP entries
- **WHEN** any seed names a non-system font and the generated CSP omits `style-src https://fonts.googleapis.com`
- **THEN** the deploy script exits non-zero with a message identifying the missing directive
