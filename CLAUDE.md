# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wild Lychee is an AI-powered membership/community portal template built on the Run402 serverless platform. It's three products in one:

- **Wild Lychee** - A forkable community portal template (free + $5-20/mo Run402 hosting)
- **Lychee Studio** - AI concierge that builds your portal via investigation + interview ($29 premium)
- **Lychee Pro** - Ongoing AI customization agent ($9-29/mo)

**Status**: Design complete, ready for implementation. The full spec lives in `docs/spec.md`.

## Architecture

### Config-Driven Design

The central design principle: **an AI agent's API is SQL for config and file editing for code.** Three customization tiers:

1. **SQL only** (80%) - rebrand, toggle features, restructure via `site_config` table (JSONB)
2. **HTML/CSS** (15%) - visual/layout changes
3. **Full fork** (5%) - new tables, functions, page types

### Inline Editing ("The page IS the admin")

Members and admins see the same URL. Admins get edit overlays via `data-editable` attributes. Three editing layers:
- **Simple text**: native `contenteditable` (~30 lines JS)
- **Rich text**: Tiptap (~45kB), lazy-loaded only for admins
- **Images**: click-to-upload handler (~30 lines)

Member page load: ~15kB. Admin adds: ~60kB (admin-editor.js + Tiptap).

### Schema-Driven Pages

Homepage sections and custom pages are database rows (`pages` + `sections` tables), not hardcoded files. Agents restructure the homepage with SQL inserts/updates.

### i18n (Krello Pattern)

- Translation files in `site/custom/strings/{lang}.json` (~450 keys)
- `t(key, vars)` function with English fallback, `_one` suffix for plurals, `{placeholder}` interpolation
- Config in `site/custom/brand.json`: `languages` array + `defaultLanguage`

### AI Features (BYOK)

Users store `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` as project secrets. Scheduled edge functions call the API. Feature-flagged: moderation, auto-translation, newsletter, member insights, onboarding, event recaps.

## Tech Stack

- **Frontend**: Vanilla JS, HTML5, CSS3 (no frameworks, no build step)
- **Editor**: Tiptap (headless, lazy-loaded for admins)
- **Runtime**: Node.js edge functions on Run402
- **Database**: PostgreSQL via Run402 (PostgREST)
- **Auth**: Run402 built-in (Google OAuth + password)
- **Testing**: Vitest + happy-dom + fast-check + @vitest/coverage-v8 (85%+ threshold)
- **E2E**: Claude Code + Chrome MCP (agent-driven visual verification)
- **Deployment**: `npx tsx deploy.ts` (idempotent, additive migrations)

## Planned File Structure

```
wild-lychee/
├── deploy.ts              # One-command deploy to Run402
├── STRUCTURE.md           # AI-readable manifest (agents read this first)
├── CUSTOMIZING.md         # Agent guide for customizations
├── schema.sql             # All tables by feature section
├── seed.sql               # Default config + sample data
├── vitest.config.js
├── site/
│   ├── *.html             # One HTML file per page
│   ├── css/theme.css      # CSS custom properties (from DB)
│   ├── css/styles.css     # Component styles using variables
│   ├── js/config.js       # Loads site_config, sets CSS vars, builds nav
│   ├── js/auth.js         # Google OAuth + session + role checks
│   ├── js/api.js          # Thin REST API wrapper
│   ├── js/i18n.js         # t() function, loadLocale, setLanguage
│   ├── js/{feature}.js    # One JS file per page
│   ├── js/admin-editor.js # Inline editing (only loaded for admins)
│   └── custom/
│       ├── brand.json     # Deploy-time config: name, colors, languages
│       └── strings/en.json
├── functions/             # Edge functions (serverless)
│   ├── on-signup.js       # First-user becomes admin
│   ├── check-expirations.js  # schedule: "0 8 * * *"
│   ├── event-reminders.js    # schedule: "0 * * * *"
│   ├── moderate-content.js   # schedule: "*/15 * * * *"
│   └── ...
└── tests/
    ├── unit/              # Vitest + Node
    ├── integration/       # Vitest + happy-dom
    └── fixtures/
```

## Key Conventions

- **One JS file per page** - no cross-page imports. `events.js` handles only events.
- **Predictable naming**: `site/{feature}.html`, `site/js/{feature}.js`, `functions/{feature}-*.js`
- **HTML section landmarks**: `<!-- NAV -->`, `<!-- HERO -->`, `<!-- CONTENT -->`, `<!-- FOOTER -->`
- **Feature flags, not plugins** - all features ship, toggle with booleans in `site_config`
- **CSS variables for theming** - script reads `theme` from `site_config` and sets custom properties
- **No build step** - static files, libraries via esm.sh or bundled

## Build Phases

1. **Phase 1 (MVP)**: Schema, auth, members, directory, announcements, admin dashboard, inline editing, i18n, config-driven nav/pages, tests, STRUCTURE.md, CUSTOMIZING.md
2. **Phase 2**: Events, resources, scheduled functions, forum, committees, AI features (moderation, translation, insights, onboarding)
3. **Phase 3**: Lychee Studio (Chrome investigation + interview + build), newsletter/recap AI, marketing site, niche variants
4. **Phase 4**: Lychee Pro agent, marketplace publishing, growth

## OpenSpec Workflow

Changes are managed via OpenSpec in `/openspec/`. Use `/opsx:propose` to propose new changes, `/opsx:apply` to implement tasks, `/opsx:explore` to think through ideas.

## Run402 Platform Gaps to Work Around

### Confirmed gaps (from live deploy testing)

- **`getUser(req)` returns `{ id, role }` only — no email**: Password-auth users have no email in the JWT claims or the `getUser` response. Workaround: client passes `email` in the request body to edge functions. Google OAuth users get email from `/auth/v1/user` endpoint.
- **SQL `SET role` blocked by pattern filter**: `UPDATE members SET role = 'admin'` is blocked because the filter `\bSET\s+(search_path|role)\b` matches `role` as a column name. Workaround: delete and re-insert the row, or use `db.from('members').update({ role: 'admin' }).eq('id', 1)` from an edge function (bypasses RLS and the SQL filter).
- **Static file caching (`max-age=3600`) with no cache busting**: After redeploy, browsers serve stale CSS/JS for up to 1 hour. No content-hash or version query param in URLs. Workaround: manually append `?v=timestamp` to CSS/JS links in HTML, or tell users to hard-refresh.
- **No webhooks / post-auth events**: No server-side hook for signup/login events. Workaround: client-side JS calls `on-signup` edge function after OAuth callback; `config.js` checks on every page load if the auth user has a member record (resilience against missed calls).
- **Email templates too rigid**: Only 3 fixed templates (`project_invite`, `magic_link`, `notification`); `notification` allows only 500-char plain text. Workaround: use edge functions calling external email APIs (Resend/SES) for rich HTML emails.

### Minor gaps

- **No batch REST operations**: Approving 12 members = 12 PATCH requests. Workaround: use an edge function with `db.sql()` for bulk updates.
- **10MB file upload limit**: Fine for photos/PDFs, limits large video/presentations.
- **`/auth/v1/user` may not return email for password users**: The endpoint returns `display_name`, `avatar_url`, and linked identities, but email availability varies. Always pass email from the client as fallback.
