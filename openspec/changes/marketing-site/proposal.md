## Why

The existing marketing site (site/marketing/index.html) has strong copy and pricing but no visual showcase of what Kychon actually looks like in production. We now have three beautiful, live demo sites — Barrio Unido (multilingual), Silver Pines (accessibility), and Eagles (AI + engagement) — that prove the platform works across radically different communities. The marketing site needs to become a visual-first, demo-driven experience that lets prospects *see* their community running on Kychon before they commit. It also needs hero imagery, populated links throughout, mobile-responsive polish, and messaging around being coding-agent-friendly and 100% open source.

## What Changes

- **Hero section overhaul** — generated hero images showing mashups of different community types (not just screenshots of one demo), conveying diversity and warmth
- **Live demo showcase section** — three featured demo cards with screenshots, each highlighting a different capability pillar:
  - **Barrio Unido** (barrio.kychon.com) — multilingual UI, AI auto-translation, moderated forums
  - **Silver Pines** (silver-pines.kychon.com) — accessibility features (font scaling, high contrast, skip nav, reduced motion)
  - **Eagles** (eagles.kychon.com) — member directory personalization, reactions, activity feed, AI features
- **"Agent-friendly & open source" section** — messaging that Kychon is 100% open source, designed for coding agents (Claude Code, Cursor, etc.), and customizable/deployable in minutes via config-driven architecture
- **All links populated** — every CTA, nav link, niche card, and footer link points to a real destination (demo sites, GitHub, pricing anchors)
- **Hero images generated** — AI-generated hero/feature images showing community mashups (diverse groups, events, forums, directories)
- **Mobile-responsive verification** — all new sections tested via Chrome MCP at mobile viewport widths
- **Niche pages updated** — existing niche pages (churches, associations, sports, HOA) linked and any new niches get populated pages

## Capabilities

### New Capabilities
- `marketing-demo-showcase`: Interactive demo site showcase section with screenshots, feature callouts per demo, and live links to barrio.kychon.com, silver-pines.kychon.com, eagles.kychon.com
- `marketing-hero-images`: AI-generated hero and feature images for the marketing site — community mashup imagery showing diverse groups, events, and portal UI elements
- `marketing-agent-oss`: "Agent-friendly & open source" section — messaging around coding agent compatibility, open source model, and minutes-to-deploy value prop

### Modified Capabilities
- (none — existing marketing specs from archived changes are superseded by this full overhaul)

## Impact

- **Files**: `site/marketing/index.html`, `site/marketing/css/marketing.css`, `site/marketing/js/marketing.js`, new image assets in `site/marketing/assets/`
- **Niche pages**: `site/marketing/churches.html`, `associations.html`, `sports.html`, `hoa.html` — links and content verification
- **Dependencies**: Three demo sites must be deployed and accessible at their subdomains
- **Deployment**: Marketing site deploys separately via `site/marketing/deploy-marketing.js`
- **No schema/backend changes** — this is purely frontend marketing content
