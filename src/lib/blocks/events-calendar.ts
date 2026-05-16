// events-calendar.ts — Lazy-loaded view controller for the events_calendar block.
//
// State machine drives Month / Week / Agenda views with three density modes.
// Stale-while-revalidate cache via calendar-cache.ts. Container-query
// observer auto-falls-through to Agenda below 600px regardless of admin's
// configured view.

import type { BlockRenderContext, Section } from '../blocks.js';
import { createElement, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { safeCssUrl } from '../blocks.js';
import { get } from '../api.js';
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
  EventsCalendarAgendaView,
  EventsCalendarControls,
  EventsCalendarMonthView,
  EventsCalendarPeekOverlay,
  EventsCalendarWeekView,
  type EventsCalendarAgendaDay,
  type EventsCalendarAgendaViewProps,
  type EventsCalendarChipProps,
  type EventsCalendarControlsLabels,
  type EventsCalendarMonthCell,
  type EventsCalendarMonthViewProps,
  type EventsCalendarPeekAvatar,
  type EventsCalendarPeekCapacity,
  type EventsCalendarPeekOverlayProps,
  type EventsCalendarWeekDay,
  type EventsCalendarWeekViewProps,
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

const HOVER_CAPABLE = typeof window !== 'undefined' &&
  window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

interface CalendarRenderRoots {
  controls: ReactRoot;
  controlsHost: HTMLElement;
  viewport: ReactRoot;
  viewportHost: HTMLElement;
  peek: ReactRoot;
  peekHost: HTMLElement;
}

const calendarRenderRoots = new WeakMap<HTMLElement, CalendarRenderRoots>();

function getCalendarRenderRoots(root: HTMLElement): CalendarRenderRoots | null {
  const existing = calendarRenderRoots.get(root);
  if (existing) return existing;

  const controlsHost = root.querySelector<HTMLElement>('[data-events-calendar-controls-host]');
  const viewportHost = root.querySelector<HTMLElement>('[data-events-calendar-viewport]');
  const peekHost = root.querySelector<HTMLElement>('[data-events-calendar-peek-host]');
  if (!controlsHost || !viewportHost || !peekHost) return null;

  const roots: CalendarRenderRoots = {
    controls: createRoot(controlsHost),
    controlsHost,
    viewport: createRoot(viewportHost),
    viewportHost,
    peek: createRoot(peekHost),
    peekHost,
  };
  calendarRenderRoots.set(root, roots);
  return roots;
}

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

function calendarDataHref(evt: Event, host: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(eventToIcs(evt, host))}`;
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

function eventChipProps(
  evt: Event,
  state: State,
  locale: string,
  now: Date,
  density: Density,
): EventsCalendarChipProps {
  const time = formatEventDateTime(evt, locale, siteConfig, { dateStyle: 'card' }).timeRangeLabel;
  const safeThumbUrl = density === 'rich' && evt.image_url ? safeCssUrl(evt.image_url) : '';
  const avatarStack = density === 'rich'
    ? rsvpAvatarStackData(evt.id, state.rsvps)
    : { avatars: [], overflow: 0 };

  return {
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
  };
}

function monthViewProps(state: State, locale: string, firstDayOfWeek: number): EventsCalendarMonthViewProps {
  const firstDow = state.density === 'glance' ? 0 : firstDayOfWeek;
  const win = visibleWindow(state.currentMonth, firstDow);
  const now = new Date();

  const weekdayCells: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(win.start, i);
    weekdayCells.push(fmtWeekday(d, locale, 'short'));
  }

  const filtered = filterEvents(state.events, state, now);
  const grouped = groupByDay(filtered, locale);

  const rows: EventsCalendarMonthCell[][] = [];
  for (let row = 0; row < 6; row++) {
    const cells: EventsCalendarMonthCell[] = [];
    for (let col = 0; col < 7; col++) {
      const cellDate = addDays(win.start, row * 7 + col);
      const inMonth = isSameMonth(cellDate, state.currentMonth);
      const today = isSameDay(cellDate, now);
      const focused = state.focusDate && isSameDay(cellDate, state.focusDate);
      const events = grouped.get(dayKey(cellDate)) || [];
      const visible = events.slice(0, 3);
      const overflow = events.length - visible.length;
      const moreButton = overflow > 0
        ? {
          day: dayKey(cellDate),
          label: `+${overflow} ${t('more', locale)}`,
        }
        : null;
      const ariaLabel = `${fmtDateLong(cellDate, locale)}, ${events.length} ${events.length === 1 ? 'event' : 'events'}`;
      cells.push({
        ariaLabel,
        chips: visible.map((e) => eventChipProps(e, state, locale, now, state.density)),
        day: dayKey(cellDate),
        dayLabel: fmtDayOfMonth(cellDate, locale),
        focused: !!focused,
        inMonth,
        isToday: today,
        moreButton,
      });
    }
    rows.push(cells);
  }

  const visibleCount = filterEvents(state.events, state, new Date()).length;
  return {
    density: state.density,
    label: fmtMonthYear(state.currentMonth, locale),
    liveText: `${fmtMonthYear(state.currentMonth, locale)}, ${visibleCount} ${visibleCount === 1 ? 'event' : 'events'}`,
    rows,
    weekdays: weekdayCells,
  };
}

function agendaViewProps(state: State, locale: string): EventsCalendarAgendaViewProps {
  const now = new Date();
  const filtered = filterEvents(state.events, state, now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const grouped = groupByDay(filtered, locale);
  const dayKeys = Array.from(grouped.keys()).sort();
  const days: EventsCalendarAgendaDay[] = dayKeys.map((k) => {
    const dayDate = new Date(k + 'T00:00:00');
    const events = grouped.get(k)!;
    return {
      chips: events.map((e) => eventChipProps(e, state, locale, now, state.density === 'glance' ? 'light' : state.density)),
      heading: fmtAgendaDayHeading(dayDate, locale),
      isToday: isSameDay(dayDate, now),
    };
  });
  return {
    days,
    emptyMessage: t('No events this month.', locale),
  };
}

function weekViewProps(state: State, locale: string): EventsCalendarWeekViewProps {
  const firstDow = 0;
  const start = startOfWeek(state.focusDate || new Date(), firstDow);
  const now = new Date();
  const filtered = filterEvents(state.events, state, now);
  const grouped = groupByDay(filtered, locale);
  const days: EventsCalendarWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const events = grouped.get(dayKey(d)) || [];
    days.push({
      chips: events.map((e) => eventChipProps(e, state, locale, now, state.density === 'glance' ? 'light' : state.density)),
      day: dayKey(d),
      dayLabel: fmtDayOfMonth(d, locale),
      isToday: isSameDay(d, now),
      weekdayLabel: fmtWeekday(d, locale),
    });
  }
  return { days };
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

  let hoverTimer: number | undefined;

  function renderViewportElement(): ReactElement {
    if (state.effectiveView === 'agenda') {
      return createElement(EventsCalendarAgendaView, agendaViewProps(state, ctx.locale));
    }
    if (state.effectiveView === 'week') {
      return createElement(EventsCalendarWeekView, weekViewProps(state, ctx.locale));
    }
    return createElement(EventsCalendarMonthView, {
      ...monthViewProps(state, ctx.locale, cfg.first_day_of_week ?? 0),
      onCellClick: handleMonthCellClick,
      onCellMouseEnter: HOVER_CAPABLE ? handleMonthCellMouseEnter : undefined,
      onCellMouseLeave: HOVER_CAPABLE ? handleMonthCellMouseLeave : undefined,
      onDayPeek: handleDayPeek,
    });
  }

  function repaint(): void {
    const roots = getCalendarRenderRoots(root);
    if (!roots) return;
    root.dataset.eventsCalendarView = state.effectiveView;
    root.dataset.eventsCalendarDensity = state.density;
    root.toggleAttribute('data-events-calendar-narrow', containerNarrow);
    roots.viewportHost.dataset.view = state.effectiveView;
    flushSync(() => {
      roots.controls.render(createElement(EventsCalendarControls, {
        activeView: state.effectiveView,
        filter: state.filter,
        isAuthenticated: isAuthed,
        labels: calendarControlLabels(ctx.locale),
        monthLabel: fmtMonthYear(state.currentMonth, ctx.locale),
        onFilterChange: handleFilterChange,
        onNavigate: handleNavigate,
        onViewChange: handleViewChange,
        showFilterChips: cfg.show_filter_chips !== false,
      }));
      roots.viewport.render(renderViewportElement());
    });
    renderPeekOverlay();
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

  function handleNavigate(direction: 'prev' | 'today' | 'next'): void {
    if (direction === 'today') {
      state.currentMonth = startOfMonth(new Date());
      state.focusDate = new Date();
    } else if (direction === 'prev') {
      state.currentMonth = addMonths(state.currentMonth, -1);
    } else if (direction === 'next') {
      state.currentMonth = addMonths(state.currentMonth, 1);
    }
    void loadWindow();
  }

  function handleViewChange(view: ViewMode): void {
    if (!view || view === state.view) return;
    state.view = view;
    state.effectiveView = containerNarrow && !cfg.density_lock ? 'agenda' : view;
    repaint();
  }

  function handleFilterChange(filter: Filter): void {
    if (!filter || filter === state.filter) return;
    state.filter = filter;
    // Persist per block instance.
    try {
      const sid = root.closest('[data-sortable-id]')?.getAttribute('data-sortable-id') || 'global';
      localStorage.setItem(`wl_calendar_filter_${sid}`, filter);
    } catch {}
    void loadWindow();
  }

  function handleDayPeek(day: string): void {
    state.peekDayKey = day || null;
    renderPeekOverlay();
  }

  function handleMonthCellClick(day: string): void {
    // Tap a day cell on touch → opens peek (mobile-friendly).
    // Event chips and the "+N more" button stop propagation in React.
    if (HOVER_CAPABLE || !day) return;
    state.peekDayKey = day;
    renderPeekOverlay();
  }

  function handleMonthCellMouseEnter(day: string): void {
    if (!day) return;
    const events = state.events.length
      ? filterEvents(state.events, state, new Date()).filter((event) => eventDayKey(event, siteConfig, ctx.locale) === day)
      : [];
    if (!events.length) return;
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      state.peekDayKey = day;
      renderPeekOverlay();
    }, 200);
  }

  function handleMonthCellMouseLeave(): void {
    window.clearTimeout(hoverTimer);
  }

  function renderPeekOverlay(): void {
    const roots = getCalendarRenderRoots(root);
    if (!roots) return;
    if (!state.peekDayKey) {
      flushSync(() => roots.peek.render(null));
      return;
    }

    const dayDate = new Date(state.peekDayKey + 'T00:00:00');
    const events = filterEvents(state.events, state, new Date()).filter((e) => {
      const k = eventDayKey(e, siteConfig, ctx.locale);
      return k === state.peekDayKey;
    });
    if (!events.length) {
      state.peekDayKey = null;
      flushSync(() => roots.peek.render(null));
      return;
    }
    const heading = fmtDateLong(dayDate, ctx.locale);
    const host = window.location.host || 'kychon.run402.com';
    const items = events.map((e) => {
      const time = formatEventDateTime(e, ctx.locale, siteConfig, { dateStyle: 'card' }).timeRangeLabel;
      const avatars = rsvpAvatarStackData(e.id, state.rsvps);
      return {
        avatarOverflow: avatars.overflow,
        avatars: avatars.avatars,
        calendarDownloadName: `event-${e.id}.ics`,
        calendarHref: calendarDataHref(e, host),
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

    const props: EventsCalendarPeekOverlayProps = {
      addToCalendarLabel: t('Add to my calendar', ctx.locale),
      closeLabel: t('Close', ctx.locale),
      heading,
      items,
      liveNowLabel: t('Live now', ctx.locale),
      membersOnlyLabel: t('Members only', ctx.locale),
      onClose: () => {
        state.peekDayKey = null;
        renderPeekOverlay();
      },
    };
    flushSync(() => {
      roots.peek.render(createElement(EventsCalendarPeekOverlay, props));
    });
  }

  // --- Keyboard nav (top-level on root) ---

  function onKeyDown(ev: KeyboardEvent): void {
    if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
    const k = ev.key;
    if (k === 'Escape' && state.peekDayKey) {
      ev.preventDefault();
      state.peekDayKey = null;
      renderPeekOverlay();
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
      const cell = root.querySelector<HTMLElement>(`[data-events-calendar-cell][data-day="${dayKey(next)}"]`);
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
    window.clearTimeout(hoverTimer);
    cancelPendingPrefetches();
    const roots = calendarRenderRoots.get(root);
    if (roots) {
      roots.controls.unmount();
      roots.viewport.unmount();
      roots.peek.unmount();
      calendarRenderRoots.delete(root);
    }
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
}
