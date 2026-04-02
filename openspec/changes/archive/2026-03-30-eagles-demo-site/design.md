## Context

Kychon is deployed at `kychon.com` with a generic default seed. The marketing site shows pricing and features but there's no live demo with real-feeling content. We need a fully populated demo instance — "The Eagles: Good Samaritans of Wichita" — deployed as a separate Run402 project at `eagles.kychon.com`.

The Eagles are a fictional charitable community org in Wichita, KS. They run volunteer events (food drives, habitat builds, park cleanups), have committees (fundraising, outreach, youth), an active forum, a resource library (volunteer handbooks, tax receipts, training videos), and ~25 members with diverse profiles. Everything — text, images, member photos, logo — is AI-generated.

## Goals / Non-Goals

**Goals:**
- A live demo at `eagles.kychon.com` that shows every Kychon feature with realistic content
- AI-generated images (logo, member avatars, event photos, hero image) uploaded to Run402 storage
- Enough content density that the site feels lived-in: 25+ members, 10+ events (past and future), active forum threads, committee membership, announcements with history
- Document every Run402 friction point encountered during the build
- Reusable deploy script (`demo/eagles/deploy-eagles.js`) that can redeploy the demo from scratch

**Non-Goals:**
- Modifying the Kychon template code (this is a deployment, not a feature)
- Real user signups or authentication testing
- Production-quality AI images (placeholder quality is fine, recognizably AI-generated is OK)
- i18n / multi-language for the demo (English only)

## Decisions

### D1: Separate Run402 project, not a seed variant

The demo gets its own `run402 projects provision` project ID, separate database, separate subdomain. Not a niche seed variant (those are starting points for real users; this is a showroom).

**Alternatives considered:**
- Reuse the existing kychon project with a different seed: Risky — overwrites the marketing site's data.
- Niche seed variant: Doesn't include content (members, events, forum posts) — only config.

**Rationale:** Clean separation. The demo can be torn down and rebuilt without affecting the template project.

### D2: AI image generation via StableStudio (AgentCash)

Use the `stablestudio.dev` API via AgentCash/Tempo for image generation. Generate: 1 logo, 1 hero image, ~6 event photos, ~25 member avatars. Upload each to Run402 storage and reference URLs in seed data.

**Alternatives considered:**
- Placeholder.com or UI Faces: Not AI-generated, doesn't demo the "AI-powered" story.
- DALL-E direct: Requires separate API key setup. AgentCash is already available.

**Rationale:** Dogfoods the AgentCash/paid API ecosystem. Generated images are unique and on-brand.

### D3: Single comprehensive seed SQL file

All content — members, events, forum posts, committees, announcements, resources, newsletter drafts — lives in one `seed-eagles.sql`. Image URLs reference Run402 storage paths that are populated by the deploy script before running the seed.

**Rationale:** One file to read, one file to maintain. The deploy script handles the image upload step first, then runs schema + seed.

### D4: Deploy script wraps existing deploy.js

`demo/eagles/deploy-eagles.js` provisions a project (if needed), generates images, uploads to storage, writes the seed, then calls the standard deploy pipeline. It's a wrapper, not a replacement.

**Rationale:** Reuses proven deployment logic. Additions are demo-specific (image gen, content gen).

### D5: Content volume targets

| Content | Count | Rationale |
|---|---|---|
| Members | 25-30 | Enough for a populated directory with search |
| Events (upcoming) | 5 | Calendar feels active |
| Events (past) | 5-7 | Shows event history and recap potential |
| Forum categories | 5 | Matches committee structure |
| Forum topics | 15-20 | Multiple active discussions |
| Forum replies | 40-60 | Threads feel alive |
| Committees | 6 | Diverse volunteer areas |
| Committee members | 30+ assignments | Members serve on 1-3 committees each |
| Announcements | 8-10 | Mix of pinned and recent |
| Resources | 12-15 | PDFs, guides, templates |
| Newsletter drafts | 2 | One draft, one sent |
| Activity log | 30-40 entries | Recent activity feed looks active |

## Risks / Trade-offs

**[AI image generation cost]** → Each image costs ~$0.02-0.10 via StableStudio. ~40 images = ~$1-4 total. **Mitigation:** Budget is negligible. Cache generated images so rebuilds don't regenerate.

**[Run402 storage limits]** → ~40 images at ~100KB each = ~4MB. Well within limits. **Mitigation:** Compress images before upload.

**[Demo data staleness]** → Past events and timestamps will age. **Mitigation:** Use relative dates in the deploy script (e.g., "3 days ago", "next Saturday") so rebuilds produce fresh-looking dates.

**[Run402 project provisioning friction]** → May hit tier limits or need payment. **Mitigation:** Document friction in feedback log. Use the same account tier.
