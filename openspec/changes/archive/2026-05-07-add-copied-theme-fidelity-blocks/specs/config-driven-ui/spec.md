## ADDED Requirements

### Requirement: Theme injection supports source interaction state tokens

`site_config.theme` SHALL support optional source interaction-state tokens in addition to the existing base theme tokens. The theme injector SHALL map supported interaction tokens onto CSS custom properties on `document.documentElement` or scoped style elements before copied-theme blocks render.

Supported interaction tokens SHALL include hover and focus state values for background, text, icon, border, shadow, transform, transition duration, and transition easing. The system SHALL provide reusable defaults for buttons, CTA links, cards, nav links, social icons, carousel controls, and hover-reveal panels. Blocks MAY override theme-level interaction tokens through their own structured config.

#### Scenario: Hover token is injected
- **WHEN** `site_config.theme` contains a button hover background token
- **THEN** the theme injector sets the corresponding CSS custom property
- **THEN** buttons or CTAs using that token render the configured hover background

#### Scenario: Focus token is injected
- **WHEN** `site_config.theme` contains a focus outline or focus color token
- **THEN** keyboard focus states use the configured token
- **THEN** the focus state remains visible

#### Scenario: Block override wins over theme default
- **WHEN** a copied-theme block config contains an interaction override for a specific hover color or transform
- **THEN** that block uses the override
- **THEN** other blocks continue to use the theme-level interaction token

#### Scenario: Missing interaction tokens fall back safely
- **WHEN** `site_config.theme` does not define copied-theme interaction tokens
- **THEN** existing Kychon hover/focus/transition styling remains in effect
- **THEN** no copied-theme block requires interaction tokens to render

### Requirement: Theme injection supports source header and nav presentation tokens

`site_config.theme` SHALL support optional header/nav presentation tokens for copied themes. Supported tokens SHALL include header height or padding, logo max height/width, nav font family/size/weight, nav link spacing, nav background, dropdown background, dropdown border, dropdown shadow, chevron color, active/hover colors, mobile breakpoint, mobile menu background, and mobile menu spacing.

These tokens SHALL be available to the `nav` and `brand_header` blocks through CSS custom properties or scoped style data. Missing tokens SHALL fall back to the existing Kychon header/nav presentation.

#### Scenario: Header footprint tokens apply
- **WHEN** `site_config.theme` contains header padding and logo max-height tokens
- **THEN** the header and brand/logo render with those source-like dimensions
- **THEN** the nav remains in normal document flow unless overlay behavior is explicitly configured

#### Scenario: Dropdown presentation tokens apply
- **WHEN** `site_config.theme` contains dropdown background, border, shadow, and transition tokens
- **THEN** source-configured nav dropdowns use those visual tokens
- **THEN** keyboard and pointer dropdown behavior remains unchanged

#### Scenario: Mobile menu presentation tokens apply
- **WHEN** `site_config.theme` contains mobile menu background and spacing tokens
- **WHEN** the nav menu is opened at the mobile breakpoint
- **THEN** the mobile menu renders with those source-like values
- **THEN** inactive links remain readable

### Requirement: Theme token application is cache-friendly

Copied-theme interaction and header/nav tokens SHALL follow the existing cache-first theme application model. When cached `site_config` contains copied-theme tokens, the system SHALL apply those tokens before network refresh so returning visitors do not see a flash of generic Kychon hover/nav styling.

#### Scenario: Returning visitor gets copied-theme tokens before fetch
- **WHEN** a returning visitor loads a copied-theme site with cached `site_config.theme`
- **THEN** copied-theme interaction and header/nav tokens are applied before the fresh config request completes
- **THEN** the first rendered hover/nav state uses copied-theme values rather than generic defaults

#### Scenario: Fresh config refresh updates copied-theme tokens
- **WHEN** an admin changes copied-theme interaction or nav tokens
- **WHEN** another visitor's stale cache is refreshed
- **THEN** the new tokens are applied after the refresh without a full page reload
