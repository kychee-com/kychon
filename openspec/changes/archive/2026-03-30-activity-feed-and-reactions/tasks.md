## 1. Schema & Seed

- [x] 1.1 Add `reactions` table to `schema.sql` with UNIQUE constraint on `(content_type, content_id, member_id, emoji)`
- [x] 1.2 Add `feature_activity_feed` and `feature_reactions` feature flags to `seed.sql` (default `true`, idempotent)
- [x] 1.3 Add `activity_feed` section row to `seed.sql` for homepage (positioned after announcements)

## 2. Activity Feed Frontend

- [x] 2.1 Add `activity_feed` case to the section renderer in `site/index.html` — query `activity_log` joined with `members`, render entries with avatar + action description + relative time
- [x] 2.2 Implement action-type template map: `member_join`, `announcement`, `rsvp`, `resource_upload`, `forum_post`, `reaction`, and unknown fallback
- [x] 2.3 Add CSS for activity feed section: entry layout, avatar circle, relative timestamp styling
- [x] 2.4 Respect `feature_activity_feed` flag — skip rendering the section when disabled

## 3. Reactions Frontend

- [x] 3.1 Add reaction bar UI to announcement rendering in `site/index.html` — emoji picker button + reaction count badges
- [x] 3.2 Implement reaction toggle: POST to add, DELETE to remove, re-render counts after each action
- [x] 3.3 Fetch reaction counts and current user's reactions alongside announcements (batch query for all visible announcement IDs)
- [x] 3.4 Highlight current user's active reactions with a visual state (filled/active class)
- [x] 3.5 Add CSS for reaction bar: badge layout, hover states, active highlight, picker dropdown
- [x] 3.6 Respect `feature_reactions` flag — hide reaction UI when disabled

## 4. Activity Logging Expansion

- [x] 4.1 Log `rsvp` activity in `site/js/events.js` when a member RSVPs (with `event_title` and `event_id` in metadata)
- [x] 4.2 Log `resource_upload` activity in `site/js/resources.js` when a resource is created (with `title` and `resource_id` in metadata)
- [x] 4.3 Log `forum_post` activity in `site/js/forum.js` when a forum topic is created (with `title` and `topic_id` in metadata)
- [x] 4.4 Log `reaction` activity in `site/index.html` when a reaction is added (with `content_type`, `content_id`, `emoji` in metadata)

## 5. Eagles Demo Seed Data

- [x] 5.1 Add ~60 reactions across Eagles demo announcements in Eagles seed SQL (varied emoji, varied members)
- [x] 5.2 Add ~40 activity log entries to Eagles seed SQL with `created_at` spread across the past 60 days (member joins, announcements, RSVPs, resource uploads, forum posts, reactions)
- [x] 5.3 Add `activity_feed` section row for Eagles homepage

## 6. Tests

- [x] 6.1 Unit tests for activity feed entry rendering (action-type templates, fallback for unknown types, missing member handling)
- [x] 6.2 Unit tests for reaction toggle logic (add, remove, duplicate prevention)
- [x] 6.3 Integration tests for reaction CRUD via API (POST, GET counts, DELETE)
- [x] 6.4 Integration tests for activity feed data fetching (query with member join, limit, ordering)
