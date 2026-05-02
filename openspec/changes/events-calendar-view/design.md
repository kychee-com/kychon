# Design: events-calendar-view

## Context

Kychon's events surface today is two routes: `/events.html` (vertical list) and `/event.html?id=N` (detail). The block registry already has `events_list` (a sidebar/grid/list block) and `event_countdown` (next-event widget). The composable layout system means any new "view" of events is just another block type.

The hero use case is **a member orienting themselves**: opening the site on a phone Sunday morning, asking "what's this month?" — not an admin curating events. Every design decision is anchored there.

## Goals

1. Replace Wild Apricot's month-grid widget cleanly so port-handoff has zero visible regression on the calendar surface.
2. Land the calendar as a *block*, not a one-off page — admins can place "Glance" sidebar calendars on the home page and a "Rich" full-width one at `/calendar.html` from the same code.
3. Hit a 2026 standard for community calendars (multi-lens, social, frictionless add-to-personal-calendar) without bloating member page weight.
4. Preserve every existing event flow (`/events.html`, `/event.html`, RSVP, members-only, capacity) unchanged.

## Non-goals

- Recurring events (tracked separately at [#79](https://github.com/kychee-com/kychon/issues/79); ships immediately after this change).
- Map view (needs geocoding strategy + Leaflet).
- AI summaries.
- Year-at-a-glance ribbon (deferred until v1 has real usage).
- Drag-to-create (paint a range to make a new event).

## Architecture

### Block + Page

```
                       events_calendar BLOCK
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ render()       │    │  hydrate()       │    │   /calendar.html │
│   skeleton +   │    │   lazy load      │    │   single-section │
│   data-config  │    │   blocks/events- │    │   page hosting   │
│                │    │   calendar.ts    │    │   one block      │
└────────────────┘    └────────┬─────────┘    └──────────────────┘
                               │
        ┌──────────────────────┼─────────────────────────────┐
        ▼                      ▼                             ▼
┌─────────────┐      ┌──────────────────┐          ┌───────────────────┐
│  data       │      │  view modes      │          │   side effects    │
│             │      │                  │          │                   │
│ PostgREST   │      │  month-grid      │          │   ICS gen         │
│ window      │      │  week-strip      │          │   (browser)       │
│ query       │      │  agenda-list     │          │                   │
│             │      │                  │          │   ICS feed        │
│ wl_cache_   │      │  density:        │          │   (edge fn)       │
│  events_    │      │   glance/light/  │          │                   │
│  yyyy-mm-   │      │   rich           │          │   inline editing  │
│  window     │      │                  │          │   drag-to-resched │
│ (SWR)       │      │  responsive      │          │                   │
└─────────────┘      │  fall-through    │          │   keyboard / ⌘K   │
                     └──────────────────┘          └───────────────────┘
```

The dedicated page `/calendar.html` is just a Portal-wrapped single section that hosts an `events_calendar` block. Identical code path to placing the block via the composer.

### File map

```
src/
├── lib/
│   ├── blocks.ts                       (+EVENTS_CALENDAR registry entry)
│   ├── block-hydrators.ts              (+hydrateEventsCalendar wrapper)
│   └── blocks/
│       └── events-calendar.ts          NEW ~10-12 kB minified
├── pages/
│   └── calendar.astro                  NEW
└── components/
    └── AdminEditor.astro               (+cross-day drag handler)

public/
├── css/
│   └── block-events-calendar.css       NEW ~3 kB
└── custom/
    └── strings/{en,es,pt,fr,de,zh}.json (+~30 keys)

functions/
└── calendar-ics.js                     NEW Run402 edge function

tests/
├── blocks/
│   └── events-calendar.test.ts         NEW
└── lib/
    └── ics-generator.test.ts           NEW
```

### Data layer

One PostgREST query per visible window:

```ts
// 6-week visible window (with leading/trailing days from prev/next month)
const start = startOfWeek(startOfMonth(currentMonth), firstDayOfWeek);
const end = endOfWeek(endOfMonth(currentMonth), firstDayOfWeek);
const query = `events?starts_at=gte.${start.toISOString()}&starts_at=lt.${end.toISOString()}&order=starts_at.asc`;
```

For RSVP avatars, we need attendees per event. We do NOT join in the per-month query (would balloon payload). Instead, on hover-peek of a day cell or on rendering Rich density, we fire one extra query:

```ts
const ids = visibleEventIds.join(',');
const rsvps = await get(`event_rsvps?event_id=in.(${ids})&status=eq.going&select=event_id,members(id,display_name,avatar_url)&limit=300`);
```

This is one extra request per visible window, gated on density. Cached separately as `wl_cache_rsvps_{window}`.

### Cache strategy (stale-while-revalidate)

```
Read:    cache hit → render immediately
              ↓
              fire fetch in background
              ↓
              if response differs → re-render

Write:   admin RSVP / drag-resched / inline-edit
              ↓
              optimistic update local state
              ↓
              PATCH/POST
              ↓
              on success → invalidate the affected window cache
              on failure → revert + toast
```

### Rendering pipeline (month view)

```
build-time     ─── nothing ───  (block is dynamic, emits skeleton only)
                                                │
                                                ▼
runtime hydrate → readSWRCache(window) → paint immediately
                                                │
                                                ▼
                  fetch(window) ─── compare ─── repaint if changed
                                                │
                                                ▼
                  fetch(rsvps for window) ─── paint avatars on chips
                                                │
                                                ▼
                  on idle: prefetch(prev_window, next_window)
```

### Responsive behavior

```
Container width        Default view              Density override
─────────────────────  ───────────────────────  ───────────────────
≥ 900px (full)         Month grid               Rich (admin override → Light/Glance)
600–899px (medium)     Month grid (smaller)     Light
< 600px (mobile)       Agenda (forced)          Light
```

Container queries (`@container (min-width: 600px)`) on the block root drive this. Admin can pin a view via config but the renderer respects container floor — Glance density at 1/3 column never tries to draw 7 columns.

### View transitions

```
Month → next month       slide-fade (CSS transitions, gated on prefers-reduced-motion)
View mode toggle         crossfade (200ms)
Day cell → bottom sheet  slide-up (mobile) / fade-in popover (desktop)
```

We use the View Transitions API where supported (already shipping via Astro's `ClientRouter` — but for in-block transitions we call the API directly). Fallback: instant swap when `document.startViewTransition` is undefined.

### Keyboard map

```
←  →           prev / next day
↑  ↓           prev / next week (or prev / next event in agenda)
⏎              open peek popover (desktop) or bottom sheet (mobile)
Esc            close peek / bottom sheet
T              jump to today
M / W / A      switch to Month / Week / Agenda view
⌘K (Ctrl+K)    open fuzzy search across visible events
←  →   (when peek open)   navigate between events on the same day
```

ARIA: month grid uses `role="grid"`, rows use `role="row"`, cells use `role="gridcell"`. Cell focus management via roving `tabindex`. Live region announces month change ("May 2026, week 18, 12 events this month").

### ICS subscription (`functions/calendar-ics.js`)

Run402 edge function. Two modes:

**Public** — anonymous GET, returns only events where `is_members_only = false`:
```
GET /api/calendar.ics
Cache-Control: public, max-age=300
Content-Type: text/calendar
```

**Members-only** — token-bound GET, returns all events:
```
GET /api/calendar.ics?token={signed-token-for-member-id}
Cache-Control: private, no-store
```

Token is generated when a member clicks "Subscribe to my calendar feed" in their profile — server-signed JWT bound to `member_id`, no expiry (revocable via a `calendar_feed_revoked_at` column on `members`, set null by default; revocation is V2 — for V1 the token is bound to the auth account and can be regenerated by the member, invalidating the old one).

The feed body uses RFC 5545 `VEVENT` per event:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kychon//ODBC//EN
NAME:Old Dominion Boat Club
X-WR-CALNAME:Old Dominion Boat Club
REFRESH-INTERVAL;VALUE=DURATION:PT1H
BEGIN:VEVENT
UID:event-{id}@{domain}
DTSTART:{starts_at-utc}
DTEND:{ends_at-utc}
SUMMARY:{title}
LOCATION:{location}
DESCRIPTION:{description-stripped}
URL:https://{domain}/event.html?id={id}
END:VEVENT
...
END:VCALENDAR
```

Single-event one-tap export uses the same builder running in the browser — no server call needed.

### Drag-to-reschedule (admin)

Builds on existing `AdminEditor.astro` cross-zone drag pattern. New: when an `events_calendar` block detects a drop on a different day cell (vs. a different zone):

1. Compute time-of-day from `starts_at` (and duration to `ends_at` if present).
2. Anchor the drop day to that time-of-day → new `starts_at`.
3. New `ends_at = new_starts_at + (old_ends_at - old_starts_at)`.
4. PATCH single event row.
5. Invalidate window cache, re-render.
6. On error: revert + toast.

DST is handled implicitly because we shift by absolute duration, not by `Date.setDate`.

### Container Q&A

Q: What if the admin places `events_calendar` at `column_span: '1/3'` and pins view mode to "month"?
A: Container query forces agenda. Tooltip on the admin pill explains: "This view auto-switches to Agenda below 600px width."

Q: What about overlapping multi-day events in week view?
A: Stacked horizontal bars, max 3 visible + "+N more" link to peek. Same pattern as Apple Calendar.

Q: How does this interact with `feature_events`?
A: Block hides itself when `feature_events` is disabled (same as `events_list` and `event_countdown`).

Q: What about the existing `/events.html`?
A: Untouched. We add a "View as calendar →" link at the top, linking to `/calendar.html`. Visitors who prefer a list still have it.

## Risks / Trade-offs

### A. Bundle size

~12 kB calendar JS + ~3 kB CSS lazy-loaded only when an `events_calendar` block hydrates. A page without the block pays nothing. A page with the block pays once (cached after).

**Mitigation**: Internal date math uses native `Intl.DateTimeFormat` and `Date` — no `date-fns` or `dayjs` dep.

### B. ICS feed is new infra

This is the first edge function in Kychon that returns a non-JSON content type. We follow the existing pattern from `reset-demo.js` for boilerplate but the response uses `Content-Type: text/calendar` and a custom body builder.

**Mitigation**: The builder is pure — testable in isolation as `tests/lib/ics-generator.test.ts`. The edge function is a thin wrapper.

### C. Drag-to-reschedule conflicts with cross-zone drag

The composer already supports dragging blocks across zones. Inside a calendar block, dragging an event chip should NOT trigger a cross-zone block move.

**Mitigation**: Event chips have `draggable="true"` with `data-event-id` and stop propagation on `dragstart`. The cross-zone handler explicitly ignores drags originating from `[data-event-id]`. Documented in `AdminEditor.astro`.

### D. Hover popover on touch devices

Touch devices fire `mouseenter` weirdly. Day-cell hover should not trigger anything on touch.

**Mitigation**: `(hover: hover) and (pointer: fine)` media query gates the popover. Touch devices get tap → bottom sheet directly (no peek state).

### E. RSVP avatars query is a second round-trip

For Rich density, we make a second request per window for RSVP attendees. On a slow connection, the chips render without avatars first, then avatars pop in.

**Mitigation**: Avatars use `<img loading="lazy">` and a fade-in transition (gated on reduced-motion). The "card without avatars yet" state still has the count number, so it's never wrong — just thinner.

### F. Subscribed iPhone calendar doesn't get recurring events right (yet)

Without RRULE expansion (recurring events deferred to [#79](https://github.com/kychee-com/kychon/issues/79)), each event is a one-off VEVENT. Members subscribed via webcal:// will see every weekly board meeting as a separate one-off, which is fine for this version but suboptimal.

**Mitigation**: Document on the "Subscribe" UX that subscriptions get all events as one-offs until recurring lands. Once #79 lands, the ICS feed emits proper RRULEs and existing subscriptions self-update.

## Migration

No data migration. No schema changes. No deprecations.

The existing `/events.html` and `/event.html` routes are unchanged. The block registry gains one entry. The composer immediately offers `events_calendar` as a placement option in any zone (with `zoneHints: ['main']`).

Demo seeds (`silver-pines`, `eagles`, `barrio-unido`, `kychon`) get an optional `events_calendar` block on their home pages — pre-seeded only on first deploy after this change lands. Existing deploys are unaffected unless the admin manually adds the block.

## Open questions

1. **Should the "Subscribe to feed" link live on `/profile`, in the page footer, or as a button inside the calendar block?** My instinct: button inside the calendar block (next to the view/density toggle), labeled "Subscribe in your calendar app". Discoverable where it matters.
2. **Do we want a "Featured" filter chip** for events with a `is_featured` flag? The schema doesn't have that column today (noted in the archived `block-types-catalog` design). Defer until real demand.
3. **Should multi-day events render as bars in month view (Google Cal style) or as repeated chips per day (Apple Cal style)?** Bars are cleaner visually; chips are simpler to implement. v1 ships chips, v2 considers bars if real events have multi-day spans.
