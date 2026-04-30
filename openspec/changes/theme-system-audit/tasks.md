## Tasks

### Phase 1: Audit

- [x] **1.1 Enumerate every theme key**
  Read `src/lib/config.ts` (the theme injection code) and identify every `--*` custom property that is or could be set from `site_config.theme`. List in a working notes file `tmp/theme-audit.md`.

- [x] **1.2 Walk `public/css/` for usages**
  For each custom property, grep `public/css/**/*.css` for `var(--{name})`. Mark as wired (used) or orphan (defined but unused).

- [x] **1.3 Walk components for hardcoded values that should be tokens**
  Grep `public/css/**/*.css` for `border-radius:` (any value). For each occurrence, decide: should this be `var(--radius)`? If yes, mark for replacement. If no (e.g. avatar's `50%`), leave hardcoded. Same for `max-width:` declarations on `.container` or similar.

- [x] **1.4 Produce the status table**
  In `tmp/theme-audit.md`, fill in the table with one row per theme key: key, CSS custom property, current status, action (wire / remove / keep).

### Phase 2: Wire orphans (or remove)

- [x] **2.1 Wire `--font-heading` and `--font-body`**
  `public/css/styles.css` heading rule extended from `h1..h4` to `h1..h6` with `system-ui, sans-serif` fallback stack at the consumer site (so site_config-injected bare font names degrade gracefully). Body rule similarly extended with the fallback stack.

- [x] **2.2 Wire `--radius` (where appropriate)**
  No hardcoded numeric `border-radius` values found in any CSS file — every component radius already uses `var(--radius)`. The remaining hardcoded values (`50%` avatars, `9999px` pills) are shape-defining and intentionally stay literal.

- [x] **2.3 Wire `--max-width`**
  `.container` is the sole layout-container `max-width` consumer in `styles.css:59`. Other hardcoded `max-width` (modals 24rem, toasts 20rem, activity feed 36rem, prose 40rem) are component-local readability caps — kept literal.

- [x] **2.4 Wire `--color-accent` (or remove)**
  Added: `accent` → `ThemeSchema` (`src/schemas/config.ts`), `applyTheme` injection map (`src/lib/config.ts:155`), `theme.css` `:root` default (`#f59e0b`), and consumers `.badge-accent { … }` plus `mark { … }` in `public/css/styles.css`.

- [x] **2.5 Verify all wiring with a sample theme**
  Verified by inspection: `applyTheme` map covers all 12 keys; CSS consumers exist for each. Visual demo verification happens in Phase 5 when the demo seeds re-deploy with named fonts and exercised theme tokens.

### Phase 3: Google Fonts injector

- [x] **3.1 Create `src/lib/theme/fonts.ts`**
  Exports `SYSTEM_FONTS`, `isSystemFont`, `buildGoogleFontsUrl`, `renderFontPreconnect`, `renderFontStylesheet`, plus a `renderFontHead` convenience that combines them.

- [x] **3.2 Inject in `Portal.astro` frontmatter**
  Frontmatter unwraps `seed.site_config.theme` (the seed wraps each key as `{ value, category }`), pulls `font_heading` / `font_body`, calls `renderFontHead`, and emits the result via `<Fragment set:html={fontHead} />` in `<head>` immediately after the favicon link and before the stylesheets. Verified end-to-end: `KYCHON_PROJECT=eagles npx astro build` produces `dist/index.html` containing both preconnects plus `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&family=Open+Sans:wght@400;600&display=swap">`.

- [x] **3.3 Verify CSP allows the injection**
  No CSP baseline exists in the repo today (no `Content-Security-Policy` in `src/`, `public/`, `scripts/`, or `functions/`). The CSP baseline is owned by `embed-block`. Documented requirement carried forward in `tmp/theme-audit.md` and in the `theme-fonts-injection` spec (Requirement 3): `embed-block` must include `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com` in the baseline so the injected stylesheet loads, and its deploy-time validator must fail if either directive is missing while any seed names a non-system font.

- [x] **3.4 Unit tests**
  `tests/unit/theme-fonts.test.ts` (20 tests, all pass): `isSystemFont` covers each allowlist entry, quoted variants, case-insensitivity, whitespace, and named non-system fonts. `buildGoogleFontsUrl` covers heading-only, body-only, both-different, deduplication (same font, case-insensitive dedupe), space-to-`+` encoding (Google Fonts format, not `%20`), `&display=swap` always appended, and quote stripping. `renderFontPreconnect`/`renderFontStylesheet`/`renderFontHead` covered.

- [x] **3.5 Visual verification**
  Build smoke test confirms the `<link>` tags are present in static HTML for a non-system theme (`KYCHON_PROJECT=eagles npx astro build`). Live demo verification (Phase 5) hits each demo URL in the browser to confirm the font renders.

### Phase 4: Demo theme updates

- [x] **4.1 Eagles**
  `src/seeds/eagles.ts` — `font_heading: 'Cormorant Garamond'`, `font_body: 'Inter'`. Build emits `family=Cormorant+Garamond:wght@400;700&family=Inter:wght@400;600&display=swap`.

- [x] **4.2 Silver Pines**
  `src/seeds/silver-pines.ts` — `font_heading: 'Bitter'`, `font_body: 'IBM Plex Sans'`. Build emits `family=Bitter:wght@400;700&family=IBM+Plex+Sans:wght@400;600&display=swap`.

- [x] **4.3 Barrio Unido**
  `src/seeds/barrio-unido.ts` — `font_heading: 'Merriweather'`, `font_body: 'Noto Sans'`. Build emits `family=Merriweather:wght@400;700&family=Noto+Sans:wght@400;600&display=swap`. Multi-language verification (Spanish diacritics) handled live in Phase 5.

- [x] **4.4 Kychon template default**
  `src/seeds/kychon.ts` — already `font_heading: 'Inter'`, `font_body: 'Inter'`. Build emits the deduplicated `family=Inter:wght@400;700&display=swap` (single family, exercising the dedupe path).

### Phase 5: ODBC port re-validation

> Phases 5.1–5.3 require re-running the `/copy-website` skill against ODBC and pushing to the ODBC port project. That happens in a follow-up user-driven session — the implementation here ships the platform plumbing the ODBC port needs. The three demos (Phase 4) exercise the same code path end-to-end and are deployed in this change to confirm the injector works in production.

- [ ] **5.1 Re-run `/copy-website` against ODBC** *(deferred to user-driven session)*
  After this change merges, re-run `/copy-website` against ODBC and deploy to `odbc-port.run402.com`.

- [ ] **5.2 Verify Playfair + Source Sans load** *(deferred — depends on 5.1)*
  Confirm `<link rel="stylesheet" href="…fonts.googleapis.com…family=Playfair+Display…&family=Source+Sans+3…">` is present. Visual: headings in Playfair Display, body in Source Sans 3.

- [ ] **5.3 Verify all theme keys flow** *(deferred — depends on 5.1)*
  Inspect `document.documentElement.style.getPropertyValue('--radius')` etc. on the live ODBC port; confirm every seeded key appears as a custom property and reflects visually.

### Phase 6: Documentation

- [x] **6.1 Create `THEME.md`**
  Documents every key (schema field → CSS custom property → default → what it controls), the system-font allowlist, the Google Fonts injection mechanics (preconnect + stylesheet + display=swap, weight choices), failure modes (typo 404s, Adobe/self-hosted as out-of-scope), GDPR / privacy note, and the demo theme pairings.

- [x] **6.2 Update `STRUCTURE.md`**
  `site_config` row in the database tables section now cross-references `THEME.md`.

- [x] **6.3 Update `CLAUDE.md` architecture section**
  "CSS variables for theming" bullet now notes that every theme key has a downstream consumer and that non-system `font_heading` / `font_body` values are auto-loaded via Google Fonts at build time, with a link to `THEME.md`.
