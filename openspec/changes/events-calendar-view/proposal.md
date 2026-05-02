## Why

Today Kychon shows events as a vertical list (`/events.html`) and per-event detail (`/event.html?id=N`). Every club we're absorbing from Wild Apricot has had a **month-grid calendar** as its primary "what's happening?" surface for years — losing it on port-handoff is a visible regression. ODBC's home-nav explicitly groups "Club Calendar" as a top-level item.

Wild Apricot's calendar is competent but unremarkable. The opportunity isn't to copy it — it's to ship the calendar a 2026 club would actually want: multi-lens (month / week / agenda), social-rich (RSVP avatars on cells), frictionless (one-tap add to personal calendar, subscribable feed), inline-editable (drag to reschedule), and natively responsive (real mobile agenda, not a cramped grid). See [#78](https://github.com/kychee-com/kychon/issues/78).

The hero use case is a member opening this on their phone Sunday morning thinking *"what's happening this month?"* — every UX decision is anchored there.

## What Changes

- **New `events_calendar` block** registered in `src/lib/blocks.ts`, lazy-loaded hydrator at `src/lib/blocks/events-calendar.ts` (~10–12 kB minified). Renders the existing `events` table — no schema changes.
- **Three view modes**: Month grid (default desktop), Week strip with horizontal event bars, Agenda (default mobile, vertical day-by-day list). Toggleable via segmented control.
- **Three density modes** for the same data: Glance (1–3 dots per day, fits in 1/3 column), Light (1-line summaries), Rich (cards with thumbnails + RSVP avatars + capacity badges). Container-query driven with admin override.
- **Filter chips**: All / Members-only / Open / My RSVPs / Past — uses existing event flags + `event_rsvps` join for "My RSVPs".
- **Hover peek popover** on day cells (desktop) — see all events on a day without leaving the grid.
- **Bottom sheet** for event peek (mobile) — taller-than-modal, tap "More" to fully navigate to `/event.html?id=N`.
- **Stacked RSVP avatars** on event chips (3 visible + count) for social proof at a glance.
- **Live-now indicator** (pulsing dot) on events currently in `[starts_at, ends_at)`.
- **Capacity badges**: "Filling fast" at ≥80% full, "Sold out" when capped.
- **Today highlight** + dedicated "Today" jump button.
- **Keyboard navigation**: ↑↓←→ to move between days, ⏎ to peek, Esc to close, T = today, M/W/A = view modes, ⌘K = fuzzy search across visible event titles + descriptions.
- **One-tap "Add to my calendar"** — browser-side `.ics` generation per event, no server roundtrip.
- **Subscribable `.ics` feed** via new Run402 edge function `functions/calendar-ics.js` — public events served anonymously, members-only events served via signed token URL. Members get an "Subscribe to this calendar" link in their profile that resolves to `webcal://...`.
- **Locale-aware first day of week** (Sun/Mon based on `getLocale()`) and **visitor's local timezone** for all date/time labels — addresses F9 friction.
- **Inline editing** via existing `data-editable` pattern: title and location editable on event chips for admins.
- **Drag-to-reschedule** (admin) — drag a chip to another day, PATCH `starts_at` / `ends_at` preserving the time-of-day delta. Multi-day events shift both endpoints by the same delta.
- **`/calendar.html` page** — single-section page hosting one full-width `events_calendar` block; provides a deep-linkable surface for the home-nav.
- **LocalStorage SWR cache** keyed `wl_cache_events_yyyy-mm-window` (each cache covers the visible 6-week window). Prefetch ±1 month on idle.
- **Reduced motion respected** — `prefers-reduced-motion: reduce` disables month-transition animations, hover-scale, and the live pulsing dot.

## Capabilities

### Modified Capabilities

- `events` — new requirements for calendar view, ICS feed, calendar page, drag-to-reschedule, RSVP avatar surfacing, and live-now / capacity indicators. Existing requirements (CRUD, RSVP, /events.html list, /event.html detail, capacity enforcement, members-only) are preserved unchanged.

## Impact

- **New files**:
  - `src/lib/blocks/events-calendar.ts` (~10–12 kB minified, lazy-loaded view controller)
  - `src/pages/calendar.astro` (one-section page)
  - `public/css/block-events-calendar.css` (grid + chips + popover + bottom sheet)
  - `functions/calendar-ics.js` (Run402 edge function emitting RFC 5545 feed)
  - `tests/blocks/events-calendar.test.ts`
  - `tests/lib/ics-generator.test.ts`
- **Modified files**:
  - `src/lib/blocks.ts` — register `events_calendar` in `BLOCK_TYPES`, add `EVENTS_CALENDAR` definition
  - `src/lib/block-hydrators.ts` — add `hydrateEventsCalendar` thin wrapper
  - `src/components/AdminEditor.astro` — drag-to-reschedule cross-day handler (additive to existing cross-zone drag)
  - `public/custom/strings/{en,es,pt,fr,de,zh}.json` — ~30 new keys for view/density/filter labels and ARIA strings
  - `src/seeds/types.ts` — `events_calendar` added to `BlockType` union
  - `astro.config.mjs` — no changes needed
- **No schema changes** — `events` and `event_rsvps` tables unchanged. Recurring events tracked at [#79](https://github.com/kychee-com/kychon/issues/79) ships separately.
- **New Run402 dep**: 1 additional edge function (`calendar-ics.js`). Each demo project has 1 prototype-tier function slot already used by `reset-demo.js`; production tiers allow more. Adds `production` to the deploy step's function list.
- **Bundle impact**: Member page load unchanged (calendar JS lazy-loaded only when an `events_calendar` block is present and visible). When loaded, ~12 kB additional + ~3 kB CSS. No Tiptap-style heavy deps.
- **Accessibility**: ARIA `role="grid"` for month view, live region for month-change announcements, full keyboard support, reduced-motion gates.
- **Out of scope** (deferred to follow-up changes):
  - Recurring events ([#79](https://github.com/kychee-com/kychon/issues/79))
  - Map view (needs geocoding)
  - AI "month at a glance" summary
  - Year-at-a-glance ribbon
  - Per-filter subscribable URLs (the v1 feed is whole-calendar)
  - Photo gallery on past events
  - Drag-to-create (paint a date range for a new event)
