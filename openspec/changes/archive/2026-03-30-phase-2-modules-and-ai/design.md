## Context

Phase 1 MVP is deployed at kychon.com with auth, members, directory, announcements, admin dashboard, inline editing, and i18n. The database schema already includes tables for events, resources, forum, and committees (created in Phase 1 schema.sql but unused). AI feature tables (content_translations, moderation_log, member_insights, newsletter_drafts) also exist.

This phase adds the feature modules and AI capabilities that differentiate Kychon from competitors.

## Goals / Non-Goals

**Goals:**

- Implement all Phase 2 spec items (13-22): events, resources, forum, committees, scheduled functions, CSV export, and 4 AI features
- Follow the same patterns established in Phase 1: one JS file per page, config-driven nav, feature-flagged, inline editing for admins
- AI features use BYOK (Bring Your Own Key) — user stores their API key as a Run402 project secret
- All new modules are feature-flagged and off by default (except events and resources)
- Maintain 85%+ test coverage

**Non-Goals:**

- Kychon Studio or Kychon Pro (Phase 3-4)
- Newsletter generation (Phase 3, depends on email gap resolution)
- Event recap generation (Phase 3)
- Real-time notifications or WebSocket features
- Payment/billing integration

## Decisions

### 1. Events follow the same page pattern as directory

`events.html` lists upcoming events, `event.html` shows a single event with RSVP. Both use `api.js` for data, `config.js` for nav/theme. Admin sees inline edit controls + create button. RSVP uses the authenticated user's member ID.

### 2. Resources use Run402 storage for file uploads

Files uploaded via `run402 storage upload` from an edge function (browser can't call storage directly with anon_key). The `upload-resource` edge function receives the file, uploads to storage, and inserts the resource row. Download links point to Run402 storage URLs.

**Alternative considered:** Direct browser upload to a signed URL. Rejected because Run402 storage doesn't support pre-signed upload URLs.

### 3. Forum uses the existing tables with client-side rendering

Forum has three levels: categories → topics → replies. `forum.html` shows categories with topic counts, clicking a category shows topics, clicking a topic shows replies. All client-rendered with `api.js`. Reply count is maintained via a trigger or updated on each reply insert.

Admin moderation: topics and replies can be hidden (soft delete via a `hidden` column — needs schema migration) or actually deleted. Pinned/locked topics.

### 4. AI features use a shared pattern: scheduled function + moderation log

All AI features follow the same architecture:
1. Scheduled edge function runs on cron
2. Function reads new/relevant data from DB
3. Function calls AI API (OpenAI or Anthropic) using the project secret
4. Function writes results back to DB (moderation_log, content_translations, member_insights)
5. Admin reviews results in dashboard

The AI provider and key are stored as project secrets: `AI_PROVIDER` (openai/anthropic) and `AI_API_KEY`.

### 5. AI moderation checks forum content every 15 minutes

The `moderate-content` function:
1. Queries forum_topics and forum_replies created since last check
2. Sends each to AI: "Is this spam, toxic, off-topic, or appropriate?"
3. If flagged (confidence > 0.7): auto-hides the content, logs to moderation_log
4. If borderline (0.3-0.7): logs but doesn't auto-hide, flags for admin review
5. If clean: logs as approved

Admin sees flagged items in dashboard with one-click approve/reject.

### 6. AI translation is trigger-based, not cron

Instead of a cron schedule, `translate-content` is called by the client after an admin publishes content (announcement, event, page). The function:
1. Reads the content and configured languages from brand.json
2. Calls AI to translate title + body to each target language
3. Inserts/updates rows in content_translations table

Content pages check content_translations for the user's locale and show translated version if available.

### 7. Member insights run daily, surface in admin dashboard

The `check-expirations` function (already in schema) is expanded to:
1. Find members expiring in 7/14/30 days
2. Find members inactive for 30+ days (no activity_log entries)
3. Find pending applications waiting >7 days
4. Call AI to generate personalized outreach suggestions
5. Insert into member_insights table

Admin dashboard shows a "Members Needing Attention" card with the latest insights.

### 8. Personalized onboarding enhances the existing on-signup function

When AI is enabled (`feature_ai_onboarding` flag + API key set), the on-signup function:
1. After creating the member record, calls AI with the member's profile + tier info
2. AI generates a personalized welcome message
3. Sends via Run402 email notification template (limited to 500 chars for now)
4. Logs to activity_log

### 9. Scheduled function cron schedules parsed from comments

The deploy.js pattern from Phase 1 continues: `// schedule: "0 8 * * *"` comments in function files are parsed and included in the deploy manifest. New schedules:
- `check-expirations.js`: `"0 8 * * *"` (daily 8AM)
- `event-reminders.js`: `"0 * * * *"` (hourly)
- `moderate-content.js`: `"*/15 * * * *"` (every 15 min)

### 10. Forum needs schema migration for hidden/locked columns

The Phase 1 schema created forum tables but without `hidden` or `locked` columns. We need safe ALTER migrations:
```sql
DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN hidden BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN locked BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_replies ADD COLUMN hidden BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
```

## Risks / Trade-offs

- **[AI API costs are user-borne]** → BYOK means the user pays OpenAI/Anthropic directly. Mitigation: AI features are opt-in, clearly labeled, with usage estimates in the admin panel.
- **[Moderation false positives]** → AI may flag legitimate content. Mitigation: borderline cases (confidence 0.3-0.7) are flagged but not auto-hidden; admin has one-click approve.
- **[Translation quality varies]** → AI translations may not be perfect. Mitigation: admin can edit translations inline; content_translations table allows manual overrides.
- **[Resource upload goes through edge function]** → Adds latency vs. direct upload. Mitigation: 10MB Run402 limit means files are small; edge function adds ~1-2s overhead.
- **[Forum moderation depends on AI availability]** → If AI API is down, new posts are unmoderated. Mitigation: posts still appear immediately; moderation is async. Manual moderation tools always available.
- **[Email notifications limited to 500-char plain text]** → Run402 email gap. Mitigation: keep notification messages concise; Phase 3 addresses with external email API.
