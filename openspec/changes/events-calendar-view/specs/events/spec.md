## ADDED Requirements

### Requirement: Events Calendar Block

The system SHALL register an `events_calendar` block in the block registry. The block SHALL render the existing `events` table as a calendar surface with three switchable view modes (Month / Week / Agenda) and three switchable density modes (Glance / Light / Rich) without requiring schema changes. The block SHALL be placeable in any zone supporting `main` zoneHint and SHALL adhere to the same lazy-hydration pattern as `events_list` and `event_countdown`.

#### Scenario: Composer offers events_calendar as a placement option

- **WHEN** an admin opens the block picker on a page with `feature_events` enabled
- **THEN** `events_calendar` SHALL appear as a selectable block type
- **AND** placing it SHALL emit a skeleton at build time and hydrate at runtime via the lazy view controller

#### Scenario: Block hides when feature flag disabled

- **WHEN** a member loads a page containing an `events_calendar` block
- **AND** `feature_events` is `false` in `site_config`
- **THEN** the block SHALL set `display: none` and SHALL NOT fetch event data

#### Scenario: Visitor switches view mode

- **WHEN** a member clicks the Week button in the segmented view-mode control
- **THEN** the block SHALL re-render the visible window as a 7-column day strip
- **AND** the selected view SHALL persist for the page session

### Requirement: Calendar Page Route

The system SHALL expose a dedicated `/calendar.html` route that hosts a single full-width `events_calendar` block in Rich density. The route SHALL share all rendering code with composer-placed instances and SHALL be deep-linkable from the navigation.

#### Scenario: Visitor opens /calendar.html

- **WHEN** a visitor navigates to `/calendar.html`
- **THEN** the page SHALL render with the standard Portal layout chrome
- **AND** the main content area SHALL contain one `events_calendar` block configured for full width and Rich density

### Requirement: Responsive Density Fall-Through

The block SHALL respect a container-width floor: at container widths below 600px the block SHALL render in Agenda view regardless of the admin-configured `view` setting, unless the admin sets `density_lock: true` in the block config. Above 900px the block SHALL render in the admin-configured view; between 600px and 900px the block MAY apply a smaller font scale but SHALL preserve the configured view.

#### Scenario: Sidebar block in narrow column

- **WHEN** an admin places `events_calendar` in a 1/3-column slot with `view: 'month'` configured
- **THEN** the block SHALL fall through to Agenda view at runtime
- **AND** SHALL NOT attempt to render a 7-column grid

#### Scenario: Mobile viewport

- **WHEN** a visitor with a viewport width of 360px loads a page with `events_calendar`
- **THEN** the block SHALL render in Agenda view
- **AND** the day-by-day list SHALL use sticky day headers on scroll

### Requirement: Filter Chips for Visible Events

The block SHALL render a filter chip row above the grid offering: All, Members-only, Open, My RSVPs, and Past. The "My RSVPs" chip SHALL be hidden for unauthenticated visitors. The active filter SHALL persist in `localStorage` per block instance.

#### Scenario: Visitor filters to open events

- **WHEN** a visitor clicks the Open chip
- **THEN** the block SHALL hide events with `is_members_only = true`
- **AND** the chip SHALL display an active state

#### Scenario: Authenticated member filters to their RSVPs

- **WHEN** an authenticated member clicks My RSVPs
- **THEN** the block SHALL re-query events filtered by the member's `event_rsvps`
- **AND** SHALL display only events where the member has any RSVP status (going or maybe)

#### Scenario: Anonymous visitor sees no My RSVPs chip

- **WHEN** an anonymous visitor loads the calendar
- **THEN** the My RSVPs chip SHALL NOT be rendered

### Requirement: Live-Now Indicator

Events whose current time falls within `[starts_at, ends_at)` (or whose `ends_at` is null and `starts_at` is within the last 2 hours) SHALL display a "Live now" indicator on their chip — a colored pulsing dot plus a localized "Live" label visible to assistive tech via ARIA. The pulsing animation SHALL be removed when `prefers-reduced-motion: reduce` is set, but the dot itself SHALL remain visible.

#### Scenario: Event currently in progress

- **WHEN** the current time is between an event's `starts_at` and `ends_at`
- **THEN** the chip SHALL show a Live indicator
- **AND** screen-reader users SHALL hear "Live now"

#### Scenario: Reduced-motion user sees indicator without animation

- **WHEN** a visitor with `prefers-reduced-motion: reduce` views a live event chip
- **THEN** the indicator dot SHALL be visible and colored
- **AND** the dot SHALL NOT pulse or animate

### Requirement: Capacity Badges

Events with `capacity` set SHALL display a contextual badge: "Filling fast" when the going-count is at least 80% of capacity, and "Sold out" when going-count equals or exceeds capacity. Events without a capacity SHALL display no capacity badge.

#### Scenario: Event near capacity

- **WHEN** an event has `capacity = 50` and 41 going RSVPs
- **THEN** the chip SHALL display a "Filling fast" badge

#### Scenario: Event at capacity

- **WHEN** an event has `capacity = 50` and 50 going RSVPs
- **THEN** the chip SHALL display a "Sold out" badge

### Requirement: Stacked RSVP Avatars

In Rich density mode, event chips SHALL display up to 3 stacked attendee avatars plus a `+N` count for additional going RSVPs. Avatars SHALL be drawn from `members.avatar_url`; members without avatars SHALL be represented by a colored initial circle. Avatars SHALL fade in after the chip renders to avoid blocking initial paint.

#### Scenario: Event with 8 attendees in Rich density

- **WHEN** an event has 8 going RSVPs and the block is in Rich density
- **THEN** the chip SHALL show 3 avatars stacked
- **AND** the chip SHALL show "+5" next to the avatars

#### Scenario: Event with no attendees in Rich density

- **WHEN** an event has 0 going RSVPs
- **THEN** the chip SHALL omit the avatar block entirely
- **AND** SHALL NOT show "+0"

### Requirement: Hover Peek Popover (Desktop)

On devices reporting `(hover: hover) and (pointer: fine)`, hovering a day cell with at least one event SHALL display a popover after a 200ms delay listing all events on that day with thumbnails, RSVP avatars, and inline RSVP buttons. The popover SHALL auto-flip its position when near a viewport edge. The popover SHALL close on Escape, on click outside, or when the cursor leaves both cell and popover for more than 150ms.

#### Scenario: Desktop user hovers a day with three events

- **WHEN** a user hovers a day cell containing three events for at least 200ms
- **THEN** a popover SHALL appear showing all three events
- **AND** each event SHALL show its title, time, and going count

#### Scenario: Touch device tapping a day

- **WHEN** a touch user taps a day cell
- **THEN** a peek popover SHALL NOT appear
- **AND** the bottom sheet SHALL open instead

### Requirement: Bottom Sheet for Event Detail (Mobile)

On mobile viewports (width <600px), tapping an event chip SHALL open a bottom sheet sliding up from the bottom of the viewport showing full event detail (title, formatted date/time in the visitor's timezone, location, description, RSVP buttons for authenticated members, attendee avatars). The bottom sheet SHALL include a "Open full event →" link to `/event.html?id={id}` and SHALL be dismissible by tap-on-backdrop or drag-down gesture.

#### Scenario: Mobile user taps an event chip

- **WHEN** a mobile user taps an event chip
- **THEN** the bottom sheet SHALL slide up from the bottom of the viewport
- **AND** SHALL display the event detail without navigating away from the calendar

#### Scenario: Drag-down dismisses the bottom sheet

- **WHEN** the bottom sheet is open and the user drags it downward by at least 100px
- **THEN** the sheet SHALL animate closed
- **AND** the user SHALL remain on the calendar page

### Requirement: Today Highlight and Jump Button

The block SHALL visually distinguish today's date in the grid (e.g., a colored border or background tint using `--color-accent`). A dedicated "Today" button SHALL be visible in the block's control row; clicking it SHALL set the visible window to the current month and focus today's cell.

#### Scenario: Visitor jumps to today from a past month

- **WHEN** a visitor is viewing March 2026 and clicks the Today button
- **AND** the current month is May 2026
- **THEN** the visible window SHALL change to May 2026
- **AND** focus SHALL move to today's cell

### Requirement: Keyboard Navigation

The Month and Week views SHALL support keyboard navigation conforming to the ARIA grid pattern. The Agenda view SHALL support arrow-key navigation between event cards. The block SHALL globally support: `T` jumps to today, `M`/`W`/`A` switch between Month/Week/Agenda views, `⌘K` (or `Ctrl+K` on non-Mac) opens fuzzy search, and `Esc` closes any open peek/sheet.

#### Scenario: Keyboard user navigates the month grid

- **WHEN** a keyboard user has focus on a day cell
- **AND** presses ArrowRight
- **THEN** focus SHALL move to the next day cell
- **AND** the previously-focused cell SHALL release `tabindex=0`

#### Scenario: Keyboard user opens search

- **WHEN** a user presses `Cmd+K` on Mac or `Ctrl+K` on other platforms while the calendar block has focus
- **THEN** a fuzzy search input SHALL appear
- **AND** typing SHALL filter visible events by title and description

### Requirement: Local Timezone and Locale-Aware Display

All date and time labels in the calendar block SHALL render in the visitor's local timezone using `Intl.DateTimeFormat` with the active locale. The first day of the week SHALL default per locale (Sunday for en-US/pt-BR, Monday for en-GB/fr/de/es/zh) and SHALL be overridable via the block's `first_day_of_week` config.

#### Scenario: Visitor in en-GB sees Monday as first column

- **WHEN** a visitor with locale `en-GB` loads a Month view
- **AND** the block has no `first_day_of_week` override
- **THEN** the first weekday column SHALL be Monday

#### Scenario: Event time displays in visitor's timezone

- **WHEN** an event has `starts_at = "2026-05-09T15:00:00Z"`
- **AND** the visitor's browser timezone is `America/New_York`
- **THEN** the chip SHALL display the time as 11:00 AM (or local equivalent)

### Requirement: One-Tap Add to Calendar (Browser-Side ICS)

Each event chip and the bottom sheet detail SHALL provide an "Add to my calendar" affordance. Clicking it SHALL generate an RFC 5545–compliant `.ics` file in the browser without a server roundtrip and offer it as a download named `event-{id}.ics`. Special characters in title, description, and location SHALL be properly escaped per RFC 5545.

#### Scenario: Visitor downloads a single-event ICS

- **WHEN** a visitor clicks "Add to my calendar" on an event chip
- **THEN** a `.ics` file SHALL be downloaded immediately
- **AND** the file SHALL parse correctly when opened in iCal, Outlook, and Google Calendar

#### Scenario: Event with special characters in title

- **WHEN** an event title contains commas, semicolons, or newlines
- **THEN** the generated VEVENT SUMMARY SHALL escape them per RFC 5545
- **AND** parsing the file SHALL recover the original title verbatim

### Requirement: Subscribable Calendar Feed (Edge Function)

The system SHALL expose a `/api/calendar.ics` endpoint via the Run402 edge function `functions/calendar-ics.js`. Without a `token` query parameter, the endpoint SHALL return only events where `is_members_only = false`. With a valid signed `token` parameter bound to a `member_id`, the endpoint SHALL return all events including members-only. The response SHALL set `Content-Type: text/calendar; charset=utf-8` and SHALL include `REFRESH-INTERVAL;VALUE=DURATION:PT1H`.

#### Scenario: Anonymous subscriber gets public events only

- **WHEN** a request is made to `/api/calendar.ics` without a `token` query
- **THEN** the response SHALL include only events with `is_members_only = false`
- **AND** the `Content-Type` header SHALL be `text/calendar; charset=utf-8`

#### Scenario: Member subscriber with valid token gets all events

- **WHEN** a request is made to `/api/calendar.ics?token=...` with a token signed for `member_id = 42`
- **AND** member 42 has access to members-only events
- **THEN** the response SHALL include all events including members-only

#### Scenario: Invalid token degrades to public feed

- **WHEN** a request is made with a malformed or expired `token`
- **THEN** the response SHALL fall back to the anonymous public-events feed
- **AND** SHALL NOT return a 4xx error

### Requirement: Subscription URL Surfaced to Members

Members SHALL be able to obtain their personal `webcal://` subscription URL from the calendar block via a "Subscribe in your calendar app" button. Clicking the button SHALL copy the URL (with the member's signed token) to the clipboard and surface a toast confirmation. The same URL SHALL also be surfaced on the `/profile` page with a "Regenerate token" affordance that invalidates the prior token.

#### Scenario: Member copies their subscription URL

- **WHEN** an authenticated member clicks "Subscribe in your calendar app"
- **THEN** the member's personal `webcal://` URL SHALL be written to the clipboard
- **AND** a success toast SHALL appear

#### Scenario: Member regenerates their token

- **WHEN** a member clicks "Regenerate token" on /profile
- **THEN** a new token SHALL be issued
- **AND** the previously-issued token SHALL no longer authenticate the feed endpoint

### Requirement: Inline Event Editing on Chips

When an admin views the calendar block, event chips SHALL expose `data-editable` attributes on the title and location elements consistent with the existing inline-editing system. Date and time editing SHALL be available via a popover with native `datetime-local` inputs reachable from a click on the chip's date label.

#### Scenario: Admin edits a chip title in place

- **WHEN** an admin clicks the title text of an event chip and types
- **THEN** the change SHALL be saved via the existing inline-editing PATCH flow
- **AND** the chip SHALL update without a page reload

### Requirement: Drag-to-Reschedule (Admin)

Admins SHALL be able to drag an event chip from one day cell to another. On drop, the system SHALL preserve the time-of-day and duration of the event and PATCH the affected event's `starts_at` and `ends_at` (where present) by the same date delta. Multi-day events SHALL move both endpoints by the same delta. Failed PATCHes SHALL revert the optimistic update and surface a toast.

#### Scenario: Admin drags single-day event to a new date

- **WHEN** an admin drags an event scheduled for Tuesday May 5 at 10:00 AM to the cell for Thursday May 7
- **THEN** the event's `starts_at` SHALL update to Thursday May 7 at 10:00 AM (visitor-local)
- **AND** the event's `ends_at` (if set) SHALL shift by the same +2-day delta

#### Scenario: Multi-day event drag preserves duration

- **WHEN** an admin drags a 3-day event from May 5–7 to May 12
- **THEN** the event SHALL be rescheduled to May 12–14
- **AND** the duration SHALL remain exactly 3 days

#### Scenario: Drag onto same day is a no-op

- **WHEN** an admin drags an event chip back onto its original day cell
- **THEN** no PATCH SHALL be issued
- **AND** the chip SHALL render in its original position

#### Scenario: Drag does not trigger cross-zone block move

- **WHEN** an admin drags an event chip across calendar day cells
- **THEN** the cross-zone drag handler defined in `AdminEditor.astro` SHALL NOT relocate the calendar block itself

### Requirement: Stale-While-Revalidate Cache Per Window

The block SHALL cache the events fetched per visible window in `localStorage` under key `wl_cache_events_{yyyy-mm-window}`. On hydrate, the block SHALL render from cache immediately when present, fetch fresh data in parallel, and re-render only when the response differs. The block SHALL prefetch the previous and next month windows using `requestIdleCallback` (with a `setTimeout` fallback) on initial load.

#### Scenario: Cache hit renders without flicker

- **WHEN** a visitor returns to the calendar page within the cache window
- **THEN** the calendar SHALL paint from cached data on first frame
- **AND** SHALL re-fetch in the background, repainting only if data has changed

#### Scenario: Idle prefetch warms adjacent months

- **WHEN** the calendar finishes its initial render
- **THEN** within the next idle period the block SHALL fetch the previous and next month windows
- **AND** navigating to those months SHALL render instantly from cache

### Requirement: Reduced-Motion Compliance

All animations introduced by the block (month-transition slide, view-mode crossfade, hover scale on chips, live-now pulse, bottom-sheet slide, popover fade) SHALL be gated on `(prefers-reduced-motion: no-preference)`. When the user prefers reduced motion the block SHALL still function fully but state changes SHALL apply instantly.

#### Scenario: Reduced-motion user changes month

- **WHEN** a user with `prefers-reduced-motion: reduce` clicks the next-month arrow
- **THEN** the new month SHALL replace the previous month instantly
- **AND** no slide or fade animation SHALL play
