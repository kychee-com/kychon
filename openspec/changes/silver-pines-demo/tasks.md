## 1. Accessibility Infrastructure (Base Template)

- [x] 1.1 Create `site/css/a11y.css` with skip-nav styles, focus-visible rings, high-contrast class overrides, reduced-motion rules, and font-scale custom property
- [x] 1.2 Create `site/js/accessibility.js` with: load preferences from localStorage before first paint, font-scale toggle (1x/1.25x/1.5x), high-contrast toggle, reduced-motion toggle, accessibility toolbar dropdown logic, keyboard nav for toolbar (arrow keys, Escape)
- [x] 1.3 Add skip-nav link (`<a href="#main-content" class="wl-skip-nav">Skip to main content</a>`) as first child of `<body>` in all `site/*.html` files
- [x] 1.4 Add `id="main-content"` to the main content landmark in all `site/*.html` files
- [x] 1.5 Add ARIA landmark roles and `aria-label` attributes to all page regions (header, nav, main, footer) in all `site/*.html` files
- [x] 1.6 Add accessibility toolbar button (universal access icon) to the nav bar template and its dropdown markup
- [x] 1.7 Add `aria-live="polite"` region to the page template for dynamic announcements (toasts, form results)
- [x] 1.8 Update `site/js/config.js` to load `a11y.css` and `accessibility.js`, and apply saved preferences before first paint

## 2. Focus Management & Keyboard Navigation

- [x] 2.1 Add focus trap utility to `accessibility.js` for modal dialogs (trap Tab/Shift+Tab within modal, Escape to close)
- [x] 2.2 Add focus restoration logic — store trigger element ref on modal open, restore on close
- [x] 2.3 Add arrow-key navigation to all dropdown menus (nav dropdowns, accessibility toolbar, user menu)
- [x] 2.4 Ensure all existing interactive elements have visible `:focus-visible` styles in `a11y.css`
- [x] 2.5 Wire toast notifications and form submission results to the `aria-live` announcement region

## 3. Silver Pines Seed Data

- [x] 3.1 Create `demo/silver-pines/` directory structure
- [x] 3.2 Write `demo/silver-pines/brand.json` with sage/cream/amber theme, Merriweather + Source Sans 3 fonts, 18px base font, 1.7 line-height
- [x] 3.3 Write site_config section of `demo/silver-pines/seed.sql` — theme, nav items, feature flags, accessibility defaults (font-scale enabled, high-contrast available)
- [x] 3.4 Write member seed data — 20-25 seniors with diverse backgrounds, Asheville-area names, hobbies, volunteer roles, profile photo URLs (placeholder until image gen)
- [x] 3.5 Write event seed data — 6 upcoming + 6 past events with `NOW() +/- INTERVAL` relative dates, descriptions, locations within the center
- [x] 3.6 Write resource seed data — 10+ resources across transportation, health, meals, and technology categories
- [x] 3.7 Write committee seed data — 5 committees (Wellness, Social Events, Garden, Tech Buddies, Transportation) with member assignments and chairs
- [x] 3.8 Write forum seed data — 3 categories, 10-12 topics, 25-35 replies with warm supportive tone
- [x] 3.9 Write announcement seed data — 8 announcements mixing practical and social, 1-2 pinned
- [x] 3.10 Write custom page seed data — "Getting Here" (directions, parking, shuttle, accessibility info) and "Daily Schedule" (weekly class grid)
- [x] 3.11 Write membership tier seed data — Guest, Member, Volunteer, Board with descriptions and permissions
- [x] 3.12 Write homepage section seed data — hero, stats (members, events, years serving), features grid, testimonials, activity feed, CTA

## 4. Image Generation

- [x] 4.1 Write `demo/silver-pines/generate-images.sh` — OpenAI image API calls for hero, portraits, activity photos with idempotent upload to Run402 storage
- [x] 4.2 Define image prompts: 1 hero (community center + Blue Ridge Mountains), 20-25 senior portraits (diverse, active, warm), 6-8 activity photos (tai chi, watercolor, garden, book club, tech help, potluck)
- [ ] 4.3 Run image generation script and collect storage URLs
- [ ] 4.4 Update seed.sql member and event rows with actual Run402 storage URLs

## 5. Deployment & Verification

- [ ] 5.1 Provision `silver-pines` Run402 project with separate database and subdomain
- [ ] 5.2 Deploy schema + seed + static files to `silver-pines.run402.com`
- [ ] 5.3 Verify accessibility: keyboard-only navigation through all pages, skip-nav works, font scaling works, high-contrast mode works, reduced-motion works
- [ ] 5.4 Verify screen reader: test with VoiceOver on macOS — landmarks announced, dynamic content announced, all controls labeled
- [ ] 5.5 Run Lighthouse accessibility audit — target 95+ score
- [ ] 5.6 Verify seed data: all members, events, resources, committees, forums, announcements render correctly
- [ ] 5.7 Test at 150% font scale — verify no layout overflow or truncation

## 6. Run402 Platform Accessibility Feedback

- [ ] 6.1 Document accessibility issues found in Run402 auth flows (Google OAuth popup, password forms)
- [ ] 6.2 Document accessibility issues in Run402 error messages and admin UI
- [ ] 6.3 File issues on MajorTal/run402 for each accessibility gap found
