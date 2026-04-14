## Context

Kychon has two demos — Eagles (English charity) and Barrio Unido (bilingual community center). Both prove the config-driven template works across verticals and languages, but neither exercises accessibility. The current template has zero skip-nav links, no focus management, no font scaling, no reduced-motion support, no ARIA landmarks, and hard-coded font sizes. This is a gap both for the demos and for the product.

Silver Pines Senior Center (Asheville, NC) is a fictional active-adult community center. The demo serves two purposes: (1) a compelling senior-living vertical showcase deployed to `silver-pines.kychon.com`, and (2) the forcing function to ship accessibility as a first-class Kychon feature. Every accessibility feature built here ships to the base template — Eagles, Barrio Unido, and all future portals get it for free.

## Goals / Non-Goals

**Goals:**
- Ship accessibility infrastructure that benefits ALL Kychon portals (not demo-only code)
- Deploy a live demo at `silver-pines.kychon.com` with warm, readable design and 20+ members
- Surface and document Run402 platform accessibility gaps (auth flows, error messages, upload UI)
- Prove Kychon works for the senior/aging demographic — a large and underserved market
- All new features are config-driven: toggleable via `site_config` feature flags

**Non-Goals:**
- WCAG AAA compliance for every element (target AA, achieve AAA where feasible)
- Assistive technology testing beyond screen reader + keyboard (no eye-tracking, switch access)
- Modifying Run402 platform code (document issues, file as feedback)
- Mobile-specific accessibility (responsive design exists; this focuses on a11y overlays)
- AI features in the demo (no moderation, translation, or insights — keep it focused on a11y)

## Decisions

### D1: Accessibility lives in the base template, not the demo

All a11y code goes into `site/js/accessibility.js` and `site/css/a11y.css`, loaded by every portal. The Silver Pines demo is just the first portal to configure large defaults (18px base, 1.7 line-height). Other portals keep their existing look but gain skip-nav, focus management, keyboard nav, and ARIA landmarks.

**Alternatives considered:**
- Demo-only a11y code in `demo/silver-pines/`: Wastes the effort. Accessibility shouldn't be opt-in per demo.
- Inline everything into existing CSS/JS: Harder to maintain, harder for agents to toggle.

**Rationale:** The whole point is to make Kychon accessible-by-default. Separate files make it easy to audit and for agents to understand what controls accessibility.

### D2: Font scaling via CSS custom properties + localStorage

A `--wl-font-scale` CSS custom property (default `1`) multiplies all `rem` values. Three steps: 1x, 1.25x, 1.5x. Toggle button in the nav bar (visible on all portals). Preference persisted in `localStorage('wl_font_scale')` and applied on page load before first paint to prevent flash.

**Alternatives considered:**
- Browser zoom: Users already have this. A dedicated control is more discoverable and granular.
- `px`-based scaling: Breaks responsive design. `rem`-based scaling respects the cascade.
- Continuous slider: Overengineered. Three steps cover the need.

**Rationale:** CSS custom properties are already the theming mechanism. Adding one more property is consistent. localStorage is already used for locale preference.

### D3: High-contrast mode via class toggle + CSS overrides

A `.wl-high-contrast` class on `<html>` swaps CSS custom property values to WCAG AAA ratios (7:1 for text, 4.5:1 for large text). Toggle button next to font scale. Persisted in `localStorage('wl_high_contrast')`.

**Alternatives considered:**
- `prefers-contrast` media query only: Not all OSes expose this. Manual toggle ensures coverage.
- Separate stylesheet: Extra network request. Class toggle with custom property overrides is zero-cost.

**Rationale:** Same persistence and application pattern as font scaling — consistent UX.

### D4: Reduced motion via media query + manual override

Respect `prefers-reduced-motion: reduce` by default (disable CSS transitions, animations, scroll-behavior). Also provide a manual toggle for users whose OS setting doesn't match their preference. Both controls live in an "Accessibility" dropdown in the nav (icon: universal access symbol).

**Rationale:** Media query is the right default. Manual toggle catches edge cases (shared computers, institutional settings).

### D5: Accessibility toolbar as nav dropdown

All a11y controls (font size, high contrast, reduced motion) live in a single dropdown toggled by a universal access icon (♿ or similar) in the nav bar. This keeps the nav clean while making controls discoverable. The dropdown itself is fully keyboard-navigable.

**Alternatives considered:**
- Floating widget: Overlaps content, feels bolted-on.
- Settings page only: Too hidden. Accessibility controls should be one click away.
- Individual nav buttons: Clutters the nav bar.

**Rationale:** Single entry point, zero visual clutter, keyboard-accessible. Matches the pattern of existing nav dropdowns (user menu, language switcher).

### D6: Seed data with relative dates

Like the Eagles demo, all timestamps in `seed.sql` use `NOW() - INTERVAL` expressions so the demo always looks fresh when reseeded. Events span from 2 weeks ago to 4 weeks ahead.

### D7: Content volume targets

| Content | Count | Rationale |
|---|---|---|
| Members | 20-25 | Seniors with diverse backgrounds, hobbies, volunteer roles |
| Events (upcoming) | 6 | Tai chi, watercolor, tech help, book club, Medicare workshop, movie night |
| Events (past) | 6 | Shows history — garden party, health fair, holiday potluck |
| Forum categories | 3 | Health & Wellness, Activities & Hobbies, Tech Help |
| Forum topics | 10-12 | Active but not overwhelming |
| Forum replies | 25-35 | Helpful, warm tone |
| Committees | 5 | Wellness, Social Events, Garden, Tech Buddies, Transportation |
| Announcements | 8 | Mix of practical (holiday hours, flu shots) and social |
| Resources | 10 | Transportation schedules, health guides, emergency contacts, meal program, tech tutorials |
| Custom pages | 2 | "Getting Here" (transport/directions), "Daily Schedule" (weekly class grid) |
| Membership tiers | 4 | Guest, Member, Volunteer, Board |

## Risks / Trade-offs

**[Template-wide HTML changes]** → Adding skip-nav, ARIA landmarks, and `#main-content` to all HTML files touches every page. → **Mitigation:** Changes are additive (new elements, new attributes) and mechanical. No existing behavior changes. Can be done as a single commit with a grep-verify pass.

**[A11y toolbar JS size]** → `accessibility.js` adds ~80 lines to every page load. → **Mitigation:** 80 lines is ~2KB minified. Member page budget is 15KB JS — still well under. No lazy loading needed.

**[Font scaling breaks layouts]** → At 150% scale, some layouts may overflow. → **Mitigation:** Test at 150% during implementation. The template already uses `rem` and flexbox/grid, which handle scale well. Fix any specific overflows found.

**[Run402 a11y gaps beyond our control]** → Auth flows (Google OAuth popup, password forms) and Run402-generated error messages may not be accessible. → **Mitigation:** Document and file as issues on MajorTal/run402. Don't block the demo on platform fixes.

**[AI image quality for portraits]** → Generating realistic senior portraits that are warm and respectful, not stereotypical. → **Mitigation:** Careful prompting: diverse ages (60-85), diverse ethnicities, real activities, natural lighting. Review before deploying.
