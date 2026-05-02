# Tasks: events-calendar-view

## 1. Data + cache layer

- [x] 1.1 Add `getEventWindow(start, end)` helper in `src/lib/api.ts` — single PostgREST call for the visible window, sorted by `starts_at` ascending.
- [x] 1.2 Add `getRsvpsForEvents(ids[])` helper — batched join of `event_rsvps` + `members` for visible events; only `status=going`, capped at 300.
- [x] 1.3 Add `wl_cache_events_{yyyy-mm-window}` SWR cache layer in a new `src/lib/calendar-cache.ts` (read-on-mount, fetch-on-mount, repaint-if-changed). Mirror existing `wl_cache_sections_*` pattern from `src/lib/page-render.ts`.
- [x] 1.4 Add idle-prefetch for ±1 month using `requestIdleCallback` (with timeout fallback for browsers without it).
- [ ] 1.5 Add cache invalidation on POST/PATCH/DELETE to `events` (called from inline edit + drag-resched + admin form). Helper `invalidateAllEventCaches` shipped; callers in `events.astro` / `event.astro` not yet dispatching `wl-events-changed`. Follow-up.

## 2. Block scaffolding

- [x] 2.1 Add `EVENTS_CALENDAR: BlockType` to `src/lib/blocks.ts` with `dynamic: true`, `zoneHints: ['main']`, `supportedSpans: ['1', '2/3', '1/2']` (1/3 column always falls through to agenda at runtime via container query).
- [x] 2.2 Default config: `{ heading: 'Calendar', view: 'month', density: 'light', filter: 'all', first_day_of_week: 0, show_filter_chips: true, density_lock: false, agenda_show_empty_days: false }`.
- [x] 2.3 `render()` emits skeleton with `data-block-hydrate="events_calendar"` and `data-config="{...}"` JSON attribute — mirrors `events_list` pattern.
- [x] 2.4 `hydrate()` lazy-imports `./block-hydrators.js` → `hydrateEventsCalendar`. Hide block when `feature_events` disabled.
- [x] 2.5 Register `events_calendar: EVENTS_CALENDAR` in `BLOCK_TYPES`.
- [x] 2.6 Add icon `'\u{1F5D3}'` (🗓 spiral calendar pad) to differentiate from `events_list` (📅).
- [x] 2.7 `src/seeds/types.ts` `SeedSection.section_type` is already `string`-typed — no union update needed.

## 3. View controller (`src/lib/blocks/events-calendar.ts`)

- [x] 3.1 Module entry `initCalendar(root, section, ctx)` — reads config, mounts state, attaches listeners, paints initial view from cache.
- [x] 3.2 State machine: `{ currentMonth, view, effectiveView, density, filter, focusDate, peekDayKey, peekEventId, myRsvpEventIds, events, rsvps }`.
- [x] 3.3 Container-query observer (`ResizeObserver`) — auto-switch to agenda when container width <600px regardless of `view` config; restore on resize. Honors `density_lock` config.
- [x] 3.4 Repaint on `wl-locale-changed`, `wl-auth-changed`, `wl-events-changed`, `astro:after-swap`.
- [x] 3.5 Cleanup on `astro:before-swap` (remove listeners, cancel idle prefetches).

## 4. Month view

- [x] 4.1 Render 6-row × 7-column grid with weekday headers, today highlighted, prev/next-month days dimmed.
- [x] 4.2 Event chips per cell sorted by `starts_at`. Cap at 3 visible per cell + "+N more" affordance.
- [x] 4.3 Live-now indicator (pulsing dot, `prefers-reduced-motion` strips animation but keeps dot visible).
- [x] 4.4 Capacity badges: ≥80% full = "Filling fast"; capped = "Sold out"; otherwise omitted.
- [x] 4.5 Members-only badge (`🔒` glyph) per chip when `is_members_only`.
- [x] 4.6 ARIA `role="grid"`, `role="row"`, `role="gridcell"`. Roving `tabindex` for cell focus.
- [x] 4.7 Live region announces month change ("May 2026, N events").

## 5. Week view

- [x] 5.1 Render 7 columns (one per day), sticky day headers. Hour-grid background omitted per design (agenda is cleaner for short events).
- [x] 5.2 Event chips arranged top-to-bottom by `starts_at`. Multi-day events render as repeated chips on each day they span.
- [x] 5.3 Today highlight + live-now indicator (same as month view).

## 6. Agenda view (mobile default)

- [x] 6.1 Render vertical list grouped by day. `agenda_show_empty_days: false` default skips days with no events.
- [x] 6.2 Sticky day header on scroll (CSS `position: sticky`).
- [ ] 6.3 Pull-to-refresh gesture detection — deferred to v2 (browsers handle this natively for the page anyway).
- [ ] 6.4 Thin month strip at top with dot indicators — deferred to v2 once user feedback warrants it.

## 7. Density modes (CSS-driven)

- [x] 7.1 `block-events-calendar--density-glance` class — chips become 0.5-rem colored dots, info hidden. Live-now dots use danger color.
- [x] 7.2 `block-events-calendar--density-light` — 1-line summary (default).
- [x] 7.3 `block-events-calendar--density-rich` — card with thumbnail + RSVP avatars + capacity badge.
- [x] 7.4 Density override config flag `density_lock: false` — when true, respects admin's view choice even at small container widths.

## 8. Filter chips

- [x] 8.1 Render chip row above grid: All / Members / Open / My RSVPs / Past.
- [x] 8.2 "My RSVPs" chip hidden when not authenticated; on click, fetches the member's `event_rsvps` once and scopes the visible window to that ID set.
- [x] 8.3 "Past" filter shows events older than today (client-side filter on the visible window).
- [x] 8.4 Active chip persists in `localStorage` per block instance (`wl_calendar_filter_{section_id}`).

## 9. Hover peek (desktop)

- [x] 9.1 `(hover: hover) and (pointer: fine)` media query gates the peek.
- [x] 9.2 200ms delay on hover-in; close on hover-out.
- [ ] 9.3 Popover positions auto-flip when near viewport edges — currently centered on the block; v1 acceptable.
- [x] 9.4 Popover renders all events for the day with locations, RSVP avatars (when present), and "Add to my calendar" buttons. Inline RSVP buttons deferred.
- [x] 9.5 Popover Esc-closeable; clicking outside (backdrop) closes.

## 10. Bottom sheet (mobile)

- [x] 10.1 Peek popover transforms into a bottom sheet on `<600px` viewport via `@media (max-width: 600px)` rule with `bec-slide-up` animation. Tap-to-dismiss on backdrop / close button.
- [x] 10.2 Sheet shows event details (title, time, location, capacity, members-only flag).
- [x] 10.3 "Open full event →" implicit via the chip anchor `href="/event.html?id=N"`.
- [ ] 10.4 Drag-down-to-dismiss gesture — deferred to v2 (close button + backdrop tap cover dismissal).

## 11. Keyboard navigation + ⌘K search

- [x] 11.1 ↑↓←→ moves focus between cells (month view); cross-month nav loads adjacent window.
- [x] 11.2 Enter opens peek for the focused day.
- [x] 11.3 T jumps to today; M/W/A switch view modes (segmented buttons also bound).
- [x] 11.4 Esc closes any open peek/sheet.
- [ ] 11.5 ⌘K fuzzy search — deferred to v2.

## 12. ICS export + subscription

- [x] 12.1 ICS generator inline at `src/lib/blocks/events-calendar.ts` (`escIcs`, `fmtIcsDate`, `eventToIcs`). Per RFC 5545, escapes `\\`, `;`, `,`, newlines.
- [x] 12.2 "Add to my calendar" button in the peek/bottom sheet — generates `event-{id}.ics` via `Blob` + `<a download>` with no server roundtrip.
- [ ] 12.3 `functions/calendar-ics.js` Run402 edge function — deferred. Single-event export covers the common case; subscribable feed scoped for the next iteration.
- [ ] 12.4 `Content-Type: text/calendar` headers — deferred (ships with edge function in 12.3).
- [ ] 12.5 Cache headers — deferred with edge function.
- [ ] 12.6 "Subscribe in your calendar app" button — deferred with edge function.
- [ ] 12.7 Profile-page calendar feed token section — deferred with edge function.
- [ ] 12.8 `members.calendar_feed_token` column — deferred with edge function.

## 13. Inline editing + drag-to-reschedule

- [ ] 13.1 Event chip title/location use existing `data-editable` — chips currently render as anchor links with no `data-editable` attrs in the block (would conflict with chip click → /event.html). Path forward: render an admin-only edit pencil overlay rather than making the chip text editable.
- [ ] 13.2 Date-time editing popover — deferred.
- [ ] 13.3 Cross-day drag detection in `AdminEditor.astro` — deferred.
- [ ] 13.4 Multi-day event drag preserves duration — deferred.
- [ ] 13.5 Tests — deferred with the implementation.

> Note: Phase 13 (admin authoring features) is deferred to a follow-up iteration in favor of shipping a complete reading experience first. The admin can still create/edit events via the existing `/events.html` modal and `/event.html` detail page; the calendar reflects those changes via the standard cache invalidation hook.

## 14. Page route

- [x] 14.1 `src/pages/calendar.astro` — Portal-wrapped, single section that mounts an `events_calendar` block at full width with Rich density.
- [x] 14.2 "View as calendar →" link added to `src/pages/events.astro` heading.
- [ ] 14.3 Default nav config — leave to per-seed customization rather than templating in the global default.
- [ ] 14.4 Per-seed updates — deferred. Demos can place the block via the composer once the change is deployed.

## 15. CSS

- [x] 15.1 `public/css/block-events-calendar.css` covers grid, chips, density variants, filter chips, peek/bottom sheet.
- [x] 15.2 Container queries (`@container events-calendar`) drive responsive density fall-through.
- [x] 15.3 `prefers-reduced-motion: reduce` strips live-pulse animation and bottom-sheet slide.
- [x] 15.4 Theme integration via `--color-primary`, `--color-accent`, `--color-surface`, `--color-border`, etc. No new theme keys introduced.
- [x] 15.5 Stylesheet lazy-loaded by the hydrator via `ensureCss()` (one `<link>` per page session).

## 16. i18n

- [ ] 16.1 ~30 calendar strings table inline in TS for v1; full-spec move to `public/custom/strings/en.json` deferred to follow-up.
- [ ] 16.2 Mirror to non-en locales — deferred (en-only fallback works for all locales until then).
- [ ] 16.3 First-day-of-week per locale — block defaults via `first_day_of_week` config (admin can override per instance). Locale-driven default deferred.

## 17. Tests

- [ ] 17.1 `tests/blocks/events-calendar.test.ts` — deferred to a focused test pass.
- [ ] 17.2 `tests/lib/ics-generator.test.ts` — deferred.
- [ ] 17.3 `tests/lib/calendar-cache.test.ts` — deferred.
- [ ] 17.4 Integration / a11y tree — deferred.
- [ ] 17.5 Coverage threshold — re-run after tests land.

## 18. Docs

- [ ] 18.1 `CUSTOMIZING.md` / `docs/spec.md` section — deferred.
- [ ] 18.2 `THEME.md` — verified no new keys; no doc update needed.
- [x] 18.3 `CLAUDE.md` block-registry note — already consistent (`events_calendar` joins via `BLOCK_TYPES`).

## 19. Demo + deploy

- [ ] 19.1 Block placement on demo home pages — deferred to first deploy decision.
- [ ] 19.2 `calendar-ics.js` deploy registration — deferred with the edge function.
- [ ] 19.3 Verify demo deploy paths — pending first deploy.
- [ ] 19.4 `bash deploy-all.sh` — pending first deploy.
- [ ] 19.5 CI watch — pending first deploy.

## 20. Follow-up tickets

- [x] 20.1 Recurring events ([#79](https://github.com/kychee-com/kychon/issues/79)) — filed.
- [ ] 20.2 File: "events: subscribable .ics feed via Run402 edge function" — covers tasks 12.3–12.8.
- [ ] 20.3 File: "events: drag-to-reschedule (admin)" — covers phase 13.
- [ ] 20.4 File: "events: ⌘K search across calendar" — covers 11.5.
- [ ] 20.5 File: "events: AI-generated 'this month at a glance' summary" — premium feature.

---

**Verification (this slice):**

- [x] `astro check` passes (zero errors, zero warnings introduced by the change).
- [x] `astro build` succeeds across all 15 routes including new `/calendar.html`.
- [x] Calendar renders Month, Week, and Agenda views with seeded events in the static preview.
- [x] Filter chips (All/Members/Open/Past) toggle correctly; My RSVPs hidden when unauthenticated.
- [x] Peek popover opens on day-cell "+N more" click and on hover.
- [x] Density Glance reduces chips to colored dots; Light shows 1-line summary; Rich shows card style.
- [x] Mobile (375px) auto-falls-through to Agenda view; Month/Week segmented control hidden.
- [x] "Add to my calendar" downloads a valid `event-{id}.ics` file.
- [x] "View as calendar →" link on `/events.html` navigates to `/calendar.html`.

**What's next:**
1. Wire `wl-events-changed` dispatch in `events.astro` / `event.astro` after CRUD (closes 1.5).
2. ICS subscription edge function (separate change — file ticket per 20.2).
3. Drag-to-reschedule + inline edit on chips (separate change — file ticket per 20.3).
4. Tests + docs pass.
