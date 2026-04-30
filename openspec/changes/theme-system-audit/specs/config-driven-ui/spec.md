## MODIFIED Requirements

### Requirement: Theme injection via CSS custom properties

`config.ts` SHALL read the `theme` JSONB from `site_config` and set CSS custom properties on `document.documentElement`. On repeat visits, theme SHALL be applied immediately from cached data. Properties SHALL include: `--color-primary`, `--color-primary-hover`, `--color-accent`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--font-heading`, `--font-body`, `--radius`, `--max-width`. Every property SHALL have at least one downstream usage in `public/css/`; no orphan custom properties shall remain. The `--font-heading` and `--font-body` properties SHALL be consumed by `h1..h6 { font-family: var(--font-heading), …; }` and `body { font-family: var(--font-body), …; }` respectively. The `--radius` property SHALL be consumed by component CSS for cards, buttons, inputs, badges, and popovers. The `--max-width` property SHALL be consumed by `.container` (the only definition of its max-width). The `--color-accent` property SHALL be consumed by at least one component (badges, accent buttons, or `<mark>` text).

When the theme names a non-system font in `font_heading` or `font_body`, the build pipeline SHALL inject Google Fonts `<link>` tags per the `theme-fonts-injection` capability so the named font loads at first paint.

#### Scenario: Theme applied instantly from cache
- **WHEN** a page loads with cached `site_config` containing theme data
- **THEN** CSS custom properties are set before the first paint

#### Scenario: Theme colors applied
- **WHEN** `site_config` theme has `primary: "#6366f1"`
- **THEN** `document.documentElement.style` has `--color-primary: #6366f1`
- **THEN** all elements using `var(--color-primary)` render in that color

#### Scenario: Default theme from CSS
- **WHEN** `site_config` theme values are not yet loaded (or missing) and no cache exists
- **THEN** `theme.css` defaults are used

#### Scenario: Every custom property has a usage
- **WHEN** the audit walks `public/css/` for usages of every theme-set custom property
- **THEN** every property has at least one `var(--{name})` consumer
- **THEN** no orphan custom property exists

#### Scenario: Radius value flows through to components
- **WHEN** `theme.radius = "0.5rem"`
- **THEN** cards, buttons, inputs, badges, and popovers render with `border-radius: 0.5rem`

#### Scenario: Max-width flows to container
- **WHEN** `theme.max_width = "72rem"`
- **THEN** `.container` elements have `max-width: 72rem`

#### Scenario: Heading font flows to typography
- **WHEN** `theme.font_heading = "Playfair Display"` AND the Google Fonts injector has loaded the font
- **THEN** all `<h1>` through `<h6>` elements render in Playfair Display

#### Scenario: Body font flows to typography
- **WHEN** `theme.font_body = "Inter"` AND the Google Fonts injector has loaded the font
- **THEN** the `<body>` and inheriting elements render in Inter

#### Scenario: Named font triggers Google Fonts injection
- **WHEN** `theme.font_heading` is a non-system font
- **THEN** the build emits a `<link>` to Google Fonts loading that font (per the theme-fonts-injection capability)

#### Scenario: System font skips Google Fonts injection
- **WHEN** `theme.font_heading = "system-ui"` and `theme.font_body = "sans-serif"`
- **THEN** no Google Fonts `<link>` is emitted (per the theme-fonts-injection capability)
