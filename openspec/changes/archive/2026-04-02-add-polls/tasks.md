## 1. Database Schema & Seed Data

- [x] 1.1 Add `polls` table to `schema.sql` with columns: id, question, description, poll_type, is_anonymous, results_visible, is_open, closes_at, attached_to, attached_id, created_by, created_at
- [x] 1.2 Add `poll_options` table to `schema.sql` with columns: id, poll_id (FK CASCADE), label, position
- [x] 1.3 Add `poll_votes` table to `schema.sql` with columns: id, poll_id (FK CASCADE), option_id (FK CASCADE), member_id (FK), created_at, UNIQUE(poll_id, member_id, option_id)
- [x] 1.4 Add `feature_polls` (default true) and `polls_member_create` (default false) to `seed.sql` site_config

## 2. Zod Schemas & API Wrappers

- [x] 2.1 Create `src/schemas/poll.ts` with PollSchema, PollOptionSchema, PollVoteSchema and exported types
- [x] 2.2 Add typed wrappers to `src/lib/api.ts`: `getPolls()`, `getPollOptions()`, `getPollVotes()`

## 3. Shared Poll UI Module

- [x] 3.1 Create `src/lib/poll-ui.ts` with `renderPoll(poll, options, votes, session)` function — renders the poll widget HTML with vote bars, buttons, results visibility logic, and anonymous mode handling
- [x] 3.2 Add `createPollForm(container, attachConfig?)` function to `src/lib/poll-ui.ts` — renders the poll creation form with question, dynamic option list (add/remove), poll_type toggle, is_anonymous checkbox, results_visible select, closes_at date picker
- [x] 3.3 Add vote handler functions to `src/lib/poll-ui.ts`: `handleSingleVote(pollId, optionId, memberId)` (delete + insert), `handleMultiVote(pollId, optionId, memberId)` (toggle insert/delete), `checkAutoClose(poll)` (PATCH is_open if expired)

## 4. Poll Styles

- [x] 4.1 Add poll widget styles to `public/css/styles.css`: `.poll-widget`, `.poll-question`, `.poll-option`, `.poll-bar`, `.poll-bar-fill`, `.poll-vote-btn`, `.poll-results`, `.poll-meta`, `.poll-form`, `.poll-closed`

## 5. Standalone Polls Page

- [x] 5.1 Create `src/pages/polls.astro` with Portal layout — list open polls first then closed polls, each rendered with `renderPoll()`
- [x] 5.2 Add poll creation form to `/polls` page — shown for admins always, members when `polls_member_create` is true; uses `createPollForm()` with no attachConfig
- [x] 5.3 Wire up poll creation submit: POST to `polls`, then POST each option to `poll_options`, then POST to `activity_log`

## 6. Embed Polls in Announcements

- [x] 6.1 Modify announcement detail rendering (in the page that shows individual announcements) to fetch attached poll via `polls?attached_to=eq.announcement&attached_id=eq.{id}` and render with `renderPoll()` below the announcement body
- [x] 6.2 Add "Add Poll" button to announcement creation/editing (admin only) that inserts `createPollForm(container, { type: 'announcement', id: null })` inline
- [x] 6.3 Update announcement save handler to create the poll after the announcement is saved, linking via attached_to/attached_id
- [x] 6.4 Update announcement delete handler to also delete attached poll: `del('polls?attached_to=eq.announcement&attached_id=eq.{id}')`

## 7. Embed Polls in Forum Topics

- [x] 7.1 Modify forum topic detail rendering to fetch attached poll via `polls?attached_to=eq.forum_topic&attached_id=eq.{id}` and render with `renderPoll()`
- [x] 7.2 Add "Add Poll" button to forum topic creation form (admin only, or members if `polls_member_create`) that inserts `createPollForm()` inline
- [x] 7.3 Update topic save handler to create the poll after the topic is saved, linking via attached_to/attached_id
- [x] 7.4 Update topic delete handler to also delete attached poll

## 8. Homepage Section

- [x] 8.1 Add `polls` case to `renderSection()` in `src/pages/index.astro` — reads `config.poll_ids`, fetches each poll with options and votes, renders with `renderPoll()`

## 9. Feature Flags & Navigation

- [x] 9.1 Add polls nav item to nav config in `seed.sql` — conditional on `feature_polls`, positioned after existing nav items
- [x] 9.2 Add `feature_polls` toggle to admin settings page feature flags section (auto-populated from feature_* keys)

## 10. Tests

- [x] 10.1 Add unit tests for `src/schemas/poll.ts` — validate schema parsing for valid and invalid poll/option/vote data
- [x] 10.2 Add unit tests for `src/lib/poll-ui.ts` — test `renderPoll()` output for each results_visible mode, anonymous mode, closed state, voted/not-voted states
- [x] 10.3 Add integration test for vote flow — single-choice replace, multi-choice toggle, closed poll rejection
