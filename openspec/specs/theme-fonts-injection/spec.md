## Purpose

Non-system fonts named in a project's theme load at first paint via build-time Google Fonts injection, with metric-matched fallback faces so font loading causes no text reflow.

## Requirements

### Requirement: Build-time Google Fonts injection

The system SHALL inject Google Fonts markup into every page's HTML head at build time when the active project's theme names a non-system font in `font_heading` or `font_body`. The injection SHALL be deterministic — same theme produces the same tags. The injector SHALL skip system fonts (per a fixed allowlist) so projects using OS-default typography produce no font-loading network requests.

The injection SHALL include:

1. A `<link rel="preconnect" href="https://fonts.googleapis.com">` tag.
2. A `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` tag.
3. A stylesheet URL of the form `https://fonts.googleapis.com/css2?family={…}&display=optional` containing all named non-system fonts in the theme. `Portal.astro` bakes this onto a stable `<link id="wl-font-stylesheet">` so the runtime can repoint it on a live font edit.

The Google Fonts URL SHALL use `display=optional` so the fallback font is kept for the whole paint when the web font misses the browser's block window — no mid-render swap, no text-width reflow.

#### Scenario: Theme with named heading font emits Google Fonts link
- **WHEN** `site_config.theme = { font_heading: "Playfair Display", font_body: "system-ui" }` and the build runs
- **THEN** `Portal.astro`'s rendered head contains `<link rel="preconnect" href="https://fonts.googleapis.com">`
- **THEN** the head contains a stylesheet link with href `https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=optional`
- **THEN** no font is requested for `font_body` (it's a system font)

#### Scenario: Theme with both fonts named emits combined URL
- **WHEN** `theme = { font_heading: "Cormorant Garamond", font_body: "Inter" }`
- **THEN** the rendered Google Fonts URL is `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&family=Inter:wght@400;600&display=optional`

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

### Requirement: Metric-matched fallback faces prevent reflow

When the theme names a non-system font for which a fallback recipe is registered, the injector SHALL emit inline `@font-face` declarations that map a locally-available family to the design font's metrics via `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override`, so the fallback occupies the same metric box as the design font. Fonts with no registered recipe SHALL emit no fallback face.

#### Scenario: Registered font emits a size-adjusted fallback face
- **WHEN** the theme names a font with a registered fallback recipe
- **THEN** the head contains an inline `<style>` declaring an `@font-face` with `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` for that family

#### Scenario: Unknown font emits no fallback face
- **WHEN** the theme names a non-system font with no registered fallback recipe
- **THEN** no `@font-face` fallback is emitted and the browser uses the generic-family declaration

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
