// events-calendar.ts — Lazy-loaded view controller for the events_calendar block.
//
// State machine drives Month / Week / Agenda views with three density modes.
// Stale-while-revalidate cache via calendar-cache.ts. Container-query
// observer auto-falls-through to Agenda below 600px regardless of admin's
// configured view.

import type { BlockRenderContext, Section } from '../blocks.js';
import { escAttr, escHtml, safeCssUrl } from '../blocks.js';
import { get, patch } from '../api.js';
import {
  cancelPendingPrefetches,
  fetchAndUpdateWindow,
  invalidateAllEventCaches,
  readEventWindow,
  readRsvpsForWindow,
  schedulePrefetch,
  windowKey,
} from '../calendar-cache.js';
import type { Event } from '../../schemas/event.js';
import type { RsvpAvatar } from '../api.js';
import { siteConfig } from '../config.js';
import { eventDayKey, formatEventDateTime } from '../event-display.js';
import {
  renderEventsCalendarChipHtml,
  renderEventsCalendarControlsHtml,
  renderEventsCalendarEmptyHtml,
  renderEventsCalendarPeekOverlayHtml,
  type EventsCalendarControlsLabels,
  type EventsCalendarPeekAvatar,
  type EventsCalendarPeekCapacity,
} from '@/components/kychon/EventsCalendarBlockView';

type ViewMode = 'month' | 'week' | 'agenda';
type Density = 'glance' | 'light' | 'rich';
type Filter = 'all' | 'members' | 'open' | 'my_rsvps' | 'past';

interface Config {
  heading?: string;
  view?: ViewMode;
  density?: Density;
  filter?: Filter;
  first_day_of_week?: number;
  show_filter_chips?: boolean;
  density_lock?: boolean;
  agenda_show_empty_days?: boolean;
}

interface State {
  currentMonth: Date;     // anchor: first of month, UTC-mid for stability
  view: ViewMode;         // requested view
  effectiveView: ViewMode; // post-container-query (may degrade to agenda)
  density: Density;
  filter: Filter;
  focusDate: Date | null;
  peekDayKey: string | null;
  peekEventId: number | null;
  myRsvpEventIds: Set<number> | null;
  events: Event[];
  rsvps: RsvpAvatar[];
}

const REDUCED_MOTION = typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const HOVER_CAPABLE = typeof window !== 'undefined' &&
  window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

// --- Date utilities (Intl-only, no external date lib) ---

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfWeek(d: Date, firstDow: number): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = (day - firstDow + 7) % 7;
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function dayKey(d: Date): string {
  // Locally-keyed (not UTC) so an event on a date displays under that date.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtMonthYear(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
}

function fmtWeekday(d: Date, locale: string, style: 'narrow' | 'short' = 'short'): string {
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(d);
}

function fmtDayOfMonth(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(d);
}

function fmtAgendaDayHeading(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', month: 'short', day: 'numeric',
  }).format(d);
}

function fmtDateLong(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(d);
}

// --- Visible window calculation (6 rows × 7 cols) ---

function visibleWindow(currentMonth: Date, firstDow: number): { start: Date; end: Date } {
  const start = startOfWeek(startOfMonth(currentMonth), firstDow);
  const end = addDays(start, 42); // 6 weeks of 7 days = 42 cells
  return { start, end };
}

// --- Filtering ---

function filterEvents(events: Event[], state: State, now: Date): Event[] {
  const myIds = state.myRsvpEventIds;
  return events.filter((e) => {
    if (state.filter === 'members' && !e.is_members_only) return false;
    if (state.filter === 'open' && e.is_members_only) return false;
    if (state.filter === 'my_rsvps' && (!myIds || !myIds.has(e.id))) return false;
    if (state.filter === 'past' && new Date(e.starts_at) >= now) return false;
    if (state.filter !== 'past' && new Date(e.starts_at) < startOfDay(now)) return false;
    return true;
  });
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// Group events by local-day key. Multi-day events appear on each day they span.
function addDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function groupByDay(events: Event[], locale: string): Map<string, Event[]> {
  const map = new Map<string, Event[]>();
  for (const e of events) {
    const startKey = eventDayKey(e, siteConfig, locale);
    const endKey = e.ends_at
      ? eventDayKey({ ...e, starts_at: e.ends_at }, siteConfig, locale)
      : startKey;
    let cursor = startKey;
    let guard = 0;
    while (cursor && cursor <= endKey) {
      const list = map.get(cursor) || [];
      list.push(e);
      map.set(cursor, list);
      cursor = addDayKey(cursor);
      guard++;
      if (guard > 365) break; // safety
    }
  }
  return map;
}

// --- ICS (browser-side, single event one-tap) ---

function escIcs(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function fmtIcsDate(d: Date): string {
  // Floating-form UTC: YYYYMMDDTHHMMSSZ
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${dd}T${h}${mi}${s}Z`;
}

function eventToIcs(evt: Event, host: string): string {
  const start = new Date(evt.starts_at);
  const end = evt.ends_at ? new Date(evt.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kychon//Calendar//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${evt.id}@${host}`,
    `DTSTAMP:${fmtIcsDate(new Date())}`,
    `DTSTART:${fmtIcsDate(start)}`,
    `DTEND:${fmtIcsDate(end)}`,
    `SUMMARY:${escIcs(evt.title || '')}`,
    evt.location ? `LOCATION:${escIcs(evt.location)}` : null,
    evt.description ? `DESCRIPTION:${escIcs(evt.description)}` : null,
    `URL:https://${host}/event?id=${evt.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[];
  return lines.join('\r\n');
}

function downloadIcs(evt: Event): void {
  const host = window.location.host || 'kychon.run402.com';
  const ics = eventToIcs(evt, host);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `event-${evt.id}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// --- HTML helpers ---

function rsvpAvatarStackData(eventId: number, rsvps: RsvpAvatar[]): {
  avatars: EventsCalendarPeekAvatar[];
  overflow: number;
} {
  const matching = rsvps.filter((r) => r.event_id === eventId);
  const avatars = matching.slice(0, 3).map((r) => {
    const name = r.members?.display_name || '?';
    return {
      avatarUrl: r.members?.avatar_url || null,
      initial: name.charAt(0).toUpperCase(),
      name,
    };
  });

  return {
    avatars,
    overflow: Math.max(0, matching.length - avatars.length),
  };
}

function isLiveNow(evt: Event, now: Date): boolean {
  const start = new Date(evt.starts_at);
  if (start > now) return false;
  if (evt.ends_at) return new Date(evt.ends_at) > now;
  // No end → consider "live" for 2h after start.
  return now.getTime() - start.getTime() < 2 * 60 * 60 * 1000;
}

function capacityBadgeInfo(evt: Event, rsvps: RsvpAvatar[], locale: string): EventsCalendarPeekCapacity | null {
  if (!evt.capacity) return null;
  const going = rsvps.filter((r) => r.event_id === evt.id).length;
  if (going >= evt.capacity) return { label: t('Sold out', locale), tone: 'sold' };
  if (going >= evt.capacity * 0.8) return { label: t('Filling fast', locale), tone: 'filling' };
  return null;
}

// Tiny in-file translations — full i18n table lives in public/custom/strings/{lang}.json.
// For v1 we only translate strings the calendar surfaces; non-en falls back to en.
const STRINGS_EN: Record<string, string> = {
  'Calendar': 'Calendar',
  'Today': 'Today',
  'Month': 'Month',
  'Week': 'Week',
  'Agenda': 'Agenda',
  'All': 'All',
  'Members': 'Members',
  'Open': 'Open',
  'My RSVPs': 'My RSVPs',
  'Past': 'Past',
  'Live now': 'Live now',
  'Live': 'Live',
  'Filling fast': 'Filling fast',
  'Sold out': 'Sold out',
  'Members only': 'Members only',
  'No events.': 'No events.',
  'No events this month.': 'No events this month.',
  'Add to my calendar': 'Add to my calendar',
  'Subscribe in your calendar app': 'Subscribe in your calendar app',
  'Open full event': 'Open full event',
  'Close': 'Close',
  'more': 'more',
  'Previous month': 'Previous month',
  'Next month': 'Next month',
  'Previous week': 'Previous week',
  'Next week': 'Next week',
  'Loading…': 'Loading…',
};
function t(key: string, _locale: string): string {
  // Future: lookup against active i18n strings. Today, en-only is fine — the
  // public/custom/strings/{lang}.json files don't yet contain calendar keys.
  return STRINGS_EN[key] ?? key;
}

// --- Renderers ---

function calendarControlLabels(locale: string): EventsCalendarControlsLabels {
  return {
    agenda: t('Agenda', locale),
    all: t('All', locale),
    members: t('Members', locale),
    month: t('Month', locale),
    myRsvps: t('My RSVPs', locale),
    nextMonth: t('Next month', locale),
    open: t('Open', locale),
    past: t('Past', locale),
    previousMonth: t('Previous month', locale),
    today: t('Today', locale),
    week: t('Week', locale),
  };
}

function renderEventChip(
  evt: Event,
  state: State,
  locale: string,
  now: Date,
  density: Density,
): string {
  const time = formatEventDateTime(evt, locale, siteConfig, { dateStyle: 'card' }).timeRangeLabel;
  const safeThumbUrl = density === 'rich' && evt.image_url ? safeCssUrl(evt.image_url) : '';
  const avatarStack = density === 'rich'
    ? rsvpAvatarStackData(evt.id, state.rsvps)
    : { avatars: [], overflow: 0 };

  return renderEventsCalendarChipHtml({
    avatarOverflow: avatarStack.overflow,
    avatars: avatarStack.avatars,
    capacity: capacityBadgeInfo(evt, state.rsvps, locale),
    day: eventDayKey(evt, siteConfig, locale),
    density,
    href: `/event?id=${evt.id}`,
    id: evt.id,
    isLive: isLiveNow(evt, now),
    isMembersOnly: !!evt.is_members_only,
    liveNowLabel: t('Live now', locale),
    membersOnlyLabel: t('Members only', locale),
    thumbUrl: safeThumbUrl,
    time,
    title: evt.title || '',
  });
}

function renderMonthView(state: State, locale: string, _ctx: BlockRenderContext): string {
  const firstDow = state.density === 'glance' ? 0 : (Number.isInteger((state as any).first_day_of_week) ? (state as any).first_day_of_week : 0);
  const win = visibleWindow(state.currentMonth, firstDow);
  const now = new Date();

  // Weekday headers
  const weekdayCells: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(win.start, i);
    weekdayCells.push(`<div class="block-events-calendar__weekday" role="columnheader">${escHtml(fmtWeekday(d, locale, 'short'))}</div>`);
  }

  const filtered = filterEvents(state.events, state, now);
  const grouped = groupByDay(filtered, locale);

  const rows: string[] = [];
  for (let row = 0; row < 6; row++) {
    const cells: string[] = [];
    for (let col = 0; col < 7; col++) {
      const cellDate = addDays(win.start, row * 7 + col);
      const inMonth = isSameMonth(cellDate, state.currentMonth);
      const today = isSameDay(cellDate, now);
      const focused = state.focusDate && isSameDay(cellDate, state.focusDate);
      const events = grouped.get(dayKey(cellDate)) || [];
      const visible = events.slice(0, 3);
      const overflow = events.length - visible.length;
      const overflowHtml = overflow > 0
        ? `<button type="button" class="block-events-calendar__more" data-day-peek="${escAttr(dayKey(cellDate))}">+${overflow} ${escHtml(t('more', locale))}</button>`
        : '';
      const chipsHtml = visible.map((e) => renderEventChip(e, state, locale, now, state.density)).join('');
      const ariaLabel = `${fmtDateLong(cellDate, locale)}, ${events.length} ${events.length === 1 ? 'event' : 'events'}`;
      cells.push(`
        <div class="block-events-calendar__cell${inMonth ? '' : ' is-outside'}${today ? ' is-today' : ''}${focused ? ' is-focused' : ''}"
             role="gridcell"
             tabindex="${focused ? '0' : '-1'}"
             data-day="${escAttr(dayKey(cellDate))}"
             aria-label="${escAttr(ariaLabel)}">
          <div class="block-events-calendar__cell-num">${escHtml(fmtDayOfMonth(cellDate, locale))}</div>
          <div class="block-events-calendar__cell-events">${chipsHtml}${overflowHtml}</div>
        </div>
      `);
    }
    rows.push(`<div class="block-events-calendar__row" role="row">${cells.join('')}</div>`);
  }

  const liveRegion = `<div class="block-events-calendar__live-region sr-only" aria-live="polite"></div>`;
  return `
    <div class="block-events-calendar__grid" role="grid" aria-label="${escAttr(fmtMonthYear(state.currentMonth, locale))}" data-grid-cols="7">
      <div class="block-events-calendar__weekdays" role="row">${weekdayCells.join('')}</div>
      ${rows.join('')}
    </div>
    ${liveRegion}
  `;
}

function renderAgendaView(state: State, locale: string): string {
  const now = new Date();
  const filtered = filterEvents(state.events, state, now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (!filtered.length) {
    return renderEventsCalendarEmptyHtml({ message: t('No events this month.', locale) });
  }
  // Group by day key, render header + chip list.
  const grouped = groupByDay(filtered, locale);
  const dayKeys = Array.from(grouped.keys()).sort();
  const sections = dayKeys.map((k) => {
    const dayDate = new Date(k + 'T00:00:00');
    const events = grouped.get(k)!;
    const heading = fmtAgendaDayHeading(dayDate, locale);
    const today = isSameDay(dayDate, now) ? ' is-today' : '';
    const chips = events.map((e) => renderEventChip(e, state, locale, now, state.density === 'glance' ? 'light' : state.density)).join('');
    return `
      <section class="block-events-calendar__agenda-day${today}">
        <h4 class="block-events-calendar__agenda-heading">${escHtml(heading)}</h4>
        <div class="block-events-calendar__agenda-events">${chips}</div>
      </section>
    `;
  });
  return `<div class="block-events-calendar__agenda">${sections.join('')}</div>`;
}

function renderWeekView(state: State, locale: string): string {
  // Week view = 7-column day strip, single row, taller cells.
  const firstDow = 0;
  const start = startOfWeek(state.focusDate || new Date(), firstDow);
  const now = new Date();
  const filtered = filterEvents(state.events, state, now);
  const grouped = groupByDay(filtered, locale);
  const cols: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const events = grouped.get(dayKey(d)) || [];
    const today = isSameDay(d, now) ? ' is-today' : '';
    const chips = events.map((e) => renderEventChip(e, state, locale, now, state.density === 'glance' ? 'light' : state.density)).join('');
    cols.push(`
      <section class="block-events-calendar__week-col${today}" data-day="${escAttr(dayKey(d))}">
        <header class="block-events-calendar__week-head">
          <div class="block-events-calendar__week-dow">${escHtml(fmtWeekday(d, locale))}</div>
          <div class="block-events-calendar__week-num">${escHtml(fmtDayOfMonth(d, locale))}</div>
        </header>
        <div class="block-events-calendar__week-events">${chips || `<div class="block-events-calendar__week-empty"></div>`}</div>
      </section>
    `);
  }
  return `<div class="block-events-calendar__week">${cols.join('')}</div>`;
}

// --- Main entry ---

export function initCalendar(root: HTMLElement, _section: Section, ctx: BlockRenderContext): void {
  let cfg: Config = {};
  try {
    cfg = JSON.parse(root.getAttribute('data-config') || '{}');
  } catch {}

  const isAuthed = !!ctx.session;
  const memberId = ctx.session?.user?.member?.id ?? null;

  const state: State = {
    currentMonth: startOfMonth(new Date()),
    view: (cfg.view as ViewMode) || 'month',
    effectiveView: (cfg.view as ViewMode) || 'month',
    density: (cfg.density as Density) || 'light',
    filter: (cfg.filter as Filter) || 'all',
    focusDate: new Date(),
    peekDayKey: null,
    peekEventId: null,
    myRsvpEventIds: null,
    events: [],
    rsvps: [],
  };

  // Container-query observer — drop to agenda below 600px unless density_lock.
  let containerNarrow = false;
  const ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width || root.clientWidth;
    const wasNarrow = containerNarrow;
    containerNarrow = w < 600;
    if (containerNarrow !== wasNarrow && !cfg.density_lock) {
      const newEffective: ViewMode = containerNarrow ? 'agenda' : state.view;
      if (newEffective !== state.effectiveView) {
        state.effectiveView = newEffective;
        repaint();
      }
    }
  });
  ro.observe(root);

  // Strip the loading placeholder; build the shell.
  function shell(): string {
    return `
      ${state.peekDayKey ? '' /* peek rendered as overlay below */ : ''}
      ${renderEventsCalendarControlsHtml({
        activeView: state.effectiveView,
        filter: state.filter,
        isAuthenticated: isAuthed,
        labels: calendarControlLabels(ctx.locale),
        monthLabel: fmtMonthYear(state.currentMonth, ctx.locale),
        showFilterChips: cfg.show_filter_chips !== false,
      })}
      <div class="block-events-calendar__viewport" data-view="${state.effectiveView}"></div>
    `;
  }

  function renderViewport(): string {
    if (state.effectiveView === 'agenda') return renderAgendaView(state, ctx.locale);
    if (state.effectiveView === 'week') return renderWeekView(state, ctx.locale);
    return renderMonthView(state, ctx.locale, ctx);
  }

  function repaint(): void {
    // Preserve scroll, focus where reasonable.
    root.classList.toggle('block-events-calendar--narrow', containerNarrow);
    root.classList.remove('block-events-calendar--view-month', 'block-events-calendar--view-week', 'block-events-calendar--view-agenda');
    root.classList.add(`block-events-calendar--view-${state.effectiveView}`);
    root.classList.remove('block-events-calendar--density-glance', 'block-events-calendar--density-light', 'block-events-calendar--density-rich');
    root.classList.add(`block-events-calendar--density-${state.density}`);
    root.innerHTML = shell();
    const viewport = root.querySelector<HTMLElement>('.block-events-calendar__viewport');
    if (viewport) viewport.innerHTML = renderViewport();
    bindControls();
    bindCells();
    if (state.peekDayKey) renderPeekOverlay();
    announceMonth();
  }

  function announceMonth(): void {
    const live = root.querySelector('.block-events-calendar__live-region');
    if (!live) return;
    const count = filterEvents(state.events, state, new Date()).length;
    live.textContent = `${fmtMonthYear(state.currentMonth, ctx.locale)}, ${count} ${count === 1 ? 'event' : 'events'}`;
  }

  // --- Data fetch ---

  async function loadWindow(target = state.currentMonth): Promise<void> {
    const firstDow = cfg.first_day_of_week ?? 0;
    const win = visibleWindow(target, firstDow);
    const key = windowKey(win.start);

    // Synchronous cache-first paint.
    const cachedEvents = readEventWindow(key);
    const cachedRsvps = readRsvpsForWindow(key);
    if (cachedEvents) {
      state.events = cachedEvents;
      state.rsvps = cachedRsvps || [];
      repaint();
    }

    // Prep filter-specific extra fetch (My RSVPs).
    if (state.filter === 'my_rsvps' && memberId) {
      try {
        const rows = await get(`event_rsvps?member_id=eq.${memberId}&select=event_id`);
        state.myRsvpEventIds = new Set((rows as { event_id: number }[]).map((r) => r.event_id));
      } catch (_e) {
        state.myRsvpEventIds = new Set();
      }
    }

    const result = await fetchAndUpdateWindow({
      startIso: win.start.toISOString(),
      endIso: win.end.toISOString(),
      key,
      withRsvps: state.density === 'rich',
      onEvents: (evs) => {
        state.events = evs;
        repaint();
      },
      onRsvps: (rs) => {
        state.rsvps = rs;
        repaint();
      },
    });
    state.events = result.events;
    state.rsvps = result.rsvps;
    repaint();

    // Idle-prefetch ±1 month.
    const prevMonth = addMonths(target, -1);
    const nextMonth = addMonths(target, 1);
    const prevWin = visibleWindow(prevMonth, firstDow);
    const nextWin = visibleWindow(nextMonth, firstDow);
    schedulePrefetch({
      prevStart: prevWin.start,
      prevEnd: prevWin.end,
      nextStart: nextWin.start,
      nextEnd: nextWin.end,
      withRsvps: state.density === 'rich',
    });
  }

  // --- Listeners ---

  function bindControls(): void {
    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.nav;
        if (dir === 'today') {
          state.currentMonth = startOfMonth(new Date());
          state.focusDate = new Date();
        } else if (dir === 'prev') {
          state.currentMonth = addMonths(state.currentMonth, -1);
        } else if (dir === 'next') {
          state.currentMonth = addMonths(state.currentMonth, 1);
        }
        void loadWindow();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view as ViewMode;
        if (v && v !== state.view) {
          state.view = v;
          state.effectiveView = containerNarrow && !cfg.density_lock ? 'agenda' : v;
          repaint();
        }
      });
    });
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.filter as Filter;
        if (f && f !== state.filter) {
          state.filter = f;
          // Persist per block instance.
          try {
            const sid = root.closest('[data-sortable-id]')?.getAttribute('data-sortable-id') || 'global';
            localStorage.setItem(`wl_calendar_filter_${sid}`, f);
          } catch {}
          void loadWindow();
        }
      });
    });
  }

  function bindCells(): void {
    // Click chip → no special handling (anchor href to /event); drag handlers TODO.
    // Click overflow "+N more" → open day peek.
    root.querySelectorAll<HTMLElement>('[data-day-peek]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        state.peekDayKey = btn.dataset.dayPeek || null;
        renderPeekOverlay();
      });
    });

    // Tap a day cell on touch → also opens peek (mobile-friendly).
    root.querySelectorAll<HTMLElement>('.block-events-calendar__cell').forEach((cell) => {
      cell.addEventListener('click', (ev) => {
        if (HOVER_CAPABLE) return;
        const target = ev.target as HTMLElement;
        if (target.closest('a, button')) return;
        const k = cell.dataset.day;
        if (!k) return;
        state.peekDayKey = k;
        renderPeekOverlay();
      });
    });

    // Hover peek (desktop only).
    if (HOVER_CAPABLE) {
      let hoverTimer: number | undefined;
      root.querySelectorAll<HTMLElement>('.block-events-calendar__cell').forEach((cell) => {
        cell.addEventListener('mouseenter', () => {
          const events = (state.events && state.events.length)
            ? filterEvents(state.events, state, new Date()).filter((e) => eventDayKey(e, siteConfig, ctx.locale) === cell.dataset.day)
            : [];
          if (!events.length) return;
          window.clearTimeout(hoverTimer);
          hoverTimer = window.setTimeout(() => {
            state.peekDayKey = cell.dataset.day || null;
            renderPeekOverlay();
          }, 200);
        });
        cell.addEventListener('mouseleave', () => {
          window.clearTimeout(hoverTimer);
        });
      });
    }
  }

  function renderPeekOverlay(): void {
    // Remove any existing peek.
    root.querySelector('[data-events-calendar-peek]')?.remove();
    if (!state.peekDayKey) return;

    const dayDate = new Date(state.peekDayKey + 'T00:00:00');
    const events = filterEvents(state.events, state, new Date()).filter((e) => {
      const k = eventDayKey(e, siteConfig, ctx.locale);
      return k === state.peekDayKey;
    });
    if (!events.length) {
      state.peekDayKey = null;
      return;
    }
    const heading = fmtDateLong(dayDate, ctx.locale);
    const items = events.map((e) => {
      const time = formatEventDateTime(e, ctx.locale, siteConfig, { dateStyle: 'card' }).timeRangeLabel;
      const avatars = rsvpAvatarStackData(e.id, state.rsvps);
      return {
        avatarOverflow: avatars.overflow,
        avatars: avatars.avatars,
        capacity: capacityBadgeInfo(e, state.rsvps, ctx.locale),
        href: `/event?id=${e.id}`,
        id: e.id,
        isLive: isLiveNow(e, new Date()),
        isMembersOnly: !!e.is_members_only,
        location: e.location || '',
        time,
        title: e.title || '',
      };
    });

    root.insertAdjacentHTML('beforeend', renderEventsCalendarPeekOverlayHtml({
      addToCalendarLabel: t('Add to my calendar', ctx.locale),
      closeLabel: t('Close', ctx.locale),
      heading,
      items,
      liveNowLabel: t('Live now', ctx.locale),
      membersOnlyLabel: t('Members only', ctx.locale),
    }));

    const overlay = root.querySelector<HTMLElement>('[data-events-calendar-peek]');
    if (!overlay) return;

    overlay.querySelector('[data-events-calendar-peek-close]')?.addEventListener('click', () => {
      state.peekDayKey = null;
      overlay.remove();
    });
    // Click outside closes
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        state.peekDayKey = null;
        overlay.remove();
      }
    });
    overlay.querySelectorAll<HTMLElement>('[data-events-calendar-peek-ics][data-event-id]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = Number(btn.dataset.eventId);
        const evt = state.events.find((e) => e.id === id);
        if (evt) downloadIcs(evt);
      });
    });
  }

  // --- Keyboard nav (top-level on root) ---

  function onKeyDown(ev: KeyboardEvent): void {
    if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
    const k = ev.key;
    if (k === 'Escape' && state.peekDayKey) {
      ev.preventDefault();
      state.peekDayKey = null;
      root.querySelector('[data-events-calendar-peek]')?.remove();
      return;
    }
    if (k === 't' || k === 'T') {
      state.currentMonth = startOfMonth(new Date());
      state.focusDate = new Date();
      ev.preventDefault();
      void loadWindow();
      return;
    }
    if (k === 'm' || k === 'M') {
      state.view = 'month';
      state.effectiveView = containerNarrow && !cfg.density_lock ? 'agenda' : 'month';
      ev.preventDefault();
      repaint();
      return;
    }
    if (k === 'w' || k === 'W') {
      state.view = 'week';
      state.effectiveView = containerNarrow && !cfg.density_lock ? 'agenda' : 'week';
      ev.preventDefault();
      repaint();
      return;
    }
    if (k === 'a' || k === 'A') {
      state.view = 'agenda';
      state.effectiveView = 'agenda';
      ev.preventDefault();
      repaint();
      return;
    }
    if (state.effectiveView === 'month' && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'Enter')) {
      handleGridKeyNav(k);
      ev.preventDefault();
    }
  }

  function handleGridKeyNav(k: string): void {
    if (!state.focusDate) state.focusDate = new Date();
    let next = state.focusDate;
    if (k === 'ArrowLeft') next = addDays(state.focusDate, -1);
    else if (k === 'ArrowRight') next = addDays(state.focusDate, 1);
    else if (k === 'ArrowUp') next = addDays(state.focusDate, -7);
    else if (k === 'ArrowDown') next = addDays(state.focusDate, 7);
    else if (k === 'Enter') {
      // Open peek for the focused day.
      state.peekDayKey = dayKey(state.focusDate);
      renderPeekOverlay();
      return;
    }
    state.focusDate = next;
    if (!isSameMonth(next, state.currentMonth)) {
      state.currentMonth = startOfMonth(next);
      void loadWindow();
    } else {
      repaint();
      // Move focus to new cell.
      const cell = root.querySelector<HTMLElement>(`[data-day="${dayKey(next)}"]`);
      cell?.focus();
    }
  }

  document.addEventListener('keydown', onKeyDown);

  // --- External event hooks ---
  const onAuthChanged = () => {
    void loadWindow();
  };
  const onLocaleChanged = () => repaint();
  const onEventsChanged = () => {
    invalidateAllEventCaches();
    void loadWindow();
  };
  const onBeforeSwap = () => cleanup();

  document.addEventListener('wl-auth-changed', onAuthChanged);
  document.addEventListener('wl-locale-changed', onLocaleChanged);
  document.addEventListener('wl-events-changed', onEventsChanged);
  document.addEventListener('astro:before-swap', onBeforeSwap, { once: true });

  function cleanup(): void {
    ro.disconnect();
    cancelPendingPrefetches();
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('wl-auth-changed', onAuthChanged);
    document.removeEventListener('wl-locale-changed', onLocaleChanged);
    document.removeEventListener('wl-events-changed', onEventsChanged);
  }

  // Restore persisted filter, if any.
  try {
    const sid = root.closest('[data-sortable-id]')?.getAttribute('data-sortable-id') || 'global';
    const stored = localStorage.getItem(`wl_calendar_filter_${sid}`);
    if (stored && ['all', 'members', 'open', 'my_rsvps', 'past'].includes(stored)) {
      state.filter = stored as Filter;
    }
  } catch {}

  // Initial paint and load.
  repaint();
  void loadWindow();

  // Suppress unused vars warning for reduced-motion + patch (drag-resched TODO).
  void REDUCED_MOTION;
  void patch;
}
