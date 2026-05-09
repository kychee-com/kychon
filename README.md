# Kychon

[![Tests](https://img.shields.io/badge/tests-205%20passed-brightgreen?style=flat-square)](https://github.com/kychee-com/kychon)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Biome](https://img.shields.io/badge/linter-Biome-60a5fa?style=flat-square&logo=biome&logoColor=white)](https://biomejs.dev)
[![Platform: Run402](https://img.shields.io/badge/platform-Run402-ff6b35?style=flat-square)](https://run402.com)
[![AI Native](https://img.shields.io/badge/AI-built--in-a855f7?style=flat-square)](https://kychon.com/#ai)

A forkable, AI-powered membership portal built on [Run402](https://run402.com). One deploy gives your community a full-featured site with member directory, events, forum, resources, committees, and built-in AI moderation and translation.

**Live demo:** [eagles.kychon.com](https://eagles.kychon.com)
**Marketing site:** [kychon.com](https://kychon.com)

## Features

- **Member Directory** - Searchable profiles with custom fields and tier badges
- **Events & RSVP** - Create events, collect RSVPs, send reminders
- **Forum** - Categories, topics, replies with reactions
- **Resources** - File library with categories and member-only access
- **Committees** - Working groups with members, chairs, and descriptions
- **Announcements** - Pinned posts with reactions and activity feed
- **AI Moderation** - Built-in content moderation via Run402 (free, no API key)
- **AI Translation** - Built-in auto-translation via Run402 (no API key)
- **Inline Editing** - Admins edit content directly on the page
- **i18n** - Full internationalization with translation files
- **Config-Driven** - Rebrand, toggle features, restructure via database config
- **Dark Mode** - System-aware with manual toggle

## Tech Stack

- **Frontend:** Astro SSG shell with static public blocks, Tailwind v4 design tokens, and React islands for admin/auth/editor surfaces
- **UI system:** Kychon-owned wrappers over shadcn/ui + Radix by default; Base UI only behind wrappers when it is the better primitive
- **Runtime:** Node.js edge functions on Run402
- **Database:** PostgreSQL via Run402 (PostgREST)
- **Auth:** Google OAuth + password (Run402 built-in)
- **Testing:** Vitest + happy-dom + fast-check
- **Linting:** Biome
- **Deploy:** One-command deploy via `scripts/deploy.ts` (typed `@run402/sdk/node`)

## Quick Start

```bash
# Pull demo images (Git LFS, one-time per machine)
git lfs install
git lfs pull

# Install dependencies
npm install

# Set up Run402
npm install -g run402
run402 init
run402 tier set prototype

# Provision and deploy
run402 projects provision --name "my-portal"
RUN402_PROJECT_ID=<your_project_id> SUBDOMAIN=<your-name> npx tsx scripts/deploy.ts
```

Your portal is live at `<your-name>.run402.com`.

## Project Structure

```
kychon/
├── scripts/deploy.ts      # One-command deploy to Run402 (typed @run402/sdk)
├── schema.sql             # All tables (idempotent migrations)
├── seed.sql               # Generated default config + sample data
├── src/
│   ├── pages/             # Astro routes, emitted as static HTML
│   ├── layouts/           # Portal shell, baked chrome, persisted providers
│   ├── components/
│   │   ├── ui/            # Product-owned shadcn component source
│   │   └── kychon/        # App-facing UI facade and wrappers
│   ├── lib/blocks.ts      # Public block registry and static renderers
│   ├── seeds/             # Typed demo/project seeds
│   └── styles/            # Tailwind v4 entrypoint, tokens, public CSS
├── public/                # Static adjunct assets, env.js, custom strings
├── functions/             # Serverless edge functions
├── marketing/             # Marketing site (kychon.com)
├── demo/                  # Demo seed data (Eagles, Silver Pines, etc.)
├── tests/                 # Unit + integration tests
├── docs/                  # Full spec + platform docs
└── openspec/              # Change management artifacts
```

## Development

```bash
# Run tests
npx vitest run

# Lint + format check
npx biome check .

# Type check
npx tsc --noEmit --project jsconfig.json

# All three at once
npm run check
```

## New Deployment UI Contract

New demo, Fresh Start, copied-site, and ported deployments should compose from Kychon's existing library before creating custom markup or styles:

- **Public pages:** use `sections` rows and the block registry in `src/lib/blocks.ts` first. Prefer existing blocks such as `brand_header`, `nav`, `hero`, `features`, `stats`, `testimonials`, `cta`, `promo_cards`, `events_list`, `events_calendar`, `link_list`, `slideshow`, `embed`, `social_links`, and `page_banner`.
- **Visual variation:** use `site_config.theme`, block config, `--ky-*` tokens, and documented public CSS hooks. Do not build dynamic Tailwind class names from tenant data.
- **Interactive UI:** use `@/components/kychon/ui`. shadcn is fully available as copy-owned source, but missing shadcn components must be added under `src/components/ui/*` and exposed through Kychon before feature code imports them.
- **New library pieces:** add a new block or component when the pattern is reusable across deployments. Treat raw custom HTML/CSS as a source-fidelity escape hatch.

## Customization

Kychon is designed to be customized by AI agents. Three tiers:

1. **SQL/config + block composition** (80%) - Rebrand, toggle features, restructure pages with `site_config`, `pages`, and `sections`
2. **Tokenized CSS + Kychon library extensions** (15%) - Add reusable block variants or Kychon/shadcn components behind the owned facade
3. **Full fork** (5%) - New tables, edge functions, page types, or platform behavior

See [CUSTOMIZING.md](CUSTOMIZING.md) for the agent guide.

## Capability API

Kychon now has a versioned Capability API for agent and integration workflows:

- API endpoint: `POST /functions/v1/kychon-api`
- Discovery: `/.well-known/kychon.json`, `/kychon-capabilities.json`, and `/llms.txt`
- SDK-first surface: `@kychon/sdk`
- CLI-second surface: `kychon`, a thin SDK wrapper

Use domain operations for product workflows such as creating events, approving members, publishing announcements, forum/poll activity, resource uploads, exports, AI jobs, and moderation. Raw PostgREST/SQL remains available for low-level configuration and migrations.

See [docs/kychon-api.md](docs/kychon-api.md), [docs/kychon-sdk.md](docs/kychon-sdk.md), and [docs/kychon-cli.md](docs/kychon-cli.md).

## Demo Portals

| Portal | Description | URL |
|--------|-------------|-----|
| The Eagles | Good Samaritans of Wichita | [eagles.kychon.com](https://eagles.kychon.com) |
| Silver Pines | Senior center with accessibility focus | demo/silver-pines/ |
| Barrio Unido | Spanish-language community center | demo/barrio-unido/ |

## Architecture

The central design principle: **an AI agent's API is SQL for config and file editing for code.**

- **Config-driven**: `site_config` table holds branding, theme, feature flags, nav structure
- **Schema-driven pages**: Homepage sections are database rows, not hardcoded files
- **Inline editing**: The page IS the admin - admins get edit overlays on the same URLs
- **Feature flags, not plugins**: All features ship, toggle with booleans in `site_config`

## License

MIT
