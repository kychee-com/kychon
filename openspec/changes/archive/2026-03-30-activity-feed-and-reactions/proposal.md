## Why

The Wild Lychee portal feels static — announcements are broadcast-only and there's no visible pulse of community activity. Adding an activity feed and emoji reactions transforms passive readers into participants and makes the site feel inhabited. The Eagles demo site needs this even more: with 25+ members and dense content, a feed and reactions make the demo feel alive rather than like a data dump.

## What Changes

- **Activity feed section** on the homepage: a chronological stream of recent community activity ("Sarah joined," "New event: Spring Mixer," "3 new resources added"). Queries existing `activity_log` rows and enriches them with human-readable descriptions and member avatars.
- **Emoji reactions on announcements**: members can react with a small set of emoji (thumbs up, heart, celebrate, etc). Reaction counts display below each announcement. One reaction per type per member.
- **New `reactions` table** to store emoji reactions (polymorphic: `content_type` + `content_id` so it can extend to forum posts, events, etc. later).
- **Expanded activity logging**: new activity types (`reaction`, `rsvp`, `resource_upload`, `forum_post`) so the feed has richer content. Currently only `announcement` and `member_join` are logged.
- **Feature flags**: `feature_activity_feed` (default true) and `feature_reactions` (default true).
- **Eagles demo seed data**: pre-populated reactions on announcements and a rich activity log (~40 entries with timestamps spread over the past 60 days).

## Capabilities

### New Capabilities
- `activity-feed`: Homepage section that displays a chronological feed of recent community actions (joins, events, announcements, reactions) with member avatars and relative timestamps
- `reactions`: Emoji reactions on announcements (extensible to other content types) with per-member uniqueness and count display

### Modified Capabilities
- `announcements`: Announcements now display reaction buttons and counts below each announcement
- `database-schema`: New `reactions` table, expanded `activity_log` usage, new feature flags in seed data

## Impact

- **Schema**: New `reactions` table. New feature flag rows in `site_config` seed.
- **Frontend**: New `site/js/activity-feed.js`. Modified announcement rendering in `site/index.html` to include reaction UI. New CSS for feed and reaction components.
- **API**: New REST endpoints via PostgREST for `reactions` table (POST, GET, DELETE).
- **Eagles demo**: Extended `seed-eagles.sql` (or migration SQL) with reaction data and richer activity log entries.
- **Tests**: Unit tests for activity feed rendering and reaction logic. Integration tests for reaction CRUD.
