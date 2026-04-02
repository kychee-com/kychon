## 1. Project Setup

- [x] 1.1 Create `marketing/` directory with file structure: `index.html`, `css/marketing.css`, `assets/`, niche page HTMLs, `deploy-marketing.js`
- [x] 1.2 Provision a dedicated Run402 project for the marketing site via `run402 projects provision` (REDACTED_PROJECT_ID)
- [x] 1.3 Write `deploy-marketing.js` script that collects files from `marketing/` and deploys via Run402 CLI

## 2. Design System & CSS

- [x] 2.1 Create `marketing/css/marketing.css` with design tokens (Inter font, indigo primary, spacing scale) and layout primitives (full-width sections, alternating backgrounds, container, grid)
- [x] 2.2 Add component styles: hero, feature cards, pricing table, comparison grid, showcase cards, niche cards, CTA sections, nav bar, footer
- [x] 2.3 Add responsive breakpoints: mobile (<768px), tablet (768-1199px), desktop (1200px+)

## 3. Landing Page

- [x] 3.1 Build hero section: headline, subheading, three CTAs (Try Demo, Browse Showcase, Fork on GitHub)
- [x] 3.2 Build "The Problem" section: three competitor pain-point cards + comparison grid (Kychon vs incumbents)
- [x] 3.3 Build feature grid: 8+ feature cards with icons, names, descriptions
- [x] 3.4 Build AI features showcase: 6 AI capability cards with BYOK note
- [x] 3.5 Build showcase gallery: Eagles card with screenshot and "Browse →" link, placeholder slots for future showcases
- [x] 3.6 Build pricing section: competitor comparison table (by member count) + Kychon plans (Template / Studio / Pro)
- [x] 3.7 Build "Who It's For" niche cards: churches, associations, sports leagues, HOAs, nonprofits, coworking, alumni — each linking to niche page
- [x] 3.8 Build final CTA section and footer

## 4. Niche Landing Pages

- [x] 4.1 Create shared niche page template/structure (hero, features, showcase link, pricing, CTA)
- [x] 4.2 Build `/churches.html` with church-specific messaging and features
- [x] 4.3 Build `/hoa.html` with HOA-specific messaging and features
- [x] 4.4 Build `/sports.html` with sports-league-specific messaging and features
- [x] 4.5 Build `/associations.html` with association-specific messaging and features

## 5. Assets

- [x] 5.1 Create or source logo SVG for the marketing site header (using lychee emoji + text brand — no SVG file needed)
- [x] 5.2 Capture Eagles showcase screenshot for the gallery card
- [x] 5.3 Create hero illustration or visual (using CSS gradient blob — no external asset needed)
- [x] 5.4 Source or create icons for feature cards and niche cards (using emoji — no external assets needed)

## 6. Deploy & Domain

- [x] 6.1 Deploy marketing site to the dedicated Run402 project and claim `kychon` subdomain
- [x] 6.2 Run `run402 domains add kychon.com kychon` then configure Route53 DNS (CNAME to `domains.run402.com` or ALIAS + TXT for apex)
- [x] 6.3 Verified `kychon.com` serves marketing site (HTTP 200, correct title)
- [ ] 6.4 Publish Kychon portal as a Run402 app to activate demo mode (so "Try Demo" CTA works)

## 7. Testing & Verification

- [x] 7.1 Visual verification via Chrome MCP: desktop and mobile viewports, all sections render
- [x] 7.2 Verify all links work: demo CTA, GitHub link, showcase links, niche page links
- [x] 7.3 Verify responsive behavior: mobile nav, stacked cards, scrollable pricing table
