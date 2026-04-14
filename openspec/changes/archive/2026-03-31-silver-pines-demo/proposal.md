## Why

Kychon's demos prove it works for charities (Eagles) and bilingual community centers (Barrio Unido), but neither stress-tests **accessibility** — the single biggest gap preventing adoption by senior centers, disability orgs, churches with aging congregations, and any community that takes inclusion seriously. Senior living is a $500B+ market with 55M Americans over 65, growing fast, and these communities desperately need simple, accessible portals.

Silver Pines Senior Center (Asheville, NC) is a fictional active-adult community center that forces Kychon to ship real accessibility infrastructure: skip-nav, focus management, font scaling, reduced-motion support, WCAG AA contrast, keyboard-navigable everything, and screen-reader-friendly dynamic content. These aren't demo-only features — they become permanent Kychon capabilities that benefit every future portal. This demo also surfaces accessibility gaps in Run402 itself (auth flows, PostgREST error messages, file upload UI) that become platform feedback.

## What Changes

### New Kychon features (permanent, all portals benefit)

- **Skip navigation link**: Hidden-until-focused link at top of every page, jumps to `#main-content`
- **Font size controls**: Persistent user preference (localStorage) with 3 steps (100%/125%/150%), toggle in nav bar
- **High-contrast mode**: Toggle that swaps CSS custom properties to WCAG AAA contrast ratios, persisted per user
- **Reduced-motion support**: Respect `prefers-reduced-motion` media query, disable all CSS transitions/animations, provide manual toggle
- **Focus management**: Visible focus rings on all interactive elements, focus trap for modals, focus restoration after modal close
- **ARIA landmarks**: Add `role` and `aria-label` to all page regions (nav, main, complementary, contentinfo), `aria-live` regions for dynamic content (toasts, activity feed)
- **Keyboard navigation**: All interactive elements reachable via Tab, dropdown menus navigable with arrow keys, Escape closes overlays
- **Screen reader announcements**: `aria-live="polite"` region for page transitions, form submissions, toast notifications

### Demo-specific (Silver Pines only)

- **Seed data**: 20+ members (seniors with diverse backgrounds, hobbies, and volunteer roles), 12+ events (tai chi, watercolor, tech help desk, book club, movie night, garden club, Medicare workshop), 8+ announcements, 10+ resources (transportation schedules, health guides, emergency contacts, meal program info), 5 committees (Wellness, Social, Garden, Tech Buddies, Transportation)
- **AI-generated images**: Warm, inviting photos of seniors in activities — painting, gardening, exercising, socializing. Hero image of a welcoming community center with mountain backdrop (Asheville setting)
- **Theme**: Warm cream/sage/amber palette, large base font (18px), generous line-height (1.7), Merriweather headings + Source Sans 3 body, rounded corners, soft shadows
- **Custom pages**: "Getting Here" (transportation/directions), "Daily Schedule" (weekly class grid)

### Run402 platform accessibility feedback

- Document accessibility issues found in Run402's auth UI, error messages, file upload flow, and admin dashboard during build — filed as issues on MajorTal/run402

## Capabilities

### New Capabilities

- `accessibility`: Core accessibility infrastructure for all Kychon portals — skip-nav, font scaling, high-contrast mode, reduced-motion, focus management, ARIA landmarks, keyboard nav, screen reader announcements. CSS + JS utilities added to the base template.
- `silver-pines-seed`: Full senior center seed SQL — 20+ members, 12+ events, 8+ announcements, 10+ resources, 5 committees, 3 forum categories (Health & Wellness, Activities, Tech Help), homepage sections, membership tiers (Guest, Member, Volunteer, Board)
- `silver-pines-images`: AI image generation script for ~30 assets — welcoming hero with Blue Ridge Mountains backdrop, 20+ warm senior portraits, activity photos (tai chi, painting, gardening, book club, tech help)

### Modified Capabilities

_(none — accessibility features are additive CSS/JS, seed data is a new deployment)_

## Impact

- **New files**: `site/js/accessibility.js` (~80 lines), `site/css/a11y.css` (~60 lines), `demo/silver-pines/seed.sql`, `demo/silver-pines/generate-images.sh`, `demo/silver-pines/brand.json`
- **Modified files**: All `site/*.html` files get skip-nav link, ARIA landmarks, `#main-content` id. `site/js/config.js` loads a11y preferences. `site/css/styles.css` adds focus-visible and reduced-motion rules.
- **Run402**: New project deployed to `silver-pines.kychon.com` with its own database
- **Dependencies**: OpenAI API (image generation), Run402 CLI, Run402 storage API
- **Platform feedback**: Accessibility issues filed on MajorTal/run402

## Theme

```
  primary:       #5B7F5E (sage green)
  primary_hover: #4A6B4D (deeper sage)
  accent:        #C4913E (warm amber)
  bg:            #FFFDF7 (warm cream)
  surface:       #F5F0E8 (soft linen)
  text:          #2C2C2C (near-black, high contrast)
  text_muted:    #5A5A5A (dark gray, still AA compliant)
  border:        #D5CFC4 (warm stone)
  font_heading:  Merriweather
  font_body:     Source Sans 3
  font_size:     18px (base, scalable to 150%)
  line_height:   1.7
  radius:        0.75rem
  max_width:     68rem
```
