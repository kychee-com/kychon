## Context

Wild Lychee has an `activity_log` table that records member actions, but nothing renders it. Announcements are one-way broadcasts with no interaction mechanism. The homepage shows sections (hero, features, CTA) and announcements, but nothing that conveys "people are here, things are happening."

The Eagles demo site will have 25+ members and dense content — without a feed and reactions, all that content sits inert.

## Goals / Non-Goals

**Goals:**
- A visible activity feed section on the homepage showing recent community actions
- Emoji reactions on announcements that any authenticated member can use
- Polymorphic `reactions` table that can extend to forum posts, events, etc. later
- Richer activity logging across existing features (RSVPs, resource uploads, forum posts)
- Eagles demo seed data with realistic reactions and activity history
- Feature-flagged: both features can be toggled off

**Non-Goals:**
- Real-time updates / WebSockets (polling or page-load is sufficient)
- Reactions on content types other than announcements (future work)
- Activity feed pagination or infinite scroll (simple limit of ~20 items)
- Push notifications for reactions
- Custom emoji sets (fixed set of 5-6 emoji)

## Decisions

### D1: Activity feed as a homepage section type, not a separate page

The feed renders as a `section_type = 'activity_feed'` entry in the `sections` table, positioned on the homepage between existing sections. This means agents can reposition or hide it via SQL, consistent with the config-driven design.

**Alternatives considered:**
- Dedicated `/activity.html` page: Adds a page nobody will bookmark. The feed is ambient context, not a destination.
- Sidebar widget: Requires layout changes to every page. Too invasive.

**Rationale:** Fits the existing section-rendering pipeline. Zero new pages, zero layout changes.

### D2: Query `activity_log` directly, no materialized feed table

The feed is a simple `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20` with a join on `members` for display names and avatars. No separate feed table, no fan-out.

**Alternatives considered:**
- Materialized view: Premature for communities of <500 members.
- Denormalized feed table: More complexity, same result at this scale.

**Rationale:** `activity_log` already has `member_id`, `action`, `metadata`, and `created_at`. A single query with a member join is sufficient. The index on `created_at` keeps it fast.

### D3: Fixed emoji set, stored as text codes

Reactions use a fixed set: `like`, `heart`, `celebrate`, `laugh`, `think`. Stored as `emoji TEXT` in the `reactions` table, rendered as Unicode emoji in the UI. No custom emoji, no image sprites.

**Alternatives considered:**
- Unicode emoji directly in the column: Display varies across OS. Named codes give us control over rendering.
- Configurable emoji set via `site_config`: Over-engineering for v1. Can add later.

**Rationale:** Five emoji covers 95% of community reaction use cases. Named codes let us swap rendering (Unicode, SVG, custom) without data migration.

### D4: Polymorphic `reactions` table with unique constraint

```sql
CREATE TABLE IF NOT EXISTS reactions (
  id SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,  -- 'announcement', 'forum_topic', etc.
  content_id INT NOT NULL,
  member_id INT REFERENCES members(id),
  emoji TEXT NOT NULL,         -- 'like', 'heart', 'celebrate', 'laugh', 'think'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_type, content_id, member_id, emoji)
);
```

One reaction per emoji per member per content item. Clicking again removes it (toggle behavior). The unique constraint prevents duplicates at the DB level.

**Alternatives considered:**
- Separate `announcement_reactions`, `forum_reactions` tables: Doesn't scale to new content types.
- JSONB column on announcements: Makes aggregation queries harder.

**Rationale:** Polymorphic pattern matches `content_translations` and `moderation_log` which already use `content_type` + `content_id`.

### D5: Reaction counts fetched alongside announcements

When loading announcements, a second query fetches reaction counts grouped by `content_id` and `emoji`. The current user's reactions are fetched in a third query (or combined). This avoids N+1 queries.

```
GET reactions?content_type=eq.announcement&content_id=in.(1,2,3)&select=content_id,emoji,count()
```

**Rationale:** PostgREST doesn't support GROUP BY natively, so we'll use an edge function or client-side aggregation from the raw reactions list (for communities < 500, fetching all reactions for 20 announcements is negligible).

### D6: Activity feed entry rendering via action-type map

Each activity type maps to a template string:

| Action | Template |
|---|---|
| `member_join` | **{name}** joined the community |
| `announcement` | **{name}** posted an announcement: {title} |
| `rsvp` | **{name}** is going to **{event_title}** |
| `resource_upload` | **{name}** shared a resource: {title} |
| `forum_post` | **{name}** started a topic: {title} |
| `reaction` | **{name}** reacted to {content_title} |

The `metadata` JSONB on `activity_log` carries the context (title, content_type, etc.). The JS renderer looks up the template by action type and interpolates.

### D7: Eagles demo seed data approach

Add to the Eagles seed SQL:
- ~40 activity log entries with `created_at` spread across the past 60 days using relative date expressions
- ~60 reactions across the 8-10 announcements (2-5 reactions per announcement, varied emoji)
- New feature flag rows: `feature_activity_feed = true`, `feature_reactions = true`
- A new `sections` row for `activity_feed` on the homepage

## Risks / Trade-offs

**[Client-side reaction aggregation]** → For large communities, fetching all reactions for 20 announcements could return hundreds of rows. **Mitigation:** Add a `LIMIT 500` safety cap. At that scale, move to an edge function with `GROUP BY`.

**[Activity log pollution]** → Logging reactions as activity could flood the feed with "X reacted" entries. **Mitigation:** The feed renderer can filter or collapse consecutive reaction entries (e.g., show "3 people reacted to..." instead of 3 separate entries). Or simply skip `reaction` activity type in the feed by default.

**[PostgREST aggregation gap]** → PostgREST doesn't support `GROUP BY` or `COUNT` in the way we'd ideally want. **Mitigation:** Fetch raw reactions client-side and aggregate in JS. For v1 with small communities this is fine. Can add an edge function later.

**[Feature flag interaction]** → If `feature_activity_feed` is off but the `sections` table has an `activity_feed` row, it should not render. **Mitigation:** The section renderer checks the feature flag before rendering the activity feed section type.
