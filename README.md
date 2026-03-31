# Wild Lychee

[![GitHub release](https://img.shields.io/github/v/release/kychee-com/wildlychee?style=flat-square&color=4f46e5)](https://github.com/kychee-com/wildlychee/releases)
[![Tests](https://img.shields.io/badge/tests-205%20passed-brightgreen?style=flat-square)](https://github.com/kychee-com/wildlychee)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Biome](https://img.shields.io/badge/linter-Biome-60a5fa?style=flat-square&logo=biome&logoColor=white)](https://biomejs.dev)
[![Platform: Run402](https://img.shields.io/badge/platform-Run402-ff6b35?style=flat-square)](https://run402.com)
[![No Build Step](https://img.shields.io/badge/build%20step-none-10b981?style=flat-square)](https://github.com/kychee-com/wildlychee)
[![Vanilla JS](https://img.shields.io/badge/framework-vanilla%20JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)](https://github.com/kychee-com/wildlychee)
[![AI Native](https://img.shields.io/badge/AI-built--in-a855f7?style=flat-square)](https://wildlychee.com/#ai)

A forkable, AI-powered membership portal built on [Run402](https://run402.com). One deploy gives your community a full-featured site with member directory, events, forum, resources, committees, and built-in AI moderation and translation.

**Live demo:** [eagles.run402.com](https://eagles.run402.com)
**Marketing site:** [wildlychee.com](https://wildlychee.com)

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

- **Frontend:** Vanilla JS, HTML5, CSS3 (no frameworks, no build step)
- **Runtime:** Node.js edge functions on Run402
- **Database:** PostgreSQL via Run402 (PostgREST)
- **Auth:** Google OAuth + password (Run402 built-in)
- **Testing:** Vitest + happy-dom + fast-check
- **Linting:** Biome
- **Deploy:** One-command deploy via `deploy.js`

## Quick Start

```bash
# Install dependencies
npm install

# Set up Run402
npm install -g run402
run402 init
run402 tier set prototype

# Provision and deploy
run402 projects provision --name "my-portal"
RUN402_PROJECT_ID=<your_project_id> SUBDOMAIN=<your-name> node deploy.js
```

Your portal is live at `<your-name>.run402.com`.

## Project Structure

```
wild-lychee/
├── deploy.js              # One-command deploy to Run402
├── schema.sql             # All tables (idempotent migrations)
├── seed.sql               # Default config + sample data
├── site/                  # Static frontend
│   ├── *.html             # One HTML file per page
│   ├── css/               # Theme variables + component styles
│   ├── js/                # One JS file per feature
│   └── custom/            # Brand config + i18n strings
├── functions/             # Serverless edge functions
├── marketing/             # Marketing site (wildlychee.com)
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

## Customization

Wild Lychee is designed to be customized by AI agents. Three tiers:

1. **SQL only** (80%) - Rebrand, toggle features, restructure via `site_config` table
2. **HTML/CSS** (15%) - Visual and layout changes
3. **Full fork** (5%) - New tables, edge functions, page types

See [CUSTOMIZING.md](CUSTOMIZING.md) for the agent guide.

## Demo Portals

| Portal | Description | URL |
|--------|-------------|-----|
| The Eagles | Good Samaritans of Wichita | [eagles.run402.com](https://eagles.run402.com) |
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
