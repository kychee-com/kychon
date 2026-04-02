## Context

Wild Lychee is a config-driven community portal on Run402 (static Astro SSG + PostgREST + edge functions). Content types (announcements, events, forum topics) are database rows rendered by Astro pages with client-side JS. The codebase uses a polymorphic pattern for cross-cutting features (e.g., `reactions` table with `content_type` + `content_id`). All features are toggled via `site_config` feature flags.

## Goals / Non-Goals

**Goals:**

- Polls as standalone entities attachable to announcements, forum topics, homepage sections, or standalone at `/polls`
- One shared `renderPoll()` function reused across all surfaces
- Inline poll creation form embeddable in announcement/forum editors and on `/polls`
- Configurable results visibility: always, after vote, after close
- Anonymous voting option (voter identity stored for dedup, hidden from display)
- Admins always create polls; members optionally via `polls_member_create` config
- Auto-close polls on page load when `closes_at` has passed
- Activity logging for poll creation and voting

**Non-Goals:**

- Scheduled auto-close via cron (deferred — check on page load for now)
- Rating scale or free-text poll types (start with single-choice and multiple-choice only)
- Real-time vote updates / WebSocket push
- Full survey builder (multi-page, conditional logic, text responses)
- Poll analytics dashboard (admin sees results inline, no separate analytics page)

## Decisions

### 1. Polls are standalone entities with polymorphic attachment

A poll is a first-class row in `polls` with optional `attached_to` (content type string) and `attached_id` (integer) fields. This mirrors the `reactions` table pattern. When `attached_to` is NULL, the poll is standalone and appears on `/polls`.

**Why not embed poll data as JSONB inside announcements/topics?** Standalone polls would require a separate table anyway, so two storage models means two code paths. One table with an optional attachment reference is simpler.

**Why not foreign keys for attachment?** The polymorphic `content_type` + `content_id` pattern is already established by `reactions`. Adding FK constraints would require separate nullable columns per content type, which scales poorly as more attachable surfaces are added.

### 2. Vote enforcement: application-level for single-choice, constraint for safety

For single-choice polls, the app deletes existing votes for that member+poll before inserting the new one. This gives "change your vote" for free. The `UNIQUE(poll_id, member_id, option_id)` constraint remains as a safety net for both poll types.

For multiple-choice polls, each selected option is a separate row. The unique constraint prevents duplicate option selections.

**Why not a stricter `UNIQUE(poll_id, member_id)` for single-choice?** It would prevent the multi-choice pattern from working with the same table. Application-level enforcement is simple (one DELETE + one INSERT) and the constraint catches bugs.

### 3. Anonymous polls store member_id but never expose it

When `is_anonymous = true`, `poll_votes.member_id` is still stored to enforce one-vote-per-member. The API layer and UI never return or display voter identity for anonymous polls. Admin dashboard shows aggregate counts only.

**Why not truly anonymous (no member_id)?** Without member_id, there's no way to prevent duplicate votes or support "change your vote." The trust contract is clear: identity is stored for integrity, hidden for privacy.

### 4. Results visibility is a per-poll enum

Three modes: `always` (results visible before voting), `after_vote` (results shown only after the member votes), `after_close` (results hidden until poll closes). Default is `after_vote` to maximize participation by preventing bandwagon bias.

### 5. Inline creation form as a shared JS function

`createPollForm(container, attachConfig?)` renders the poll creation form. Called with no `attachConfig` on `/polls` (standalone), or with `{ type: 'announcement', id: null }` inside the announcement editor. The parent's save handler creates the parent first, gets the ID, then creates the poll with `attached_to` and `attached_id`.

**Why not a separate Astro component?** Poll creation is a client-side interaction (dynamic form with add/remove options). It needs to be a JS function, not a server-rendered component. The function lives in a shared module importable by any page.

### 6. Page-load close check instead of cron

When any page renders a poll, if `closes_at` is non-null and in the past, the UI treats it as closed (no vote buttons, full results shown). A PATCH to set `is_open = false` fires on first view after expiry.

**Why not a cron job?** Avoids a new scheduled function for MVP. The only downside is that a poll might accept a vote between `closes_at` and the first page load that triggers the close. This is acceptable for community polls — they're not elections.

**TODO:** Add scheduled function later for accurate auto-close.

### 7. Orphan cleanup in delete handlers

When an announcement or forum topic is deleted, its attached poll is also deleted (`DELETE FROM polls WHERE attached_to = X AND attached_id = Y`). This is handled in the existing delete logic for each content type, not via foreign keys or a separate cleanup job.

## Schema

### New tables

```
polls
─────────────────────────────────────
id              SERIAL PRIMARY KEY
question        TEXT NOT NULL
description     TEXT
poll_type       TEXT NOT NULL DEFAULT 'single'    -- 'single' | 'multiple'
is_anonymous    BOOLEAN DEFAULT false
results_visible TEXT NOT NULL DEFAULT 'after_vote' -- 'always' | 'after_vote' | 'after_close'
is_open         BOOLEAN DEFAULT true
closes_at       TIMESTAMPTZ                       -- NULL = no expiry
attached_to     TEXT                              -- 'announcement' | 'forum_topic' | 'section' | NULL
attached_id     INT                               -- ID of parent, or NULL
created_by      INT REFERENCES members(id)
created_at      TIMESTAMPTZ DEFAULT now()

poll_options
─────────────────────────────────────
id              SERIAL PRIMARY KEY
poll_id         INT REFERENCES polls(id) ON DELETE CASCADE
label           TEXT NOT NULL
position        INT NOT NULL

poll_votes
─────────────────────────────────────
id              SERIAL PRIMARY KEY
poll_id         INT REFERENCES polls(id) ON DELETE CASCADE
option_id       INT REFERENCES poll_options(id) ON DELETE CASCADE
member_id       INT REFERENCES members(id)
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(poll_id, member_id, option_id)
```

### Modified tables

- `site_config`: Add rows for `feature_polls` (default true) and `polls_member_create` (default false)

### New Zod schemas (src/schemas/poll.ts)

- `PollSchema`, `PollOptionSchema`, `PollVoteSchema` with inferred types
- Typed wrappers in `src/lib/api.ts`: `getPolls()`, `getPollOptions()`, `getPollVotes()`

## Key Flows

### Vote flow (single-choice)

1. Member clicks option
2. Client sends `DELETE FROM poll_votes WHERE poll_id = X AND member_id = Y`
3. Client sends `INSERT INTO poll_votes (poll_id, option_id, member_id)`
4. Client sends `POST activity_log` with action `poll_vote`
5. Re-render poll widget with updated counts

### Vote flow (multiple-choice)

1. Member toggles option on: `INSERT INTO poll_votes (poll_id, option_id, member_id)`
2. Member toggles option off: `DELETE FROM poll_votes WHERE poll_id = X AND option_id = Z AND member_id = Y`
3. Activity log on each change
4. Re-render poll widget

### Embedded poll fetch (announcement detail)

1. Fetch announcement by ID
2. Fetch `polls?attached_to=eq.announcement&attached_id=eq.{id}`
3. If poll found, fetch `poll_options?poll_id=eq.{poll_id}&order=position.asc`
4. Fetch `poll_votes?poll_id=eq.{poll_id}` (for anonymous polls, strip member_id client-side or use a select param)
5. Call `renderPoll(poll, options, votes, session)` and insert below announcement body

### Results visibility logic

| `results_visible` | Member hasn't voted | Member has voted | Poll closed |
|---|---|---|---|
| `always` | Show bars + counts | Show bars + counts + highlight vote | Show bars + counts |
| `after_vote` | Show options only + total votes | Show bars + counts + highlight vote | Show bars + counts |
| `after_close` | Show options only + "results after close" | Show "your vote" indicator only | Show bars + counts |

## File Changes

### New files

- `src/schemas/poll.ts` — Zod schemas and types
- `src/pages/polls.astro` — Standalone polls page (list + create + vote)
- `src/lib/poll-ui.ts` — Shared `renderPoll()` and `createPollForm()` functions

### Modified files

- `schema.sql` — Add polls, poll_options, poll_votes tables
- `seed.sql` — Add `feature_polls` and `polls_member_create` to site_config
- `src/lib/api.ts` — Add typed poll wrappers
- `src/pages/index.astro` — Add `polls` case to section renderer
- `src/pages/forum.astro` — Add poll attachment to topic creation, render attached polls in topic detail
- `src/pages/event.astro` — (Announcements are rendered here or inline) Add poll widget rendering for attached polls
- `src/components/Nav.astro` or nav config — Add polls nav item (conditional on feature flag)
- `src/pages/admin-settings.astro` — Add polls toggle to feature flags section
- `public/css/styles.css` — Add poll widget styles (progress bars, vote buttons, results display)
