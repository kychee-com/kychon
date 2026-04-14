## Why

Kychon has a working portal template, a live showcase (Eagles), activity feeds, reactions, and all Phase 1-2 features — but no front door. There's nowhere for a visitor to understand what Kychon is, see it in action, or start using it. The `kychon.com` subdomain currently serves the portal template itself (on the wrong project), not a marketing site.

We need a standalone marketing site at `kychon.com` that sells Kychon across three conversion paths: browse showcase communities (read-only, curated), try the interactive demo (Run402 demo mode, auto-provisioned on publish), or fork/buy.

## What Changes

- **Static marketing site** deployed to its own Run402 project at `kychon.com`. Single-page with scroll sections: hero, "The Problem" (competitor pricing), feature grid, AI showcase, live showcase gallery (linking to Eagles and future niche sites), pricing table, "Who It's For" niche cards, and final CTA.
- **Showcase gallery section** that embeds screenshots or live iframes of showcase communities (Eagles, future yoga/bookclub/HOA sites) with links to browse them. These are the C sites — curated, dense, read-only browsing.
- **"Try It" CTA** linking to the Run402 demo mode instance. Demo mode is already implemented on Run402 — publishing Kychon as an app auto-creates a rate-limited, self-resetting sandbox. No custom work needed for the sandbox itself.
- **Domain setup**: `kychon.com` (Route53) → marketing site. Showcase sites stay on `eagles.kychon.com` etc. (or move to `eagles.kychon.com` subdomains later).
- **Niche landing pages** at `/churches`, `/hoa`, `/sports`, `/associations` with niche-specific messaging and links to the corresponding showcase site (when available).
- **Separate Run402 project** for the marketing site — not shared with Eagles or the portal template. Avoids the subdomain collision issues.

## Capabilities

### New Capabilities
- `marketing-landing`: Main landing page with hero, problem section, features, AI showcase, showcase gallery, pricing, niche cards, and CTAs
- `marketing-niche-pages`: Niche-specific landing pages (churches, HOA, sports, associations) with tailored messaging and showcase links
- `marketing-deploy`: Deployment to a dedicated Run402 project with kychon.com domain via Route53

### Modified Capabilities
- `marketing-site`: Existing spec covers content sections. This change implements it with the A/B/C architecture (marketing + demo mode + showcases) and adds the showcase gallery linking to live community sites.

## Impact

- **New project**: A separate Run402 project provisioned for the marketing site
- **New files**: `marketing/index.html`, `marketing/css/`, niche page HTMLs — all static, no JS framework, no build step (consistent with Kychon conventions)
- **Domain**: Route53 `kychon.com` pointed to the marketing site's Run402 subdomain (or CloudFront)
- **Dependencies**: Eagles showcase site must be deployed and stable. Run402 demo mode must be live (it is — 8/9 components implemented).
- **No impact** on the portal template code (`site/`) — the marketing site is a separate set of files
