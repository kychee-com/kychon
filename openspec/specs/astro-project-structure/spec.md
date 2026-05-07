## Purpose

Kychon's Astro structure organizes routes, layouts, islands, shared utilities, schemas, and deploy output so portal pages remain static-first while interactive features hydrate intentionally.

## Requirements

### Requirement: Astro project configuration

The project SHALL use Astro in SSG mode with `build.format: 'file'` so output files match Run402's static file serving pattern, such as `dist/events.html` rather than `dist/events/index.html`.

The `astro.config.mjs` SHALL configure:
- `output: 'static'`
- `build.format: 'file'`
- `i18n` with `defaultLocale: 'en'` and configured locales
- Vite/Vitest-compatible path resolution where tests require it

#### Scenario: Build produces flat HTML files
- **WHEN** `astro build` runs
- **THEN** `dist/` contains `index.html`, `events.html`, `directory.html`, and other route files at the root level instead of nested route directories

#### Scenario: Build output is deployable to Run402
- **WHEN** `dist/` files are collected into a Run402 deploy payload
- **THEN** Run402 serves them at the same URLs as the portal routes

### Requirement: Portal layout wraps all pages

A `Portal.astro` layout SHALL wrap all portal pages and provide shared chrome and runtime islands.

The layout SHALL provide:
- HTML `<head>` metadata, theme CSS, global CSS, and `env.js`
- Astro `<ClientRouter />` for client-side transitions
- Static first-byte header and footer chrome
- `<slot />` for page-specific content
- `ConfigProvider` and `AuthProvider` islands
- `Toast` and admin editing support islands

#### Scenario: New page uses layout
- **WHEN** an agent creates a new page at `src/pages/volunteers.astro`
- **THEN** the page imports `Portal` and wraps content in `<Portal title="Volunteers">...</Portal>`
- **AND** shared chrome, theme, auth, and i18n behavior are automatically available

#### Scenario: Layout initializes admin editor for admins
- **WHEN** the current user has role `admin`
- **THEN** the layout's admin editor support enables inline editing behavior after hydration
- **AND** non-admin users do not receive active edit affordances

### Requirement: One page file per route

Each portal route SHALL have exactly one `.astro` file in `src/pages/`. Page files SHALL stay minimal by importing the layout and composing static markup or interactive islands for page-specific sections.

#### Scenario: Page file structure
- **WHEN** an agent reads any page file such as `src/pages/events.astro`
- **THEN** it contains a frontmatter block with layout imports and HTML/component composition
- **AND** reusable business logic lives in components or `src/lib/`

### Requirement: Component organization

Reusable components SHALL live in `src/components/`. Shared utilities SHALL live in `src/lib/`. Zod schemas SHALL live in `src/schemas/`.

The file structure SHALL include:

```text
src/
├── pages/
├── layouts/
├── components/
├── lib/
├── schemas/
└── styles/
public/
├── custom/
└── js/
```

#### Scenario: Agent finds component by convention
- **WHEN** an agent needs to modify event card display
- **THEN** it looks for the relevant display component or renderer in `src/components/` or `src/lib/`
- **AND** shared schema and API logic remain outside route files

### Requirement: Island hydration conventions

Interactive components SHALL use the most restrictive `client:*` directive that satisfies their needs:
- `client:load` for components that must run before first paint or initial hydration, such as config and auth
- `client:visible` for interactive content below the fold
- `client:idle` for non-urgent interactivity such as toasts, language controls, or admin editing support

Static components SHALL NOT use any `client:*` directive unless browser interactivity is required.

#### Scenario: Non-interactive component ships zero JS
- **WHEN** a component has no `client:*` directive
- **THEN** it renders to static HTML at build time
- **AND** no component-specific browser JavaScript is shipped for that component

#### Scenario: Interactive component uses appropriate hydration
- **WHEN** an agent creates an interactive component
- **THEN** it uses the least-eager hydration strategy that satisfies the workflow
