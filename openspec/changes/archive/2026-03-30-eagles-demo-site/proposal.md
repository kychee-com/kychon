## Why

Kychon has no live demo that showcases the full template with realistic content. Prospective users see a generic "Welcome to Our Community" homepage with zero members, events, or forum posts. A richly populated demo site — "The Eagles: Good Samaritans of Wichita" — will demonstrate every feature with AI-generated content (text, images, logos, member photos) and serve as a stress test of Run402's deployment pipeline. This is a charitable community organization in Wichita, KS — the perfect vertical to show off member directory, events, committees, forum, resources, announcements, and AI features all working together.

## What Changes

- **New Run402 project**: Deploy a second Kychon instance as `eagles.run402.com` with its own database, branding, and content
- **Custom seed data**: A `seed-eagles.sql` with the full organization — 25+ AI-generated members with photos, 10+ upcoming/past events, 5+ forum categories with active threads, 6+ committees, 15+ announcements, 20+ resources, and newsletter drafts
- **AI-generated branding**: Logo, hero images, member avatar photos, event photos — all generated via AI image APIs and uploaded to Run402 storage
- **Custom brand.json**: Eagles-specific colors (navy + gold), fonts, tagline, and i18n strings
- **Homepage content**: Custom hero, features grid, stats, and CTA sections tuned for a charitable community
- **Demo-specific pages**: A custom "About" page and "Volunteer" page as schema-driven `pages` rows
- **Run402 friction log**: Document every issue, error, or papercut encountered during the demo build process

## Capabilities

### New Capabilities
- `demo-seed-data`: Comprehensive seed SQL for "The Eagles" with 25+ members, 10+ events, forum threads, committees, announcements, resources, and newsletter drafts — all AI-generated text
- `demo-branding`: Custom brand.json, theme colors, logo, hero images, and AI-generated visual assets uploaded to Run402 storage
- `demo-deploy`: Separate Run402 project deployment with eagles-specific schema, seed, and subdomain

### Modified Capabilities
_(none — this is a separate deployment, not a change to the template)_

## Impact

- **New files**: `demo/eagles/seed-eagles.sql`, `demo/eagles/brand.json`, `demo/eagles/deploy-eagles.js`, AI-generated image assets
- **Run402**: New project provisioned, separate database, separate subdomain (`eagles.run402.com`)
- **Dependencies**: AI image generation API (for logos, member photos, event images), Run402 CLI, Run402 storage API
- **No impact on template**: The demo is a deployment of the existing template, not a modification. All changes are in seed data, branding config, and static assets.
