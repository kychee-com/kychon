## Context

The polls feature shipped in PR #4 with several implementation quality issues identified during review. All fixes are internal - no user-facing behavior changes, no new features.

## Goals / Non-Goals

**Goals:**

- Eliminate redundant API fetches that cause unnecessary latency
- Add type safety at both SQL and Zod layers for poll enums
- Fix homepage section rendering regression (sync to async)
- Clean up minor code quality issues

**Non-Goals:**

- Changing poll behavior or adding new features
- Modifying the test suite (existing tests cover renderPoll; these fixes are in fetch/write paths)

## Decisions

### 1. Store fetched poll data for listener binding instead of re-fetching

In `polls.astro`, the render loop already fetches options and votes per poll. Store these in a Map and pass to `bindPollVoteListeners` instead of fetching again. Same pattern for homepage `case 'polls'` - store `fetchAndRenderPoll` results and reuse them in the `requestAnimationFrame` callback.

### 2. Use `Promise.all` for homepage section rendering

Change the section rendering loop from sequential `await` to `Promise.all(sections.map(...))`. All sections render in parallel, then append in order. This restores the previous non-blocking behavior while supporting async section types like polls.

### 3. CHECK constraints as ALTER TABLE additions

Add CHECK constraints via `ALTER TABLE ... ADD CONSTRAINT` so existing schema.sql stays idempotent. The constraint names allow `IF NOT EXISTS`-style handling.

### 4. Parallelize poll option creation with `Promise.all`

Replace the sequential `for` loop in `submitPoll` with `Promise.all(data.options.map(...))`. Options are independent rows with no ordering dependency at insert time (position is a column value, not insertion order).

## Risks / Trade-offs

- [CHECK constraint on existing data] → Run402 deploys are additive; if existing data has invalid values, ALTER TABLE will fail. Mitigated: seed.sql only inserts valid values.
- [Promise.all for sections] → If one section fails, all fail. Mitigated: wrap each section in try/catch within the map, same as current behavior.
