## 1. Schema & Type Safety

- [x] 1.1 Add CHECK constraints to `schema.sql` for `polls.poll_type` (single/multiple) and `polls.results_visible` (always/after_vote/after_close)
- [x] 1.2 Change `poll_type` and `results_visible` in `src/schemas/poll.ts` from `z.string()` to `z.enum()`

## 2. Eliminate Redundant Fetches

- [x] 2.1 In `src/pages/polls.astro` `renderPollsList()`: store options/votes from the render loop in a Map and reuse for `bindPollVoteListeners` instead of re-fetching votes
- [x] 2.2 In `src/pages/index.astro` `case 'polls'`: store `fetchAndRenderPoll` results and reuse in `requestAnimationFrame` callback instead of re-fetching

## 3. Async Section Rendering

- [x] 3.1 In `src/pages/index.astro`: change section rendering from sequential `await` to `Promise.all(sections.map(...))` so sections render in parallel

## 4. Code Quality Fixes

- [x] 4.1 In `src/lib/poll-ui.ts`: remove unused `_attachConfig` parameter from `createPollForm` or drop the underscore and use it
- [x] 4.2 In `src/lib/poll-ui.ts` `submitPoll`: replace sequential option creation loop with `Promise.all`
- [x] 4.3 Add `console.warn` to empty `catch {}` blocks in `poll-ui.ts`, `polls.astro`, `index.astro`, and `forum.astro`
- [x] 4.4 In `src/pages/forum.astro`: add radix 10 to `parseInt(topicId)` call

## 5. Verify

- [x] 5.1 Run `npx astro check` — 0 type errors
- [x] 5.2 Run test suite — all tests pass
