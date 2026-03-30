## Why

Wild Lychee's core template is built (Phases 1-2), but non-technical community managers can't deploy it without developer help. Phase 3 turns Wild Lychee into a standalone product by adding Lychee Studio — an AI builder that investigates, interviews, and deploys a portal in 5 minutes — plus a marketing site that positions Wild Lychee against overpriced incumbents (Wild Apricot $530/mo, Circle $89/mo + fees) with a $5-20/mo flat-fee message.

## What Changes

- **Lychee Studio skill**: A Claude Code skill (`/lychee-studio`) that orchestrates the full setup flow — Chrome-based website investigation, context-aware interview, spec generation, automated build + deploy, and Chrome verification
- **Newsletter generator**: Scheduled edge function that AI-drafts a weekly newsletter from community activity, saved as a reviewable draft
- **Event recap generator**: On-demand edge function that AI-generates event recap announcements from attendance data
- **Marketing landing page**: `wildlychee.com` homepage with competitive positioning, pricing table, AI feature showcase, and niche audience cards
- **Niche landing pages**: Audience-specific pages (`/churches`, `/hoa`, `/sports`, `/associations`) with tailored hero text and screenshots
- **Niche seed variants**: Pre-configured `seed.sql` files for church, HOA, and professional association deployments with specialized roles, event types, and page structures

## Capabilities

### New Capabilities
- `lychee-studio`: AI-powered portal builder — website investigation via Chrome MCP, smart interview flow, spec/config generation, automated build + deploy + verification
- `newsletter-generator`: Scheduled AI newsletter drafting from weekly community activity with admin review/send workflow
- `event-recap-generator`: On-demand AI event recap generation saved as announcement drafts
- `marketing-site`: Landing page and niche pages for wildlychee.com — competitive positioning, pricing, CTA flows
- `niche-seed-variants`: Pre-configured seed data for church, HOA, and professional association verticals

### Modified Capabilities
- `scheduled-functions`: Adding newsletter generation (weekly cron) and event recap trigger to the scheduled functions roster
- `database-schema`: Adding `newsletter_drafts` table for newsletter workflow

## Impact

- **New files**: `/lychee-studio/` skill directory, `functions/generate-newsletter.js`, `functions/generate-recap.js`, marketing site HTML/CSS/JS, niche seed SQL files
- **Modified files**: `schema.sql` (newsletter_drafts table), `seed.sql` (niche variants as separate files)
- **Dependencies**: Chrome MCP (for Studio investigation + verification), Run402 CLI (for deploy automation), AI API keys (for newsletter/recap generation)
- **APIs**: Run402 deploy API, PostgREST (newsletter drafts CRUD), AI provider APIs (OpenAI/Anthropic for content generation)
- **External**: `wildlychee.com` domain (already on Route53), Run402 hosting for marketing site
