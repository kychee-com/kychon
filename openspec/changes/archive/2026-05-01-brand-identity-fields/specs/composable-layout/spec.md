## MODIFIED Requirements

### Requirement: Block-type registry includes chrome and footer types

The `BLOCK_TYPES` registry in `src/lib/blocks.ts` SHALL include, at minimum, the following block types:

**Main-zone:** `hero`, `features`, `cta`, `stats`, `testimonials`, `faq`, `polls` (dynamic), `event_countdown`, `activity_feed` (dynamic), `announcements_feed` (dynamic).

**Header-zone:** `nav`, `brand_header` (consuming `site_config.brand_icon_url`, `brand_wordmark_url`, `brand_text`, `brand_text_short` per the picker rules; never reading any `site_config.logo_url` field), `sign_in_bar`.

**Footer-zone:** `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`.

Each entry SHALL define `defaultConfig` providing a working starting point when an admin adds a new block of that type via the picker.

#### Scenario: brand_header renders the icon mode
- **WHEN** `site_config.brand_icon_url` is set and the page renders
- **THEN** the `brand_header` block in zone='header' renders a link wrapping an `<img class="brand-icon">` and a `<span class="brand-text">{brand_text}</span>`

#### Scenario: brand_header renders the wordmark mode
- **WHEN** `site_config.brand_icon_url` is unset, `brand_wordmark_url` is set
- **THEN** the `brand_header` renders a link wrapping a single `<img class="brand-wordmark" alt={brand_text}>` with no separate text element

#### Scenario: brand_header renders the text mode
- **WHEN** both `brand_icon_url` and `brand_wordmark_url` are unset
- **THEN** the `brand_header` renders a link with `brand_text` as plain text

#### Scenario: brand_header does not read legacy logo_url
- **WHEN** the `brand_header` renderer runs
- **THEN** it never accesses `site_config.logo_url` (which no longer exists)
