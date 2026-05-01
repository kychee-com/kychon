## ADDED Requirements

### Requirement: Branding via three explicit fields

The system SHALL represent project branding via four `site_config` keys: `brand_icon_url` (optional, square mark), `brand_wordmark_url` (optional, wide horizontal logo), `brand_text` (required string, the org's full name), and `brand_text_short` (optional one-line abbreviation). The `brand_header` chrome renderer SHALL apply the following picker rules in priority order to choose a render mode:

1. If `brand_icon_url` is set → render icon + `brand_text` (with `brand_text_short` swapped in via CSS at narrow viewports if set).
2. Else if `brand_wordmark_url` is set → render the wordmark image alone (no separate text label, since the wordmark itself contains the org's name).
3. Else → render `brand_text` as plain text only.

The single legacy `site_config.logo_url` field SHALL NOT be present in seeds, code, or rendered output. The seed-SQL generator SHALL fail with a clear error if any seed module references `site_config.logo_url`.

#### Scenario: Icon mode renders icon + text
- **WHEN** `site_config` has `brand_icon_url = 'https://…/wheel.svg'` and `brand_text = "Old Dominion Boat Club"`
- **THEN** the `brand_header` renders a single `<a href="/">` containing an `<img class="brand-icon">` and a `<span class="brand-text">` with the full org name

#### Scenario: Wordmark mode renders wordmark alone
- **WHEN** `site_config` has `brand_icon_url` unset, `brand_wordmark_url = 'https://…/wordmark.svg'`, and `brand_text = "Eagles Boat Club"`
- **THEN** the `brand_header` renders a single `<a href="/">` containing only an `<img class="brand-wordmark" alt="Eagles Boat Club">`
- **THEN** no separate text element is rendered

#### Scenario: Text mode is the universal fallback
- **WHEN** `site_config` has `brand_icon_url` and `brand_wordmark_url` both unset and `brand_text = "Barrio Unido"`
- **THEN** the `brand_header` renders `<a href="/" class="brand-header--text">Barrio Unido</a>` — text only

#### Scenario: brand_text_short swaps in at narrow viewports
- **WHEN** the brand is in icon mode, `brand_text = "Silver Pines Community"`, `brand_text_short = "Silver Pines"`
- **WHEN** the viewport is narrower than 480px (or the equivalent CSS breakpoint)
- **THEN** the rendered text reads "Silver Pines" via CSS-driven swap (no JS)

#### Scenario: brand_text is always required
- **WHEN** a seed module omits `brand_text`
- **THEN** the seed-SQL generator exits with an error identifying the missing required field

#### Scenario: Generator rejects legacy logo_url
- **WHEN** a seed module includes `site_config.logo_url`
- **THEN** the seed-SQL generator exits with an error identifying the seed and recommending the new fields

### Requirement: Favicon fallback chain

The system SHALL resolve the effective favicon URL via this priority chain at build time (in `Portal.astro`'s frontmatter):

1. `site_config.favicon_url` if set.
2. `site_config.brand_icon_url` if set.
3. The engine default at `/favicon.svg`.

The resulting URL SHALL be emitted into a `<link rel="icon">` element in the HTML head. The renderer SHALL accept any URL form for the favicon, including `https://`, root-relative paths, and inline `data:image/svg+xml,…` URLs. When the URL is an SVG (file with `.svg` extension or `data:image/svg+xml` URL), the `<link>` SHALL include `type="image/svg+xml"`.

The CSP baseline SHALL permit `data:` URLs in `img-src` so inline-SVG favicons load correctly.

#### Scenario: Explicit favicon_url wins
- **WHEN** `site_config.favicon_url = 'https://…/favicon.svg'`
- **THEN** the rendered head contains `<link rel="icon" type="image/svg+xml" href="https://…/favicon.svg">`

#### Scenario: Brand icon used as favicon when favicon_url is unset
- **WHEN** `favicon_url` is unset and `brand_icon_url = 'https://…/wheel.svg'`
- **THEN** the rendered head contains `<link rel="icon" type="image/svg+xml" href="https://…/wheel.svg">`

#### Scenario: Engine default when nothing is set
- **WHEN** both `favicon_url` and `brand_icon_url` are unset
- **THEN** the rendered head contains `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`
- **THEN** `public/favicon.svg` exists with the kychon engine's default brand mark

#### Scenario: Inline data: URLs load
- **WHEN** `site_config.favicon_url = 'data:image/svg+xml,%3Csvg…%3C/svg%3E'`
- **THEN** the rendered head contains the `<link>` with the data URL preserved as-is
- **THEN** the browser loads the SVG without a network request
- **THEN** no CSP violation is reported (because `img-src` permits `data:`)

#### Scenario: Non-SVG favicon omits type
- **WHEN** `favicon_url = 'https://…/favicon.png'`
- **THEN** the rendered head contains `<link rel="icon" href="https://…/favicon.png">` (no `type` attribute, browser infers)

## REMOVED Requirements

### Requirement: site_config.logo_url is the brand image source

**Reason**: replaced by three explicit brand fields (`brand_icon_url`, `brand_wordmark_url`, `brand_text`) with picker rules in the brand_header renderer. With no installed base, no aliasing is required — `logo_url` is removed entirely from the seed model and renderers.

**Migration**: Each demo seed updates `logo_url` references to `brand_icon_url` (or `brand_wordmark_url` if the asset is wide). Existing in-flight changes that reference `logo_url` are updated.
