## Why

The polls feature (PR #4) shipped with redundant API fetches (N+1 queries on the polls page, double-fetches on the homepage), loose type validation (unconstrained TEXT columns and `z.string()` where enums belong), a sync-to-async change that serializes all homepage sections, and several minor code quality issues. These cause unnecessary latency and let invalid data through.

## What Changes

- **Eliminate redundant fetches**: Reuse poll data instead of re-fetching for listener binding on the polls page and homepage polls section
- **Add SQL CHECK constraints**: Constrain `poll_type` and `results_visible` columns to valid enum values
- **Tighten Zod schemas**: Replace `z.string()` with `z.enum()` for `poll_type` and `results_visible`
- **Fix async section rendering**: Keep `renderSection` non-blocking for non-async section types or parallelize with `Promise.all`
- **Remove unused `_attachConfig` parameter** from `createPollForm` or implement its intended behavior
- **Parallelize option creation**: Use `Promise.all` in `submitPoll` instead of sequential `await`s
- **Add `console.warn` to empty catch blocks** for debuggability
- **Add radix to `parseInt`** call in forum.astro

## Capabilities

### New Capabilities

### Modified Capabilities

- `polls`: Tighten schema constraints and fix fetch redundancy (no requirement changes, implementation quality only)

## Impact

- `schema.sql`: Add CHECK constraints to polls table
- `src/schemas/poll.ts`: Enum types for poll_type and results_visible
- `src/lib/poll-ui.ts`: Remove redundant fetches, parallelize option creation, remove unused param
- `src/pages/polls.astro`: Eliminate double vote fetch loop
- `src/pages/index.astro`: Fix async section rendering, reuse poll data for listener binding
- `src/pages/forum.astro`: Add parseInt radix
