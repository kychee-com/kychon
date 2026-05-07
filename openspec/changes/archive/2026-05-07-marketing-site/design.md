## Context

The marketing site at `site/marketing/` has a solid foundation — pricing tables, competitor comparison, AI feature cards, niche grid, and responsive nav. However, it lacks visual proof. Three production demo sites are now live:

- **barrio.kychon.com** — Barrio Unido (bilingual Latino community center, ES/EN)
- **silver-pines.kychon.com** — Silver Pines Senior Center (accessibility-first, 55+)
- **eagles.kychon.com** — Eagles Volunteer Org (full AI features, reactions, member directory)

The marketing site needs to evolve from "feature list with copy" to "visual showcase with live proof." All sections, links, images, and CTAs must be populated and functional.

## Goals / Non-Goals

**Goals:**
- Add a visually rich demo showcase section with screenshots/previews of all three demo sites
- Generate hero images (community mashups — diverse groups, events, activities)
- Add "Agent-friendly & open source" section with clear value prop
- Ensure every link on the page goes somewhere real (demo URLs, GitHub, anchor sections)
- Mobile-responsive across all new sections (verified via Chrome MCP)
- Keep the existing pricing, comparison, and AI features sections intact

**Non-Goals:**
- No backend changes or new deploy infrastructure
- No interactive demo embedding (iframe, etc.) — just screenshots + links
- No Kychon Studio integration (that's Phase 3)
- No new niche pages beyond the four existing ones (churches, associations, sports, HOA)
- No video content or animation-heavy features

## Decisions

### 1. Demo showcase layout: Cards with screenshots + feature pills

Each demo gets a large card with a screenshot, 3-4 feature pills (e.g., "Multilingual", "AI Translation"), a short description, and a "Visit Demo" link. Three cards in a row on desktop, stacked on mobile.

**Why**: Screenshots are the most convincing proof. Feature pills create scannable differentiators. Cards scale naturally to mobile via CSS grid.

**Alternative considered**: Tabbed interface with one demo visible at a time — rejected because it hides 2/3 of the content and adds JS complexity.

### 2. Hero images: AI-generated via image generation tool, stored as static assets

Generate 2-3 hero images showing community mashups — diverse groups gathering, events happening, portal UI elements overlaid. Store in `site/marketing/assets/hero/`.

**Why**: Real screenshots of demo sites are too specific to one community. Mashup illustrations convey "this works for everyone" better. Static assets avoid external image hosting dependencies.

**Alternative considered**: Using actual demo site screenshots as hero — rejected because no single demo represents the breadth. Composite/mashup imagery tells the right story.

### 3. "Agent-friendly & open source" as a standalone section

Dedicated section between the demo showcase and pricing, with:
- "100% open source" badge/messaging
- "Coding agent friendly" — works with Claude Code, Cursor, etc.
- "Customized and deployed in minutes" — config-driven architecture pitch
- Link to GitHub repo

**Why**: This is a unique differentiator vs. Wild Apricot, Circle, Bettermode. Developers and tech-forward community managers are an important early adopter segment. Deserves its own section rather than being buried in feature cards.

### 4. Image approach: CSS-styled screenshot frames with generated hero art

Demo screenshots will be captured via Chrome MCP and placed in styled browser-frame mockups using CSS (border-radius, shadow, toolbar dots). Hero images are generated illustrations.

**Why**: Browser frames add credibility ("this is a real site"). CSS frames avoid image editing tools. Generated hero art fills the visual gap without requiring stock photos.

### 5. Keep existing CSS architecture, extend with new section classes

All new sections follow the existing `m-` prefix convention. New classes: `m-demos-grid`, `m-demo-card`, `m-demo-pills`, `m-oss-section`, `m-hero-img`. No new CSS files.

**Why**: Single CSS file is simple and the existing convention is clean. No build step means no CSS modules or preprocessors.

## Risks / Trade-offs

- **Demo sites might be down** → Each demo card includes a static screenshot fallback. Links open in new tabs so a dead demo doesn't lose the visitor.
- **Generated hero images may look generic** → Use specific community imagery (not abstract shapes) and ensure diversity of communities represented. Review in Chrome MCP before finalizing.
- **Mobile layout of 3-card demo grid** → Cards stack vertically on mobile. Screenshots resize to full-width. Tested at 375px and 768px breakpoints.
- **Link rot for GitHub/fork links** → Use `#fork` anchor for now (pre-launch). Replace with real GitHub URL when repo is public.
- **Page weight increases with images** → Compress screenshots to WebP, lazy-load below-fold images with `loading="lazy"`. Hero image should be under 200KB.
