## Why

The marketing site at kychon.com launched but leads with competitor bashing instead of product proof. The hero name-drops Wild Apricot, the second section attacks three competitors by name, "Coming Soon" placeholders make the showcase feel unfinished, and the page is a long sequence of card grids without showing the actual product. An external review confirmed: lead with proof, not a fight.

The live Eagles demo at eagles.run402.com is the strongest asset and should be front-and-center. The page needs to show the product, remove unfinished elements, add missing conversion elements (FAQ, "how it works"), and shift the brand toward a more ownable lychee-rose color.

## What Changes

- **Hero rewrite**: Remove competitor name. New headline: "Own your member portal." Add a browser mockup screenshot of the Eagles demo in the hero. Link primary CTA directly to the live demo (not `#demo-placeholder`).
- **Remove "Problem" section**: Replace with "Why organizations choose Kychon" — three benefit cards (predictable cost, ownership, customization). Add a subtle link to `/compare.html` for people searching for alternatives.
- **Showcase overhaul**: Remove "Coming Soon" placeholders. Replace with 4-6 deep-link tiles into Eagles subpages (home, directory, events, forum, profile, announcements). Each tile shows a real screenshot captured via `capture-screenshots.sh`.
- **Add "How it works" section**: Three steps — pick a template, AI builds your portal, launch on your domain.
- **Add FAQ section**: Answer "Is it really $5/mo?", "Do I need technical skills?", "Who owns the data?", "Can I migrate from Wild Apricot?", "What does AI-powered mean?", plus "Why it's so affordable."
- **Niche cards cleanup**: Remove 4 "Coming Soon" disabled cards. Show only the 4 real niches.
- **Brand color shift**: Introduce lychee-rose accent (`#f15b86`) alongside indigo. Update hero highlight, buttons, and accent elements.
- **Create `/compare.html`**: Comparison page with competitor pricing table and feature grid, moved from the homepage. Link from homepage footer and FAQ.
- **Screenshot-led layout**: Replace some card grids with alternating screenshot + benefit sections to reduce "card soup."
- **Capture Eagles subpage screenshots**: Extend `capture-screenshots.sh` to capture directory, events, forum, and profile pages.
- **Redeploy** marketing site after changes.

## Capabilities

### New Capabilities
- `marketing-compare-page`: Competitor comparison page at `/compare.html` with pricing table and feature grid
- `marketing-faq`: FAQ section answering common objections and building trust
- `marketing-how-it-works`: Three-step "how it works" section explaining the path from template to live portal

### Modified Capabilities
- `marketing-landing`: Hero rewrite, remove problem section, showcase overhaul, niche cleanup, brand color shift, screenshot-led layout

## Impact

- **Modified files**: `marketing/index.html`, `marketing/css/marketing.css`
- **New files**: `marketing/compare.html`
- **Extended script**: `marketing/capture-screenshots.sh` (new URLs for Eagles subpages)
- **New assets**: 4-6 additional screenshots (Eagles directory, events, forum, profile)
- **No backend impact** — all changes are static marketing files
- **Redeploy** required via `deploy-marketing.js`
