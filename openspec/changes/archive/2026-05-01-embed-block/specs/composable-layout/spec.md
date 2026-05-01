## ADDED Requirements

### Requirement: `embed` block-type with provider routing

The `BLOCK_TYPES` registry SHALL include an `embed` entry that renders a third-party iframe via a registered provider. The block SHALL be `dynamic: false` (renderer emits the iframe markup directly; no API fetch). Configuration SHALL include `heading` (optional), `provider` (one of the registered provider ids), `params` (provider-specific parameter object validated against the provider's `paramsSchema`), `height` (used for non-responsive providers), `responsive` (boolean), and — for the `iframe` provider only — `trust_acknowledged` (boolean, defaulting `false` until the admin opts in).

The renderer SHALL dispatch to the provider's `buildSrc(params)` to construct the iframe URL. The renderer SHALL emit `<iframe>` with the provider's declared `sandbox` attribute, `loading="lazy"`, and a `title` attribute derived from `heading` or the provider label. The renderer SHALL refuse to emit the iframe and SHALL emit a visible error placeholder if (a) the provider is not in the registry, (b) `buildSrc` throws, or (c) the provider is `iframe` and `trust_acknowledged !== true`.

#### Scenario: YouTube embed renders with provider URL
- **WHEN** an embed block has `provider = 'youtube', params = { video_id: 'abcd1234' }`
- **THEN** the rendered HTML contains `<iframe src="https://www.youtube.com/embed/abcd1234" sandbox="allow-scripts allow-same-origin allow-presentation" loading="lazy" ...>`

#### Scenario: Weather embed renders with location param
- **WHEN** an embed block has `provider = 'weather', params = { location: 'Alexandria, VA', units: 'imperial', days: 5 }`
- **THEN** the rendered iframe `src` is built by the weather provider's `buildSrc` from those params

#### Scenario: Iframe provider without trust acknowledgment renders error
- **WHEN** an embed block has `provider = 'iframe', params = { src: 'https://example.com' }, trust_acknowledged = false`
- **THEN** the rendered HTML is an error placeholder (`<section class="block-embed block-embed--error">`)
- **THEN** no `<iframe>` element is emitted

#### Scenario: Unknown provider renders error
- **WHEN** an embed block has `provider = 'unregistered'`
- **THEN** the renderer emits the error placeholder identifying the unknown provider

#### Scenario: Responsive video providers use aspect-ratio
- **WHEN** an embed block has `provider = 'youtube'` and `responsive: true`
- **THEN** the rendered section uses CSS `aspect-ratio: 16 / 9` so the iframe scales fluidly with viewport width

#### Scenario: Fixed-height non-responsive providers use config.height
- **WHEN** an embed block has `provider = 'calendly'` and `height: '700px'`
- **THEN** the rendered iframe has style `height: 700px`

### Requirement: Embed block edit popover routes by provider

The embed block's edit popover in `AdminEditor` SHALL render a provider selector at the top. Selecting a provider SHALL render a params form generated from the provider's `paramsSchema`. The form SHALL render appropriate input types (`text`, `number`, `select`) per schema entry, with required-field markers and inline help text.

For YouTube and Vimeo providers, the popover SHALL include a helper button that extracts the video ID from a pasted URL. For the `iframe` provider, the popover SHALL render the trust-acknowledgment gate and SHALL disable the Save button until the admin checks the "I trust {hostname}" checkbox.

#### Scenario: Provider selector drives the params form
- **WHEN** an admin opens the embed block popover and selects `vimeo`
- **THEN** the params form shows a single `video_id` text input (per the vimeo provider's paramsSchema)

#### Scenario: YouTube URL helper extracts video ID
- **WHEN** an admin clicks the "Paste URL" helper and pastes `https://www.youtube.com/watch?v=abcd1234`
- **THEN** the `video_id` field is auto-filled with `abcd1234`

#### Scenario: Trust gate hostname matches src
- **WHEN** an admin selects the iframe provider and types `https://example.com/widget`
- **THEN** the trust checkbox label reads "I trust example.com"
- **WHEN** the admin changes the URL to `https://other.com/widget`
- **THEN** the checkbox label updates to "I trust other.com"
- **THEN** any prior check is cleared (the admin must re-acknowledge for the new host)

## MODIFIED Requirements

### Requirement: Block-type registry includes chrome and footer types

The `BLOCK_TYPES` registry in `src/lib/blocks.ts` SHALL include, at minimum, the following block types:

**Main-zone:** `hero`, `features`, `cta`, `stats`, `testimonials`, `faq`, `polls` (dynamic), `event_countdown`, `activity_feed` (dynamic), `announcements_feed` (dynamic), `embed`.

**Header-zone:** `nav`, `brand_header`, `sign_in_bar`.

**Footer-zone:** `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`.

Each entry SHALL define `defaultConfig` providing a working starting point when an admin adds a new block of that type via the picker.

#### Scenario: Embed block defaultConfig represents a safe starting state
- **WHEN** an admin adds a new embed block via the picker
- **THEN** the new section's `config` is `{ provider: 'youtube', params: {}, height: '320px', responsive: true }` or similar — a known-safe verified provider with empty params, NOT the generic iframe with trust pre-acknowledged

#### Scenario: Admin adds a footer address block
- **WHEN** an admin opens the block picker in the footer zone
- **THEN** `footer_address` appears as an option

#### Scenario: Footer attribution block defaults to Powered-by-Kychon
- **WHEN** the kychon template seed is generated
- **THEN** the seed includes a `footer_attribution` block with `config.text = "Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)"`

#### Scenario: Footer copyright supports auto year
- **WHEN** a `footer_copyright` block has `config.year = 'auto'`
- **THEN** the rendered HTML contains a `<span data-year="auto">` element
- **THEN** an inline script sets the span's text to the current year on page load
