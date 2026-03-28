## 1. Schema Migrations

- [x] 1.1 Add `hidden BOOLEAN DEFAULT false` and `locked BOOLEAN DEFAULT false` to `forum_topics`, `hidden BOOLEAN DEFAULT false` to `forum_replies` using safe ALTER DO blocks
- [x] 1.2 Add `search_vector TSVECTOR` column + GIN index to `forum_topics`
- [x] 1.3 Update `seed.sql`: set `feature_events` and `feature_resources` default to `true`, add nav items for events/resources/forum/committees, add AI feature flags (all default false)
- [x] 1.4 Update `deploy.js` RLS config to include new tables (events, event_rsvps, resources, forum_categories, forum_topics, forum_replies, committees, committee_members)

## 2. Events Module

- [x] 2.1 Create `site/events.html` + `site/js/events.js` — event listing page: upcoming events grid, past events section, search, members-only badge, admin "Create Event" button
- [x] 2.2 Create `site/event.html` + `site/js/event.js` — event detail page: title, description, location, date/time, image, capacity bar, RSVP button (going/maybe/cancel), attendee count, admin edit/delete
- [x] 2.3 Add event creation/edit modal or form for admins (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only)
- [x] 2.4 Implement RSVP logic: POST/PATCH/DELETE on event_rsvps, enforce unique per event+member, enforce capacity limit

## 3. Resources Module

- [x] 3.1 Create `site/resources.html` + `site/js/resources.js` — resource listing page: category filter, file type icons, members-only badge, admin upload button
- [x] 3.2 Create `functions/upload-resource.js` edge function — receives file upload, stores in Run402 storage, inserts resource row
- [x] 3.3 Add resource creation form for admins (title, description, category, file, file_type, is_members_only)

## 4. Forum Module

- [x] 4.1 Create `site/forum.html` + `site/js/forum.js` — forum home: category list with topic counts, latest topic per category
- [x] 4.2 Add category view: topic listing for a category (sorted by pinned + last_reply_at), topic creation form
- [x] 4.3 Add topic view: topic title + body, reply thread, reply form, admin pin/lock/hide/delete controls
- [x] 4.4 Implement reply submission: POST to forum_replies, increment reply_count on topic, update last_reply_at
- [x] 4.5 Implement moderation: hide/unhide topics and replies (PATCH hidden=true/false), hidden content not shown to non-admin users

## 5. Committees Module

- [x] 5.1 Create `site/committees.html` + `site/js/committees.js` — committee listing with member counts, admin create button
- [x] 5.2 Add committee detail view: description, member list with roles (chair/member), admin add/remove member controls

## 6. Scheduled Functions

- [x] 6.1 Create `functions/check-expirations.js` — daily cron: find members expiring in 7/14/30 days, send email reminders via Run402 notification template
- [x] 6.2 Create `functions/event-reminders.js` — hourly cron: find events starting within 1 hour, notify RSVPd members via Run402 notification template

## 7. CSV Export

- [x] 7.1 Create `functions/export-csv.js` edge function — accepts `type` param (members/events), queries DB, returns CSV response
- [x] 7.2 Add export buttons to admin-members.html (already exists, wire to function) and create export button on admin events page

## 8. AI Features — Moderation

- [x] 8.1 Create `functions/moderate-content.js` — scheduled every 15 min: query new forum topics/replies since last check, call AI API for classification, auto-hide if confidence > 0.7, log all decisions to moderation_log
- [x] 8.2 Add moderation review queue to admin dashboard: show flagged items with content preview, AI reason, confidence, approve/reject buttons

## 9. AI Features — Translation

- [x] 9.1 Create `functions/translate-content.js` edge function — receives content_type, content_id; reads content, translates to configured languages via AI API, stores in content_translations
- [x] 9.2 Update announcement/event/page rendering to check content_translations for user's locale and display translated version when available
- [x] 9.3 Add "Translate" button on admin content views that triggers the translate function

## 10. AI Features — Insights

- [x] 10.1 Enhance `functions/check-expirations.js` to also generate member insights when `feature_ai_insights` is enabled: expiring members, inactive members, stale pending applications
- [x] 10.2 Add "Members Needing Attention" section to admin dashboard showing pending insights with action/dismiss buttons

## 11. AI Features — Onboarding

- [x] 11.1 Enhance `functions/on-signup.js`: when `feature_ai_onboarding` is enabled and AI_API_KEY is set, generate personalized welcome message via AI and send via Run402 email notification

## 12. AI Admin Panel

- [x] 12.1 Add AI settings section to `admin-settings.html` + `admin-settings.js`: API key input (masked), provider selector, per-feature toggles, test button
- [x] 12.2 Add AI activity summary to admin dashboard: posts moderated, translations made, insights generated (last 7 days)

## 13. Agent Documentation Updates

- [x] 13.1 Update `STRUCTURE.md` with new pages, functions, feature flags, AI configuration, cron schedules
- [x] 13.2 Update `CUSTOMIZING.md` with new recipes: create event, add forum category, configure AI, add resource category, create committee

## 14. Tests

- [x] 14.1 Create `tests/unit/events.test.js` — RSVP logic, capacity enforcement
- [x] 14.2 Create `tests/unit/forum.test.js` — reply count tracking, moderation filtering (hidden content excluded)
- [x] 14.3 Create `tests/integration/events.test.js` — event listing rendering, RSVP button state, capacity bar
- [x] 14.4 Create `tests/integration/forum.test.js` — category listing, topic rendering, reply thread, moderation controls
- [x] 14.5 Create `tests/integration/resources.test.js` — resource listing, category filter, file type icons
- [x] 14.6 Create `tests/unit/ai-moderation.test.js` — classification parsing, confidence thresholds, auto-hide logic (mock AI API)
- [x] 14.7 Create `tests/unit/ai-translation.test.js` — translation storage, locale matching (mock AI API)

## 15. Deploy & Verify

- [x] 15.1 Deploy to Run402 and verify: events CRUD + RSVP, resources upload + download, forum post + reply + moderation, committees, CSV export, AI features with test API key
