## ADDED Requirements

### Requirement: BlockType interface includes editorType and translatableFields

The `BlockType` interface exported from `src/lib/blocks.ts` SHALL include two new optional fields:
- `editorType: 'inline' | 'list' | 'custom'` — determines which editing UI is mounted for a block's edit affordance.
- `translatableFields?: string[]` — dot-path strings identifying the text fields eligible for per-locale translation.

Every entry in the `BLOCK_TYPES` registry SHALL declare `editorType`. `translatableFields` defaults to `[]` when omitted.

#### Scenario: BlockType interface compiles with new fields
- **WHEN** a new block type is added to the registry with `editorType: 'inline'` and no `translatableFields`
- **THEN** TypeScript compilation succeeds without type errors

#### Scenario: Registry entry without translatableFields defaults to empty
- **WHEN** `BLOCK_TYPES.shape_divider.translatableFields` is read
- **THEN** the value is `undefined` or `[]` (treated as not translatable by the editor)

### Requirement: Five new verified embed providers are registered

`src/lib/blocks/embed-providers.ts` SHALL add the following five providers with `trustLevel: 'verified'`:

- `spotify`: label "Spotify player", `buildSrc` constructs `https://open.spotify.com/embed/…` from a `uri` param, `sandbox: ['allow-scripts', 'allow-same-origin']`, `frameAncestor: 'https://open.spotify.com'`, `defaultHeight: '152px'`, `responsive: false`.
- `soundcloud`: label "SoundCloud player", `buildSrc` constructs `https://w.soundcloud.com/player/?url=…` from a `url` param, `sandbox: ['allow-scripts', 'allow-same-origin', 'allow-popups']`, `frameAncestor: 'https://w.soundcloud.com'`, `defaultHeight: '166px'`, `responsive: false`.
- `eventbrite`: label "Eventbrite event", `buildSrc` constructs `https://www.eventbrite.com/tickets-external?eid=…` from an `event_id` param, `sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups']`, `frameAncestor: 'https://www.eventbrite.com'`, `defaultHeight: '500px'`, `responsive: false`.
- `google_forms`: label "Google Form", `buildSrc` validates and returns the provided `form_url` (must match `https://docs.google.com/forms/…/viewform`), `sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups']`, `frameAncestor: 'https://docs.google.com'`, `defaultHeight: '600px'`, `responsive: false`.
- `typeform`: label "Typeform", `buildSrc` constructs `https://form.typeform.com/to/{form_id}` from a `form_id` param, `sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups']`, `frameAncestor: 'https://embed.typeform.com'`, `defaultHeight: '500px'`, `responsive: false`.

#### Scenario: Provider count increases from 7 to 12
- **WHEN** `Object.keys(PROVIDERS).length` is evaluated
- **THEN** the result is 12

#### Scenario: Spotify buildSrc constructs a valid embed URL
- **WHEN** `PROVIDERS.spotify.buildSrc({ uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC' })` is called
- **THEN** the returned string is a valid `https://open.spotify.com/embed/…` URL

#### Scenario: Google Forms buildSrc rejects non-Forms URLs
- **WHEN** `PROVIDERS.google_forms.buildSrc({ form_url: 'https://www.google.com' })` is called
- **THEN** it throws with a descriptive error message

#### Scenario: CSP frame-src includes all new provider hosts
- **WHEN** `getProviderHosts()` is called after adding the five new providers
- **THEN** the returned array includes `https://open.spotify.com`, `https://w.soundcloud.com`, `https://www.eventbrite.com`, `https://docs.google.com`, `https://embed.typeform.com`

### Requirement: All iframe renders include referrerpolicy

The iframe renderer in `src/lib/blocks/embed.ts` SHALL add `referrerpolicy="strict-origin-when-cross-origin"` to every `<iframe>` element it produces, for all providers including the generic `iframe` provider. This applies to both the verified-provider path and the trust-acknowledged generic path.

#### Scenario: Rendered iframe has referrerpolicy attribute
- **WHEN** the embed block renders any provider
- **THEN** the resulting HTML contains `referrerpolicy="strict-origin-when-cross-origin"` on the iframe element
