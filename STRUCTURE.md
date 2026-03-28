# Wild Lychee — AI-Readable Manifest

**Version**: 0.2.0 (Phase 2)
**Platform**: Run402 (Postgres + static hosting + edge functions)
**Deploy**: `node deploy.js` (assembles app.json, runs `run402 deploy`)

## File Structure

```
wild-lychee/
├── deploy.js              # Deploy script → assembles app.json → run402 deploy
├── schema.sql             # All database tables (idempotent, CREATE TABLE IF NOT EXISTS)
├── seed.sql               # Default config, tiers, homepage sections (idempotent, ON CONFLICT)
├── site/
│   ├── index.html         # Landing page: schema-driven sections + announcements + auth modal
│   ├── directory.html     # Member directory (search, filter, detail modal)
│   ├── profile.html       # Profile editor (name, bio, avatar, custom fields)
│   ├── page.html          # Generic page renderer (?slug=about)
│   ├── events.html        # Events listing (upcoming, past, RSVP)
│   ├── event.html         # Single event detail + RSVP (?id=UUID)
│   ├── resources.html     # Resource library (browse, search, download)
│   ├── forum.html         # Forum (categories, topics, replies)
│   ├── committees.html    # Committees listing + detail
│   ├── admin.html         # Admin dashboard (stats, activity feed, quick actions)
│   ├── admin-members.html # Member management (approve, suspend, tier, role, CSV export)
│   ├── admin-settings.html# Site settings (branding, theme, features, tiers)
│   ├── css/
│   │   ├── theme.css      # CSS custom properties (defaults, overridden by site_config.theme)
│   │   └── styles.css     # All component styles using CSS variables
│   ├── js/
│   │   ├── api.js         # REST wrapper: get/post/patch/del/count + 401 refresh
│   │   ├── auth.js        # Google OAuth PKCE + password auth + session + role checks
│   │   ├── config.js      # Loads site_config, injects theme, builds nav, loads admin-editor
│   │   ├── i18n.js        # t(key, vars), locale loading, plurals, RTL
│   │   ├── profile.js     # Profile editor logic
│   │   ├── directory.js   # Directory listing + search/filter
│   │   ├── admin.js       # Dashboard stats + activity feed
│   │   ├── events.js          # Events listing + RSVP logic
│   │   ├── event.js           # Single event detail + RSVP
│   │   ├── resources.js       # Resource library browse/search/download
│   │   ├── forum.js           # Forum categories, topics, replies
│   │   ├── committees.js      # Committees listing + detail
│   │   ├── admin-members.js   # Member management table
│   │   ├── admin-settings.js  # Settings panel logic
│   │   └── admin-editor.js    # Inline editing (contenteditable + Tiptap + image upload)
│   └── custom/
│       ├── brand.json     # Languages + default language
│       └── strings/en.json# English UI strings (~130 keys)
├── functions/
│   ├── on-signup.js       # Post-auth: create member, first-user-admin
│   ├── check-expirations.js   # schedule: "0 8 * * *" — expire lapsed memberships daily at 8 AM
│   ├── event-reminders.js     # schedule: "0 * * * *" — send upcoming-event reminders hourly
│   ├── moderate-content.js    # schedule: "*/15 * * * *" — AI content moderation every 15 min
│   ├── translate-content.js   # On-demand AI translation edge function
│   ├── upload-resource.js     # Handle resource file uploads
│   └── export-csv.js          # Generate CSV exports for admin
└── tests/
    ├── unit/              # Vitest + Node
    ├── integration/       # Vitest + happy-dom
    └── fixtures/          # Mock data
```

## Database Tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `site_config` | All branding, theme, feature flags, nav | key (PK), value (JSONB), category |
| `pages` | Custom pages | slug (unique), title, content, requires_auth, show_in_nav |
| `sections` | Homepage/page sections | page_slug, section_type, config (JSONB), position |
| `membership_tiers` | Tier definitions | name, benefits (TEXT[]), price_label, is_default |
| `member_custom_fields` | Custom profile fields | field_name, field_type, options (JSONB), visible_in_directory |
| `members` | All members | user_id (UUID), email, display_name, role, status, tier_id, custom_fields (JSONB) |
| `announcements` | News/announcements | title, body, is_pinned, author_id |
| `activity_log` | Activity tracking | member_id, action, metadata (JSONB) |
| `events` | Events (Phase 2) | title, starts_at, capacity, is_members_only |
| `event_rsvps` | RSVPs (Phase 2) | event_id, member_id, status |
| `resources` | Resource library (Phase 2) | title, file_url, file_type, is_members_only |
| `forum_*` | Forum tables (Phase 2) | categories, topics, replies |
| `committees` | Committees (Phase 2) | name, description |
| `content_translations` | AI translations (Phase 2) | content_type, content_id, language, field |
| `moderation_log` | AI moderation (Phase 2) | content_type, action, reason, confidence |
| `member_insights` | AI insights (Phase 2) | member_id, insight_type, message, priority |
| `newsletter_drafts` | AI newsletter (Phase 2) | subject, body, status |

## Feature Flags (site_config)

All boolean. Toggle with: `UPDATE site_config SET value = 'true' WHERE key = 'feature_events';`

- `feature_events` (default **true**), `feature_forum`, `feature_directory`, `feature_resources` (default **true**)
- `feature_blog`, `feature_committees`
- `feature_ai_onboarding` — AI-powered new-member onboarding flow
- `feature_ai_moderation`, `feature_ai_translation`, `feature_ai_newsletter`, `feature_ai_insights`
- `directory_public` (allow anonymous directory access)

## AI Configuration

AI features require two Run402 secrets:

- `AI_API_KEY` — API key for the AI provider
- `AI_PROVIDER` — Provider identifier (e.g., `anthropic`, `openai`)

Set them via the CLI:

```sh
run402 secrets set AI_API_KEY sk-...
run402 secrets set AI_PROVIDER anthropic
```

Each AI feature has its own toggle (`feature_ai_moderation`, `feature_ai_translation`, etc.) so you can enable AI capabilities individually after setting the secrets.

## Schema Migrations

Phase 2 tables are created with `CREATE TABLE IF NOT EXISTS` (safe to re-run). When adding columns to existing tables, use the safe ALTER pattern:

```sql
DO $$ BEGIN
  ALTER TABLE members ADD COLUMN onboarding_complete BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
```

This avoids errors on repeated deploys.

## Naming Conventions

- Pages: `site/{feature}.html`
- Page logic: `site/js/{feature}.js`
- Edge functions: `functions/{feature}.js`
- Schema sections: `-- SECTION: {Feature}` comments in schema.sql
- Config keys: `site_name`, `feature_forum`, `theme` (snake_case)
- i18n keys: `section.key` dot notation (e.g., `nav.home`, `admin.stats_active`)

## How to Add a New Feature

1. Add tables to `schema.sql` (use `CREATE TABLE IF NOT EXISTS`)
2. Add seed data to `seed.sql` (use `ON CONFLICT`)
3. Create `site/{feature}.html` + `site/js/{feature}.js`
4. Add nav item to `seed.sql` nav config
5. Add feature flag to `seed.sql` (e.g., `feature_myfeature`)
6. Add i18n keys to `site/custom/strings/en.json`
7. Run `node deploy.js`

## How to Add a New Page

1. Insert into `pages` table (SQL or via admin settings)
2. Optionally insert `sections` rows for structured content
3. Page renders automatically via `page.html?slug=your-slug`
4. Add to nav by inserting into the `nav` config in `site_config`
