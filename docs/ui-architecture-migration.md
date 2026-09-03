# UI Architecture Guardrails

This document is the control surface for Kychon's Astro + Tailwind v4 + shadcn/ui + React-islands architecture.

## Route Inventory

| ID | Route | Kind | Purpose |
|---|---|---|---|
| `home` | `/` | Public | Anonymous public homepage and baked global chrome. |
| `events` | `/events` | Public | Dynamic event list surface with public content and auth-aware actions. |
| `resources` | `/resources` | Public | Public/member-gated resource browser. |
| `forum` | `/forum` | Public | Public forum shell with auth/admin-aware behavior. |
| `admin-settings` | `/admin-settings` | Admin | Admin settings page, mounted as a React island. |
| `baked-chrome-page` | `/page.html?slug=showcase` | Public | Representative baked-chrome/content page for visual regression. |

## Baseline Commands

Run these before and after any UI change:

```bash
npm run check
npm run build
```

`npm run check` includes the UI architecture guard so import, DOM, primitive-class, visible-control, and owned-CSS regressions fail in the standard verification path.

Additional guardrails:

```bash
npm run ui:architecture-check
npm run ui:css-collisions
npm run ui:bundle-report
```

## Screenshot Capture

Screenshots are intentionally optional-dependency tooling so the normal install stays light.

1. Start a local preview server after `npm run build`:

   ```bash
   npm run preview -- --host 127.0.0.1
   ```

2. In another terminal, capture the route inventory:

   ```bash
   npm exec --package=playwright -- tsx scripts/ui-capture-routes.ts --base http://127.0.0.1:4321
   ```

The script writes desktop and mobile PNGs to `tmp/ui-screenshots/`. Capture after the baseline, Tailwind foundation,
AuthModal, admin settings, and AdminEditor phases.

By default the capture script mocks the Run402 REST/auth/function endpoints with deterministic route-inventory data so
screenshots cannot silently become API-error baselines. To capture against live project data, pass `--live-api`; the
script still fails if known loading-error text is rendered.

For typed demo seeds, build with `KYCHON_PROJECT` and pass the same project to the capture script. In mock mode the
script loads that seed's site config, sections, pages, membership fields, and local `demo/<project>/assets/*` files:

```bash
KYCHON_PROJECT=silver-pines npm run build
npm exec --package=playwright -- tsx scripts/ui-capture-routes.ts --base http://127.0.0.1:4321 --project silver-pines --out-dir tmp/ui-screenshots/silver-pines
```

The `baked-chrome-page` route is `showcase` when that page exists; otherwise it uses the first published seed page.

## Bundle Measurement

Bundle reports are generated from `dist/`, so run `npm run build` first:

```bash
npm run ui:bundle-report
npm run ui:bundle-report -- --out docs/ui-bundle-baseline.json
```

Public pages and admin pages must be reviewed separately. Anonymous public pages must not ship React by default unless that cost is explicitly accepted.

AuthModal budget:

- The Astro launcher ships as a small public script (`AuthModal.astro`, ~754 bytes uncompressed).
- No `AuthModalIsland` or React client chunk is requested before the `kychon:auth-open` event.
- On first auth open the browser loads the lazy React island chunk (`AuthModalIsland`, ~4.2 KB uncompressed) plus the shared React/Radix runtime chunk. Hydration is lazy-on-first-open so anonymous public pages keep React auth code off the initial route load.

Toast budget:

- `Toast.astro` ships only the Kychon event launcher and the compatibility shim for `window.__wl_showToast`.
- No `ToastIsland` or Sonner chunk is requested before the `kychon:toast` event.
- On first toast the browser loads the lazy React island chunk (`ToastIsland`, ~34 KB uncompressed) plus the shared React runtime/Sonner chunks.
- The toast root persists across Astro navigation: exactly one Sonner toaster before and after navigation.

Admin settings budget:

- `/admin-settings.html` mounts `AdminSettingsApp` with `client:load`; the route inventory keeps admin settings measured separately from anonymous public pages.
- The admin settings island chunk is ~23 KB uncompressed, plus the shared React/Radix runtime chunks.

AdminEditor controls budget:

- `AdminEditorControlsIsland` covers the per-block settings control for width, scope, remove, and links into type-specific hero/source settings.
- The chunk is ~6.2 KB uncompressed and loads dynamically only after `AdminEditor.astro` confirms an admin session. Anonymous public pages never request it.

## CSS Collision Policy

Generate the current collision report with:

```bash
npm run ui:css-collisions
npm run ui:css-collisions -- --out docs/ui-css-collision-report.md
```

Classes that collide with Tailwind or the component system fall into three buckets:

- `.container` is not a Kychon chrome/layout class; use Tailwind layout utilities with `data-layout-container` for Kychon chrome/block layout.
- `.btn`, `.card`, `.badge`, `.form-input`, `.form-select`, and `.form-textarea` are not Kychon public component classes; use shadcn/Kychon UI components and semantic `data-*` hooks for automation/readiness selectors.
- `.hidden`, `.flex`, `.flex-col`, `.gap-1`, `.mt-1`, `.mt-2`, `.mb-1`, `.mb-2`, `.items-center`, `.justify-between`, `.text-sm`, and `.text-center` are utility collisions that must be renamed, deleted, or quarantined before broad unprefixed Tailwind usage.

New UI code must not add fresh usages of those colliding utilities unless the code is explicitly working inside the compatibility layer.

Tailwind/public CSS ownership:

- `src/styles/globals.css` imports Tailwind theme, Kychon's token bridge, bundled chrome CSS (`theme.css`, `zone-grid.css`, `a11y.css`), Kychon's owned public CSS, and Tailwind utilities. Preflight is deliberately not imported, so DB-rendered prose and copied block HTML keep Kychon's reset assumptions.
- `src/styles/public.css` carries the public layout/block styles, bundled through Astro/Vite next to Tailwind rather than loaded as a separate stylesheet.
- Tailwind-generated utility rules sit in the `utilities` cascade layer after Kychon's public CSS, so feature code can use unprefixed Tailwind utilities without another utility layer winning by accident.
- Kychon layout uses Tailwind utilities with `data-layout-container`, and muted public/static markup uses Tailwind/shadcn semantic text utilities rather than a Kychon helper class.
- Remaining static `public/css/*.css` files are lazy admin/block adjuncts plus compatibility copies for local tooling; portal chrome CSS is bundled from `src/styles/` and should not be linked from shared HTML.

Public CSS token bridge:

- `src/styles/theme.css` defines `--ky-*` runtime tokens first, maps shadcn/Tailwind semantic tokens from them, then exposes `--color-*` aliases as compatibility shims. The copy under `public/css/` exists only for compatibility tooling.
- Public blocks are Astro/static, and shared public classes such as `.feature-card` read semantic tokens where practical. Buttons, cards, form inputs, and badges are shadcn/Kychon UI components; nav, hero, section visibility, footer chrome, and screenshot readiness hooks use semantic `data-*` hooks.
- Demo seeds and copied-site themes should set runtime values through `site_config.theme`, not dynamic Tailwind classes or one-off generated CSS utility names.

## Browser Support Floor

Kychon targets the modern-browser floor required by Tailwind v4 and the CSS it uses:

- Chrome 111+
- Safari 16.4+
- Firefox 128+

Older browser support requires an explicit product exception.

## Primitive And Dynamic Class Guard

`npm run ui:architecture-check` enforces two rules:

- Feature code must not import `@radix-ui/*` or `@base-ui-components/*` directly. Imports from those packages belong behind `src/components/ui/*` or an approved UI adapter.
- Feature code must import Kychon React UI through `@/components/kychon/ui`, not directly from `@/components/ui/*`. The `src/components/ui/*` files stay product-owned shadcn source, while `src/components/kychon/ui.ts` is the app-facing facade.
- Product source must not hand-build DOM with APIs such as `document.createElement`, `innerHTML =`, `appendChild`, or `classList`; use React islands, Astro markup, or owned DOM-fragment helpers.
- Feature TSX/Astro must render visible controls through Kychon/shadcn components; raw native controls are reserved for non-visible plumbing such as hidden inputs and hidden file pickers.
- Product source must not use the banned Kychon primitive class tokens `.container`, `.text-muted`, `.btn`, `.card`, `.badge`, `.toast`, or the form primitive classes, and CSS must not define them.
- Owned CSS in `src/styles/` and `public/css/` must not define custom class selectors; use semantic `data-*` selectors, element selectors, and Tailwind utility classes from markup instead.
- Owned source under `public/` is scanned for the same architecture regressions as `src`, so public JS cannot introduce hand-built DOM or banned UI helpers.
- Tests must not use hand-built DOM fixtures; use `tests/helpers/dom-fixture.js` for parsed fixture markup. Negative source assertions may still assert that product code omits the banned DOM APIs.
- Runtime values must not construct Tailwind utility names such as ``bg-${tenantColor}-500``. Use CSS variables, data attributes, static variant maps, or a finite safelist.

Base UI exception rule:

- Radix-backed shadcn components are the default primitive path.
- Base UI may be used only when a component has a written rationale and an owned wrapper in `src/components/ui/*` or `src/lib/ui/*`.
- Feature code still imports the Kychon wrapper, never `@base-ui-components/*` directly.

shadcn initialization note:

- `components.json` is intentionally checked in because `shadcn@4.7.0 init --template astro --base radix` detects Astro and Tailwind v4 but rejects Kychon's split Tailwind import as missing conventional Tailwind configuration.
- All shadcn components are available to Kychon as copy-owned source, but feature and deployment code must treat them as Kychon components: add missing components under `src/components/ui/*`, adapt tokens as needed, re-export through `@/components/kychon/ui` or a wrapper, then import the Kychon export.
- The generated component style is `new-york`; Kychon tokens in `src/styles/tokens.css` own the visual theme.
