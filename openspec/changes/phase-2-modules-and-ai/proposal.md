## Why

Phase 1 MVP is deployed with core membership features. To justify the "Wild Apricot killer" positioning, we need the feature modules that community managers actually use daily — events, resources, forums — plus the AI features that no competitor offers. Without events and resources, the portal is just a member directory with announcements. Without AI features, it's just another cheaper Wild Apricot.

## What Changes

- Build events module: create/edit events, RSVP (going/maybe/cancelled), listing page, detail page with attendance tracking
- Build resources module: upload files to Run402 storage, categorize, download with members-only access control
- Build forum module: categories, topics, replies, pin/lock topics, admin moderation tools
- Build committees module: create committees, assign members with roles (chair/member)
- Add scheduled edge functions: daily membership expiration checks with email reminders, hourly event reminders
- Add CSV export edge function for members and events
- Add AI content moderation bot: scheduled function that reviews new forum posts every 15 minutes via AI API
- Add AI auto-translation: edge function triggered on content publish that translates to configured languages
- Add AI member insights: daily scheduled function that identifies at-risk/expiring/inactive members with outreach suggestions
- Add AI personalized onboarding: enhance on-signup to generate personalized welcome messages via AI
- Add admin UI for AI features: API key configuration, feature toggles, moderation review, insight dashboard
- Update admin dashboard with event stats, resource stats, forum stats, and AI activity
- Update nav config and feature flags for all new modules
- Add tests for all new modules

## Capabilities

### New Capabilities

- `events`: Event CRUD, RSVP system (going/maybe/cancelled), event listing page, event detail page, capacity tracking, members-only events
- `resources`: File upload to Run402 storage, categorization, download, members-only access control, resource listing page
- `forum`: Forum categories, topics with rich text, replies, pin/lock topics, admin moderation (approve/hide/delete), reply counts
- `committees`: Committee CRUD, member-committee assignments with roles (chair/member), committee listing
- `scheduled-functions`: Membership expiration checks (daily cron), event reminders (hourly cron), email notifications via Run402 email
- `csv-export`: Edge function to export members and events as CSV downloads
- `ai-moderation`: Scheduled edge function (every 15 min) that sends new forum content to AI API for spam/toxicity review, auto-hide flagged content, moderation log with admin review UI
- `ai-translation`: Edge function triggered on content publish that translates announcements/events/pages to configured languages, stores in content_translations table
- `ai-insights`: Daily scheduled function that analyzes member activity, identifies expiring/inactive/at-risk members, generates outreach suggestions, surfaces in admin dashboard
- `ai-onboarding`: Enhanced on-signup function that generates personalized welcome messages via AI based on member profile and tier
- `ai-admin`: Admin settings panel for AI features — API key management, provider selection, per-feature toggles, AI activity log

### Modified Capabilities

- `admin-dashboard`: Add event stats, resource stats, forum stats, expiring member alerts, AI insights section, moderation queue
- `database-schema`: Add indexes for new tables, add tsvector columns for forum full-text search
- `deploy`: Add new scheduled functions with cron schedules to deploy manifest
- `config-driven-ui`: Add nav items and feature flags for events, resources, forum, committees
- `test-suite`: Add tests for all new modules (unit + integration)
- `agent-docs`: Update STRUCTURE.md and CUSTOMIZING.md with new modules, scheduled functions, AI features

## Impact

- **New files**: ~20 HTML/JS files for new pages, ~8 edge functions, ~15 test files
- **Modified files**: admin dashboard, deploy script, config, nav seed data, schema, STRUCTURE.md, CUSTOMIZING.md
- **Dependencies**: None new (AI calls use native fetch to OpenAI/Anthropic APIs)
- **Platform**: Requires Run402 scheduled functions (cron), storage (file uploads), email (notifications)
- **External**: OpenAI or Anthropic API key required for AI features (BYOK, stored as project secret)
