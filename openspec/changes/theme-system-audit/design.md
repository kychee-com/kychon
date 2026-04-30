## Context

Today's `config-driven-ui` capability includes a "Theme injection via CSS custom properties" requirement that lists `--color-primary`, `--color-primary-hover`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--font-heading`, `--font-body`, `--radius`, `--max-width`. The implementation in `src/lib/config.ts` reads `site_config.theme` and sets these custom properties on `document.documentElement`.

Two gaps surfaced from the ODBC port:

1. Some custom properties are set but not consumed by downstream CSS. Setting `--radius: 0.5rem` does nothing if components hardcode `border-radius: 4px`. Same for `--max-width`, `--accent`, and the font properties.
2. `--font-heading: "Playfair Display"` is a string. Browsers honor the value, but the named font has to be available. Without a `<link>` to Google Fonts (or another loader), the browser silently falls back to the next-listed family in the stack.

Both are fixable in this change with low risk. The audit catches orphans; the injector loads named fonts.

Constraints:
- Composable-layout's bake pattern in `Portal.astro` frontmatter is the right place for font injection: the `<link>` tags ship in the HTML head before first paint.
- Google Fonts is the most common font source; supporting other CDNs (Adobe Fonts, self-hosted) is out of scope for v1. Naming a non-Google font that's not in the system allowlist will produce a `<link>` to Google Fonts that 404s — log a console warning.
- The CSP baseline (from embed-block) already permits `font-src https://fonts.gstatic.com` and `style-src https://fonts.googleapis.com` (the latter is needed for the linked stylesheet — to verify in the embed-block spec; if missing, this change adds it).

## Goals / Non-Goals

**Goals:**
- Every `site_config.theme` key flows to a CSS custom property AND a downstream usage. No orphan keys.
- Named fonts in the theme automatically load via Google Fonts at build time, no admin config beyond setting the name.
- System fonts (system-ui, sans-serif, etc.) skip the injector — no needless network loads.
- Demos use distinctive named fonts so "modern Kychon" is the deployed default.
- Documentation: a clear table of every theme key, its CSS custom property, and where it's used.

**Non-Goals:**
- Self-hosted fonts. v1 uses Google Fonts as the only font source. Self-hosting is a follow-up that would also include subsetting and licensing concerns.
- Custom font weight/style picker per project. v1 loads `wght@400;600;700` for sans-serifs and `wght@400;700` for serifs. Admins who need other weights edit the injector's URL builder.
- Font fallback configuration via theme. The fallback stack is fixed (sans-serif uses `system-ui, sans-serif`; serif uses `Georgia, serif`; monospace uses `ui-monospace, monospace`).
- Multi-language font selection (e.g. CJK font for zh locale). Tracked separately if surfaced by a port.
- Runtime font swapping (admin changes font, fonts re-load without refresh). v1 requires a page reload after admin font changes (the bake regenerates).

## Decisions

### 1. Audit method

**Decision**: walk `public/css/theme.css` and any other CSS file under `public/css/`. For each `--*` custom property declared, search the codebase for `var(--*)` usage. If used: keep. If unused: either wire (add a CSS rule that uses it) or remove from the schema.

Initial expected status table:

| Theme key | CSS custom property | Status | Action |
|---|---|---|---|
| `primary` | `--color-primary` | Wired | Keep |
| `primary_hover` | `--color-primary-hover` | Wired | Keep |
| `bg` | `--color-bg` | Wired | Keep |
| `surface` | `--color-surface` | Wired | Keep |
| `text` | `--color-text` | Wired | Keep |
| `text_muted` | `--color-text-muted` | Wired | Keep |
| `border` | `--color-border` | Wired | Keep |
| `accent` | `--color-accent` | Verify | Wire if orphan (cards, badges, links?) |
| `font_heading` | `--font-heading` | Verify | Wire (see Decision 2) |
| `font_body` | `--font-body` | Verify | Wire |
| `radius` | `--radius` | Verify | Audit components: replace hardcoded `border-radius` with `var(--radius)` where appropriate |
| `max_width` | `--max-width` | Verify | Wire to `.container` if orphan |

**Why audit-then-fix**: orphan keys aren't bugs; they're just unused. Removing them would be a regression (the schema documents what theming COULD do); wiring them is cheap and improves the surface.

**Why this is a small task**: ~12 keys, ~5 CSS files. A single grep + visual review.

### 2. Google Fonts URL builder

**Decision**: `src/lib/theme/fonts.ts` exports:

```ts
const SYSTEM_FONTS = [
  'system-ui', '-apple-system', 'BlinkMacSystemFont',
  'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'Helvetica Neue',
  'sans-serif', 'serif', 'monospace',
];

export function isSystemFont(name: string): boolean {
  const cleaned = name.trim().replace(/^["']|["']$/g, '');
  return SYSTEM_FONTS.includes(cleaned);
}

export function buildGoogleFontsUrl(fontHeading?: string, fontBody?: string): string | null {
  const families: string[] = [];
  if (fontHeading && !isSystemFont(fontHeading)) {
    families.push(`${encodeURIComponent(fontHeading.replace(/\s/g, '+'))}:wght@400;700`);
  }
  if (fontBody && !isSystemFont(fontBody) && fontBody !== fontHeading) {
    families.push(`${encodeURIComponent(fontBody.replace(/\s/g, '+'))}:wght@400;600`);
  }
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?family=${families.join('&family=')}&display=swap`;
}

export function renderFontPreconnect(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
}

export function renderFontStylesheet(url: string): string {
  return `<link rel="stylesheet" href="${url}">`;
}
```

`Portal.astro` frontmatter:

```astro
---
import { isSystemFont, buildGoogleFontsUrl, renderFontPreconnect, renderFontStylesheet } from '../lib/theme/fonts';
import { getActiveProjectSeed } from '../seeds';

const seed = getActiveProjectSeed();
const theme = seed.site_config.theme as Record<string, unknown>;
const fontUrl = buildGoogleFontsUrl(
  theme.font_heading as string | undefined,
  theme.font_body as string | undefined
);
---
<head>
  {/* … */}
  {fontUrl && (
    <Fragment set:html={renderFontPreconnect() + renderFontStylesheet(fontUrl)} />
  )}
</head>
```

**Why URL-encode font names**: Google Fonts URLs use `+` for spaces (`Playfair+Display`) and `:wght@…` for weights. The encoder handles these correctly.

**Why `:wght@400;700` for heading and `:wght@400;600` for body**: most themes need regular and bold for headings; regular and semibold for body (links, emphasis). Configurable in a future change if needed.

**Why dedupe when heading == body**: avoids `family=Inter&family=Inter` in the URL.

**Why `Fragment set:html`**: emits two `<link>` tags inline without an Astro component. Frontmatter-time substitution.

### 3. System-font allowlist

**Decision**: the allowlist covers the common system font stacks plus generic family keywords. Names matching the allowlist (case-insensitive, trimmed) skip injection.

The cleaned comparison strips quotes and compares the bare name. `'-apple-system'` and `system-ui` are both common in stacks like `system-ui, -apple-system, sans-serif`.

**Why a fixed allowlist and not a configuration option**: the list is stable and short. Configuration adds a knob few will turn.

### 4. CSP allowance

**Decision**: verify the embed-block CSP baseline includes `style-src https://fonts.googleapis.com` (the linked stylesheet is style content) and `font-src https://fonts.gstatic.com` (the actual font files). If embed-block landed first and only included `font-src`, this change adds `style-src https://fonts.googleapis.com`.

**Why both**: Google Fonts works in two stages. Stage 1: browser fetches CSS from `fonts.googleapis.com` (a stylesheet — needs `style-src`). Stage 2: that CSS contains `@font-face` rules pointing to `fonts.gstatic.com` (needs `font-src`).

### 5. Wiring orphan keys

**Decision**: for each orphan key found in the audit, the change adds CSS rules that consume the corresponding custom property:

- `--color-accent`: usages in `.badge--accent`, `.card-hover-effects accent state`, `<mark>` text. Add new rules in `theme.css` if absent.
- `--radius`: replace hardcoded `border-radius: 4px` and similar in components with `border-radius: var(--radius)` where the radius is meaningful (cards, buttons, inputs). Skip places where a fixed radius is intentional (e.g. avatars use `border-radius: 50%`).
- `--max-width`: ensure `.container { max-width: var(--max-width); }` is the only definition; remove any `.container { max-width: 1200px; }` overrides.
- `--font-heading`: ensure `h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading), system-ui, sans-serif; }` is in `theme.css`.
- `--font-body`: ensure `body { font-family: var(--font-body), system-ui, sans-serif; }` is in `theme.css`.

**Why minimal wiring**: don't expand the surface. Wire what existing component vocabulary already implies; don't invent new theme dimensions.

### 6. Demo theme updates

**Decision**: each demo gets a distinctive font pairing so live deploys exercise the injector and look intentional:

- **eagles** (boat club): `font_heading: "Cormorant Garamond"`, `font_body: "Inter"`. Classic + clean.
- **silver-pines** (HOA): `font_heading: "Bitter"`, `font_body: "IBM Plex Sans"`. Solid, residential, friendly.
- **barrio-unido** (church): `font_heading: "Merriweather"`, `font_body: "Noto Sans"`. Readable, multi-language friendly.
- **kychon** (template default): `font_heading: "Inter"`, `font_body: "Inter"` — single-font modern default for forks who don't customize.

Themes also exercise `accent`, `radius`, `max_width` to validate wiring.

## Risks / Trade-offs

### A. First-paint cost of Google Fonts request

The browser fetches the stylesheet + font files on first paint. With preconnect, this is ~100-200ms additional per font. `font-display: swap` ensures fallback renders while font loads, so no blocking. Trade-off: marginal LCP regression for projects on slow networks. Mitigation: `font-display: swap` is the standard mitigation; nothing more sophisticated is needed for v1.

### B. A misspelled font name 404s silently

If an admin types `font_heading: "Playfaire Display"` (typo), the Google Fonts URL is `family=Playfaire+Display:…`, which returns 404. Browser logs a 404 in DevTools but doesn't surface the error to the admin. Mitigation: a console warning in development mode when a Google Fonts response is non-200. v1 doesn't ship the warning; document the failure mode in `THEME.md`.

### C. Google Fonts privacy / GDPR

Fonts loaded from Google's CDN expose visitor IPs to Google. Some EU jurisdictions have ruled this requires user consent (Munich Regional Court 2022). Mitigation: documented in `THEME.md` with a note that self-hosted fonts (out of scope) avoid this. Not a blocker for v1; user-impact is low for the typical Kychon org-portal use case.

### D. Theme keys with no allowed values

Strings like `radius: "very large"` produce invalid CSS (`border-radius: very large;` is rejected). Browser silently fails. Mitigation: documentation specifies the expected format (CSS length values). v2 could add validation; v1 trusts the editor.

### E. Audit might surface major orphans we don't want to wire

If the audit reveals that, say, `accent` was never meaningfully used and wiring it requires inventing new component states, the right answer is to remove it from the schema, not invent a use. Mitigation: case-by-case judgment in Phase 1. The proposal is "audit and either wire or remove" — both are valid outcomes.

## Migration / Rollout

1. Phase 1: audit. Produce the status table; classify each key as wired/orphan/remove.
2. Phase 2: wire orphans (or remove) per the audit decision.
3. Phase 3: implement the Google Fonts injector.
4. Phase 4: update demos with named fonts.
5. Phase 5: re-deploy demos. Visual verify font rendering on each.
6. Phase 6: ODBC port re-validation. Verify Playfair Display loads on the ported homepage.
7. Phase 7: write `THEME.md`.
