# UI Architecture Migration Guardrails

This document is the baseline control surface for the staged Astro + Tailwind v4 + shadcn/ui + React-islands migration.

## Route Inventory

| ID | Route | Kind | Purpose |
|---|---|---|---|
| `home` | `/` | Public | Anonymous public homepage and baked global chrome. |
| `events` | `/events` | Public | Dynamic event list surface with public content and auth-aware actions. |
| `resources` | `/resources` | Public | Public/member-gated resource browser. |
| `forum` | `/forum` | Public | Public forum shell with auth/admin-aware behavior. |
| `admin-settings` | `/admin-settings` | Admin | Current high-ROI settings page for React-island migration. |
| `baked-chrome-page` | `/page.html?slug=showcase` | Public | Representative baked-chrome/content page for visual regression. |

## Baseline Commands

Run these before and after each migration slice:

```bash
npm run check
npm run build
```

Additional migration guardrails:

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

Public pages and admin pages must be reviewed separately. Anonymous public pages should not ship React by default unless that cost is explicitly accepted for the phase.

AuthModal migration measurement:

- The Astro launcher ships as a small public script (`AuthModal.astro` built to 754 bytes uncompressed in the current bundle report).
- A Playwright smoke against preview confirmed no `AuthModalIsland` or React client chunk is requested before the `kychon:auth-open` event.
- On first auth open, the browser loads the lazy React island chunk (`AuthModalIsland`, 4.2 KB uncompressed in the latest split) and the shared React/Radix runtime chunk.
- The selected hydration path is lazy-on-first-open so anonymous public pages keep React auth code off the initial route load.

Toast migration measurement:

- `Toast.astro` now ships only the Kychon event launcher and legacy compatibility shim for `window.__wl_showToast`.
- A Playwright smoke against preview confirmed no `ToastIsland` or Sonner chunk is requested before the `kychon:toast` event.
- On first toast, the browser loads the lazy React island chunk (`ToastIsland`, 34 KB uncompressed) and the shared React runtime/Sonner chunks.
- The toast root is persisted across Astro navigation; the smoke verified one Sonner toaster before navigation and one after navigating to `/events.html`.

Admin settings migration measurement:

- `/admin-settings.html` now mounts `AdminSettingsApp` with `client:load`; the public route inventory still keeps admin settings measured separately from anonymous public pages.
- The current admin settings island chunk is 23 KB uncompressed, plus the shared React/Radix runtime chunks already introduced by the admin/auth/toast slices.
- A mocked Playwright smoke verified admin access reveal, config population, tier dialog focus and Escape behavior, custom-field dialog focus, native select/checkbox keyboard behavior, save-through-API behavior, and remount after navigation.

AdminEditor control migration measurement:

- The first migrated editor slice is the per-block settings control for width, scope, remove, and links into type-specific hero/source settings.
- The current `AdminEditorControlsIsland` chunk is 6.2 KB uncompressed and is loaded dynamically only after `AdminEditor.astro` confirms an admin session.
- A Playwright smoke verified anonymous public pages do not request `AdminEditorControlsIsland`, while an admin session can open the block settings dialog, save width through `PATCH sections?id=eq...`, mirror `data-column-span` in the rendered block, close with Escape, and reopen exactly once after navigation.

## CSS Collision Policy

Generate the current collision report with:

```bash
npm run ui:css-collisions
npm run ui:css-collisions -- --out docs/ui-css-collision-report.md
```

Legacy classes that collide with Tailwind or the component system are split into three buckets:

- `.container` is retired as a Kychon chrome/layout class; use Tailwind layout utilities with `data-layout-container` for Kychon chrome/block layout.
- `.btn`, `.card`, `.badge`, `.form-input`, `.form-select`, and `.form-textarea` are retired Kychon public component classes; use shadcn/Kychon UI components and semantic `data-*` hooks for automation/readiness selectors.
- `.hidden`, `.flex`, `.flex-col`, `.gap-1`, `.mt-1`, `.mt-2`, `.mb-1`, `.mb-2`, `.items-center`, `.justify-between`, `.text-sm`, and `.text-center` are legacy utility collisions that should be renamed, deleted, or quarantined before broad unprefixed Tailwind usage.

New UI code should not add fresh usages of those legacy utilities unless the code is explicitly working inside the compatibility layer.

Tailwind/public CSS ownership:

- `src/styles/globals.css` imports Tailwind theme, Kychon's token bridge, bundled chrome CSS (`theme.css`, `zone-grid.css`, `a11y.css`), Kychon's owned public CSS, and Tailwind utilities. Preflight is still not imported, so DB-rendered prose and copied block HTML keep the current reset assumptions.
- `src/styles/public.css` replaced the old static `/css/styles.css` file. Public layout/block styles are now bundled through Astro/Vite next to Tailwind instead of loaded as a separate legacy stylesheet.
- Tailwind-generated utility rules remain in the `utilities` cascade layer after Kychon's public CSS, so feature code can use unprefixed Tailwind utilities without an old utility layer winning by accident.
- Kychon layout uses Tailwind utilities with `data-layout-container`; `.container` is no longer a Kychon class. Muted public/static markup now uses Tailwind/shadcn semantic text utilities instead of a Kychon helper class.
- Remaining static `public/css/*.css` files are lazy admin/block adjuncts plus compatibility copies for local tooling; portal chrome CSS is bundled from `src/styles/` and should not be linked from shared HTML.

Public CSS token bridge:

- `src/styles/theme.css` now defines `--ky-*` runtime tokens first, maps shadcn/Tailwind semantic tokens from them, then exposes the old `--color-*` aliases as compatibility shims. The public copy is retained only for compatibility tooling.
- Public blocks remain Astro/static, but shared public classes such as `.feature-card` now read semantic tokens where practical; `.btn`, `.card`, `.form-input`, and `.badge` have moved to shadcn/Kychon UI components, while nav, hero, section visibility, footer chrome, and screenshot readiness hooks use semantic `data-*` hooks.
- Demo seeds and copied-site themes should set runtime values through `site_config.theme`, not dynamic Tailwind classes or one-off generated CSS utility names.

## Browser Support Floor

The migration targets the modern-browser floor required by Tailwind v4 and the CSS already used by Kychon:

- Chrome 111+
- Safari 16.4+
- Firefox 128+

Older browser support requires an explicit product exception before Tailwind v4 becomes a hard requirement for customer-facing pages.

## Primitive And Dynamic Class Guard

`npm run ui:architecture-check` enforces two rules:

- Feature code must not import `@radix-ui/*` or `@base-ui-components/*` directly. Imports from those packages belong behind `src/components/ui/*` or an approved UI adapter.
- Feature code must import Kychon React UI through `@/components/kychon/ui`, not directly from `@/components/ui/*`. The `src/components/ui/*` files stay product-owned shadcn source, while `src/components/kychon/ui.ts` is the app-facing facade.
- Product source must not hand-build DOM with APIs such as `document.createElement`, `innerHTML =`, `appendChild`, or `classList`; use React islands, Astro markup, or owned DOM-fragment helpers.
- Feature TSX/Astro must render visible controls through Kychon/shadcn components; raw native controls are reserved for non-visible plumbing such as hidden inputs and hidden file pickers.
- Product source must not use exact retired Kychon primitive class tokens such as `.container`, `.text-muted`, `.btn`, `.card`, `.badge`, `.toast`, or old form primitive classes, and CSS must not define them.
- Owned CSS in `src/styles/` and `public/css/` must not define custom class selectors; use semantic `data-*` selectors, element selectors, and Tailwind utility classes from markup instead.
- Tests must not reintroduce hand-built DOM fixtures; use `tests/helpers/dom-fixture.js` for parsed fixture markup, while negative source assertions may still assert that product code omits old DOM APIs.
- Runtime values must not construct Tailwind utility names such as ``bg-${tenantColor}-500``. Use CSS variables, data attributes, static variant maps, or a finite safelist.

Base UI exception rule:

- Radix-backed shadcn components are the default primitive path.
- Base UI may be used only when a component has a written rationale and an owned wrapper in `src/components/ui/*` or `src/lib/ui/*`.
- Feature code still imports the Kychon wrapper, never `@base-ui-components/*` directly.

shadcn initialization note:

- `components.json` is intentionally checked in because `shadcn@4.7.0 init --template astro --base radix` detects Astro and Tailwind v4 but rejects Kychon's split Tailwind import as missing conventional Tailwind configuration.
- All shadcn components are available to Kychon as copy-owned source, but feature and deployment code must treat them as Kychon components: add missing components under `src/components/ui/*`, adapt tokens as needed, re-export through `@/components/kychon/ui` or a wrapper, then import the Kychon export.
- The generated component style is `new-york`; Kychon tokens in `src/styles/tokens.css` own the visual theme.

## Rollback Notes

- Tailwind foundation: remove the global Tailwind import, Vite/PostCSS integration, and token bridge import.
- React/shadcn foundation: remove the Astro React integration and any unused UI components.
- AuthModal and toast: keep the old Astro components available until focus, auth, navigation, and bundle checks pass.
- Admin settings and AdminEditor: migrate behind islands in slices so public block rendering can remain static and unaffected by rollback.
