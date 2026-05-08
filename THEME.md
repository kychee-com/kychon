# Theme

Kychon's theme system reads `site_config.theme` (a JSONB row) and projects each key onto a CSS custom property on `document.documentElement`. Every property has at least one downstream consumer in `public/css/` — no orphan keys. When a theme names a non-system font, `Portal.astro`'s build-time bake injects Google Fonts `<link>` tags into the page head so the named font loads at first paint.

Deployment styling should start with `site_config.theme`, block config, and documented Kychon CSS variables. Do not create a second utility system per deployment, and do not build Tailwind class names dynamically from tenant data; use CSS variables or finite static variants instead.

## Theme keys

| `theme.*` key | CSS custom property | Default | What it controls |
|---|---|---|---|
| `primary` | `--color-primary` | `#6366f1` | Links, primary buttons, focus rings, accent badges |
| `primary_hover` | `--color-primary-hover` | `#4f46e5` | Hover state of links and primary buttons |
| `accent` | `--color-accent` | `#f59e0b` | `.badge-accent` background + border tint, `<mark>` highlight |
| `bg` | `--color-bg` | `#ffffff` | Page background, card surfaces, nav bar |
| `surface` | `--color-surface` | `#f8fafc` | Hover surfaces, selected states |
| `text` | `--color-text` | `#0f172a` | Body text, headings |
| `text_muted` | `--color-text-muted` | `#64748b` | Secondary text, captions, meta |
| `border` | `--color-border` | `#e2e8f0` | Card borders, dividers, input outlines |
| `font_heading` | `--font-heading` | `"Inter", system-ui, sans-serif` | `<h1>` through `<h6>` font-family (Google Fonts auto-injected for non-system names) |
| `font_body` | `--font-body` | `"Inter", system-ui, sans-serif` | `<body>` font-family (Google Fonts auto-injected for non-system names) |
| `radius` | `--radius` | `0.5rem` | Corner radius for cards, buttons, inputs, badges, modals (avatars and pill shapes are intentionally fixed) |
| `max_width` | `--max-width` | `72rem` | `.ky-container` max width (modals, toasts, and feed lists keep their component-local caps) |

## Recommended values

- **Colors**: any CSS color (`#0066cc`, `rgb(0, 102, 204)`, `oklch(60% 0.12 240)` …). Hex with full 6-digit form is the safest choice across browsers.
- **Radius**: any CSS length (`0`, `0.25rem`, `1rem`, `12px`). Use `0` for square, `0.5rem` for rounded.
- **Max width**: any CSS length (`60rem`, `1280px`, `100%`). Common values: `64rem` (narrow), `72rem` (default), `80rem` (wide).
- **Fonts**: a single font family name. The injector adds the system fallback stack at the consumer (`var(--font-heading), system-ui, sans-serif`), so a missing or unloaded font still falls back gracefully.

## Google Fonts injection

When `font_heading` or `font_body` names a font outside the system-font allowlist, `Portal.astro`'s frontmatter calls `renderFontHead()` from `src/lib/theme/fonts.ts` and emits these tags into `<head>` before any stylesheet:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={…}&display=swap">
```

The URL combines both fonts when both are non-system, deduplicates when both are the same font, and includes `&display=swap` so the fallback renders during the font load (no flash of invisible text).

### System font allowlist (skips injection)

Names matching this list (case-insensitive, surrounding quotes stripped) resolve OS-side and skip Google Fonts:

`system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica`, `Helvetica Neue`, `Arial`, `sans-serif`, `serif`, `monospace`.

### Font weights

- Headings load `wght@400;700` (regular + bold).
- Body loads `wght@400;600` (regular + semibold for emphasis).

If a project needs other weights, edit the URL builder in `src/lib/theme/fonts.ts`.

### Failure modes

- **Misspelled font name** — Google Fonts returns 404 for unknown families. The browser logs the 404 in DevTools but doesn't surface the failure visibly; text renders in the system fallback. Verify the name on [fonts.google.com](https://fonts.google.com) before deploying.
- **Adobe Fonts / self-hosted fonts** — out of scope for v1. The injector targets Google Fonts only. Self-hosting is a follow-up that would also handle subsetting and licensing.

### Privacy / GDPR

Loading fonts from `fonts.gstatic.com` exposes visitor IPs to Google. The Munich Regional Court (2022) ruled this requires consent under GDPR for sites serving EU visitors. For Kychon's typical org-portal use case the impact is low, but operators with EU members should consider self-hosting (out of scope here) or a similar privacy-preserving CDN.

## Demo theme pairings

Each demo exercises a distinct heading + body pairing so the injector is visibly working in production:

| Demo | Heading | Body |
|---|---|---|
| **eagles** (boat club) | Cormorant Garamond | Inter |
| **silver-pines** (HOA) | Bitter | IBM Plex Sans |
| **barrio-unido** (church) | Merriweather | Noto Sans |
| **kychon** (template default) | Inter | Inter |

## Files

- `src/lib/theme/fonts.ts` — `isSystemFont`, `buildGoogleFontsUrl`, `renderFontPreconnect`, `renderFontStylesheet`, `renderFontHead`.
- `src/lib/config.ts` — `applyTheme(theme)` projects `site_config.theme` keys onto CSS custom properties at runtime.
- `src/schemas/config.ts` — `ThemeSchema` validates the JSONB shape.
- `src/layouts/Portal.astro` — frontmatter calls `renderFontHead` and emits the link tags via `<Fragment set:html={…} />`.
- `public/css/theme.css` — `:root` defaults for every custom property.
- `src/styles/public.css` — public chrome/block/component styles bundled through the Astro/Tailwind entrypoint.
- `tests/unit/theme-fonts.test.ts` — unit tests for the injector (allowlist, URL builder, dedupe, encoding).
