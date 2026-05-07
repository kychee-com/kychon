## ADDED Requirements

### Requirement: Astro project configuration
The project SHALL use Astro in SSG mode with `build.format: 'file'` so that output files match Run402's static file serving pattern (e.g., `dist/events.html`, not `dist/events/index.html`).

The `astro.config.mjs` SHALL configure:
- `output: 'static'` (default SSG)
- `build.format: 'file'`
- `i18n` with `defaultLocale: 'en'` and locales from `brand.json`
- `vite` configuration for test compatibility

#### Scenario: Build produces flat HTML files
- **WHEN** `astro build` runs
- **THEN** `dist/` contains `index.html`, `events.html`, `directory.html`, etc. at the root level (not in subdirectories)

#### Scenario: Build output is deployable to Run402
- **WHEN** `dist/` files are collected into an `app.json` manifest
- **THEN** Run402 serves them at the same URLs as the current vanilla site

### Requirement: Portal layout wraps all pages
A `Portal.astro` layout SHALL wrap all portal pages, providing:
- HTML `<head>` with meta tags, theme.css, global styles, and env.js script
- `<ClientRouter />` for view transitions
- Nav component (static HTML shell, populated by ConfigProvider)
- Footer component
- `<slot />` for page-specific content
- ConfigProvider island (`client:load`)
- AuthProvider island (`client:load`)
- Toast island (`client:idle`)

#### Scenario: New page uses layout
- **WHEN** an agent creates a new page at `src/pages/volunteers.astro`
- **THEN** it only needs `import Portal from '../layouts/Portal.astro'` and wraps content in `<Portal title="Volunteers">...</Portal>`
- **AND** nav, footer, theme, auth, and i18n are automatically available

#### Scenario: Layout loads admin editor for admins
- **WHEN** the current user has role `admin`
- **THEN** the layout loads the AdminEditor island with `client:idle`
- **AND** non-admin users never download the admin editor JS

### Requirement: One page file per route
Each portal route SHALL have exactly one `.astro` file in `src/pages/`. Page files SHALL be minimal — importing the layout and composing islands for interactive sections.

#### Scenario: Page file structure
- **WHEN** an agent reads any page file (e.g., `src/pages/events.astro`)
- **THEN** it contains a frontmatter block with layout import, and HTML with component composition
- **AND** it does NOT contain raw fetch calls, DOM manipulation, or business logic (those live in islands/components)

### Requirement: Component organization
Reusable components SHALL live in `src/components/`. Shared utilities SHALL live in `src/lib/`. Zod schemas SHALL live in `src/schemas/`.

The file structure SHALL be:
```
src/
├── pages/          (one .astro per route)
├── layouts/        (Portal.astro + any variant layouts)
├── components/     (reusable .astro components)
├── lib/            (api.ts, i18n.ts, shared utilities)
├── schemas/        (Zod schemas for API responses)
└── styles/         (theme.css, global.css)
public/
├── custom/         (brand.json, strings/*.json)
└── js/             (env.js — generated at deploy time)
```

#### Scenario: Agent finds component by convention
- **WHEN** an agent needs to modify the event card display
- **THEN** it looks in `src/components/EventCard.astro`
- **AND** the component is self-contained with scoped styles

### Requirement: Island hydration conventions
Interactive components SHALL use the most restrictive `client:*` directive that satisfies their needs:
- `client:load` — only for components that MUST run before first paint (config, auth)
- `client:visible` — for interactive content below the fold (RSVP, search, forum forms)
- `client:idle` — for non-urgent interactivity (admin editor, toast, language switcher)

Static components (EventCard display, MemberCard display, Footer) SHALL NOT use any `client:*` directive.

#### Scenario: Non-interactive component ships zero JS
- **WHEN** a component has no `client:*` directive
- **THEN** it renders to static HTML at build time
- **AND** no JavaScript is shipped to the browser for that component

#### Scenario: Interactive component uses appropriate hydration
- **WHEN** an agent creates an interactive component
- **THEN** it uses the least-eager hydration strategy that works (prefer `client:visible` or `client:idle` over `client:load`)
