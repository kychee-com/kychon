## Context

Kychon is a community portal template on Run402. The product story has three layers:

```
A. kychon.com             → "What is this?" (marketing)
B. [Run402 demo mode]         → "Let me try it" (sandbox, auto-provisioned)
C. eagles.kychon.com etc. → "Show me a real one" (curated showcases)
```

The marketing site (A) is the front door that links to B and C. Run402 demo mode handles B automatically when we publish the app. Eagles (C) already exists. This design covers only A.

The existing marketing-site spec from Phase 3 defines the content sections (hero, problem, pricing, AI features, niche cards). This design covers how to build and deploy it.

## Goals / Non-Goals

**Goals:**
- A fast, polished single-page marketing site at kychon.com
- Showcase gallery linking to live community demos (Eagles, future niches)
- "Try It" CTA linking to the Run402 demo mode sandbox
- Niche landing pages (/churches, /hoa, /sports, /associations)
- Deployed as a separate Run402 project to avoid subdomain conflicts
- Mobile-responsive, no build step, matches Kychon design conventions

**Non-Goals:**
- Blog or CMS (static content is fine for launch)
- User accounts or auth on the marketing site
- Waitlist/signup form (CTA goes to Run402 demo or GitHub)
- Building the showcase sites (Eagles exists; others are separate changes)
- Implementing Run402 demo mode (already implemented)
- Custom domain SSL setup (Run402 handles this)

## Decisions

### D1: Pure static site, no database

The marketing site has no dynamic content. No site_config table, no sections from DB. Just static HTML/CSS files deployed to Run402's static hosting. This avoids the project-sharing mess and keeps the marketing site independent.

**Alternatives considered:**
- Config-driven via the portal template's section renderer: Clever but overfit. Marketing pages have different layouts (pricing tables, comparison grids, testimonials) that don't map to the portal's section types.
- Next.js/Astro: Adds a build step, contradicts Kychon's no-build-step philosophy.

**Rationale:** Static HTML is the simplest thing that works. One HTML file per page, one CSS file, deploy with `run402 sites deploy`.

### D2: Separate Run402 project for the marketing site

Provision a new project via `run402 projects provision`. Deploy static files only (no schema, no seed, no functions). Claim `kychon` subdomain on this project. Point Route53 kychon.com to it.

**Alternatives considered:**
- GitHub Pages: Free, but doesn't dogfood Run402.
- Same project as Eagles: Causes subdomain collisions (the bug we just hit).

**Rationale:** Dogfoods Run402 for static hosting. Clean separation from portal projects.

### D3: Showcase gallery with screenshots + live links

The marketing site shows a gallery of 2-4 showcase communities. Each card has a screenshot (static image), community name, niche label, and a "Browse →" link to the live site. Screenshots are generated during build (or captured manually) and stored as static assets.

**Alternatives considered:**
- Live iframes: Cool but slow, CORS issues, and the showcase sites could be down.
- Video walkthroughs: High production effort for launch.

**Rationale:** Static screenshots load instantly and work even if showcase sites are temporarily down. Links let curious visitors click through to the real thing.

### D4: File structure under marketing/

```
marketing/
├── index.html          # Main landing page (all sections)
├── churches.html       # Niche: churches
├── hoa.html            # Niche: HOA
├── sports.html         # Niche: sports leagues
├── associations.html   # Niche: professional associations
├── css/
│   └── marketing.css   # All marketing styles
├── assets/
│   ├── logo.svg
│   ├── hero-illustration.svg
│   ├── screenshot-eagles.jpg
│   ├── screenshot-yoga.jpg    # (when available)
│   └── ...
└── deploy-marketing.js # Deploy script for marketing project
```

Separate from `site/` (the portal template). The marketing site is not a Kychon portal — it's a product page.

### D5: Design language

Shares Kychon's design tokens (Inter font, indigo primary, rounded corners) but with its own layout conventions for marketing: full-width sections, alternating backgrounds, larger typography, more whitespace. The CSS is standalone — no dependency on `site/css/styles.css`.

### D6: Domain routing via Run402 domains CLI

```
run402 domains add kychon.com kychon
  → Route53: CNAME to domains.run402.com (or ALIAS + TXT for apex)
  → run402 domains status kychon.com  (poll until active)

run402 domains add eagles.kychon.com eagles
  → Route53: CNAME to domains.run402.com
```

Run402 handles TLS and routing. No manual CloudFront or certificate setup needed. When the linked subdomain is redeployed, the custom domain automatically serves the new deployment.

## Risks / Trade-offs

**[Screenshot staleness]** → Showcase screenshots will drift from the live sites as features are added. **Mitigation:** Regenerate screenshots as part of showcase site deploys. Or use a Chrome MCP script to auto-capture.

**[Demo mode not published yet]** → The "Try It" CTA needs Kychon to be published on the Run402 marketplace for demo mode to activate. **Mitigation:** Publish the app before or alongside the marketing site launch. If demo mode isn't ready, the CTA can link to Eagles (a live showcase) as an interim.

**[Niche pages without showcase sites]** → The /churches, /hoa, /sports pages will link to showcase communities that don't exist yet. **Mitigation:** Launch niche pages with "Coming soon" for the showcase link, or only launch niche pages when the corresponding showcase site is ready.

**[Run402 static site limits]** → Static hosting on Run402 is simple but lacks advanced features (redirects, headers, edge functions). **Mitigation:** A marketing site doesn't need these. If SEO requirements grow (sitemap, meta tags), they can be handled with static files.
