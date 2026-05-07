## 1. Hero Images & Assets

- [x] 1.1 Create `site/marketing/assets/hero/` directory
- [x] 1.2 Generate hero image — pivoted to CSS screenshot mashup (3 overlapping demo screenshots in hero) since no image generation API is available
- [x] 1.3 Generate 2-3 supporting feature images for demo showcase cards or section backgrounds
- [x] 1.4 Capture screenshots of barrio.kychon.com, silver-pines.kychon.com, and eagles.kychon.com via Chrome MCP for demo cards
- [x] 1.5 Optimize all images (WebP preferred, under 300KB each, explicit width/height attributes)

## 2. Demo Showcase Section

- [x] 2.1 Add "See it in action" section to `index.html` after the AI Features section — section header with title and subtitle
- [x] 2.2 Create three demo cards: Barrio Unido, Silver Pines, Eagles — each with screenshot in browser frame, community name, description, feature pills, and "Visit Demo" button
- [x] 2.3 Add CSS for `.m-demos-grid`, `.m-demo-card`, `.m-demo-screenshot`, `.m-demo-pills` — 3-column grid on desktop, stacked on mobile
- [x] 2.4 Style feature pills as small colored badges with consistent sizing
- [x] 2.5 Wire "Visit Demo" buttons to live URLs with `target="_blank"` and `rel="noopener"`

## 3. Agent-Friendly & Open Source Section

- [x] 3.1 Add dedicated section to `index.html` between demo showcase and pricing — title, subtitle, and 3-column icon/text grid
- [x] 3.2 Create content for three pillars: "100% Open Source" (full code ownership), "Agent Friendly" (Claude Code, Cursor compatible), "Deploy in Minutes" (config-driven, SQL + file editing)
- [x] 3.3 Add CSS for `.m-oss-section` and `.m-oss-grid` with icon/visual elements
- [x] 3.4 Include "Fork on GitHub" CTA button (using `#fork` anchor pre-launch)

## 4. Navigation & Links

- [x] 4.1 Update nav links to include "Demos" pointing to `#demos` section
- [x] 4.2 Audit all `href` attributes — replace any dead links with real destinations or explicit anchors
- [x] 4.3 Ensure niche grid cards link to their respective pages (churches.html, associations.html, sports.html, hoa.html) and remaining cards link to `#build`
- [x] 4.4 Update hero CTA "See Demo" to scroll to `#demos` section

## 5. Hero Section Update

- [x] 5.1 Add the generated hero image to the hero section with responsive sizing
- [x] 5.2 Add `loading="lazy"` to below-fold images, but eager-load the hero image
- [x] 5.3 Add explicit width/height or aspect-ratio CSS to prevent layout shift

## 6. CSS & Responsive Polish

- [x] 6.1 Add all new section styles to `marketing.css` following `m-` prefix convention
- [x] 6.2 Add responsive breakpoints for new sections — test at 375px, 768px, 1024px, 1440px
- [x] 6.3 Ensure demo card screenshots resize proportionally without overflow
- [x] 6.4 Style browser-frame mockups for demo screenshots (border-radius, shadow, toolbar dots)

## 7. Mobile Verification via Chrome MCP

- [x] 7.1 Open marketing site in Chrome MCP at 375px viewport — verify all sections render correctly
- [x] 7.2 Check demo cards stack vertically and screenshots fill width on mobile
- [x] 7.3 Verify nav hamburger menu includes new "Demos" link
- [x] 7.4 Verify no horizontal overflow or broken layouts at any tested breakpoint
- [x] 7.5 Check all links and CTAs are tappable on mobile (minimum 44px touch targets)
