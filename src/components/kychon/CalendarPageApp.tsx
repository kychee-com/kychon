'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, ShieldAlert, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/kychon/ui';
import { get, getEvents } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { ready, siteConfig, translateItems } from '@/lib/config';
import { eventDayKey, eventDayKeyStable } from '@/lib/event-display';
import { useEventDateTime, useHydrated } from '@/lib/use-event-date-time';
import type { Event } from '@/schemas/event';

type CalendarFilter = 'all' | 'members' | 'open' | 'my_rsvps' | 'past';

const FILTERS: Array<{ label: string; value: CalendarFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Members', value: 'members' },
  { label: 'Open', value: 'open' },
  { label: 'My RSVPs', value: 'my_rsvps' },
  { label: 'Past', value: 'past' },
];

/** A calendar month (`month` 0-based). A month's grid is the same in every zone. */
interface CalendarMonth {
  year: number;
  month: number;
}

interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
}

/**
 * The calendar's "now": current month, today, and how event days and labels
 * are computed. The server render and the hydration pass must agree, so they
 * use the request's render time in UTC, the fixed 'en' locale, and each
 * event's source zone (`eventDayKeyStable`, matching `formatEventDateTimeStable`).
 * After hydration the grid switches to the visitor's clock, zone, locale and
 * the site's display settings.
 */
interface CalendarClock {
  month: CalendarMonth;
  todayKey: string;
  startOfToday: number;
  locale: string | undefined;
  dayKeyOf: (event: Event) => string;
}

const DAY_MS = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function stableClock(now: Date): CalendarClock {
  return {
    month: { year: now.getUTCFullYear(), month: now.getUTCMonth() },
    todayKey: utcDayKey(now),
    startOfToday: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    locale: 'en',
    dayKeyOf: eventDayKeyStable,
  };
}

function localClock(now: Date): CalendarClock {
  return {
    month: { year: now.getFullYear(), month: now.getMonth() },
    todayKey: localDayKey(now),
    startOfToday: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    locale: undefined,
    dayKeyOf: (event) => eventDayKey(event, siteConfig),
  };
}

function addMonths(value: CalendarMonth, amount: number): CalendarMonth {
  const next = new Date(Date.UTC(value.year, value.month + amount, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
}

function monthLabel(value: CalendarMonth, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(value.year, value.month, 1));
}

function weekdayLabels(locale: string | undefined): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  // 2026-01-04 is a Sunday.
  return Array.from({ length: 7 }, (_, index) => format.format(Date.UTC(2026, 0, 4 + index)));
}

function visibleDays(value: CalendarMonth): CalendarDay[] {
  const first = Date.UTC(value.year, value.month, 1);
  const start = first - new Date(first).getUTCDay() * DAY_MS;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start + index * DAY_MS);
    return { key: utcDayKey(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === value.month };
  });
}

function isPastEvent(event: Event, startOfToday: number): boolean {
  return new Date(event.starts_at).getTime() < startOfToday;
}

function filterEvents(events: Event[], filter: CalendarFilter, myRsvpEventIds: Set<number>, startOfToday: number): Event[] {
  return events.filter((event) => {
    if (filter === 'members' && !event.is_members_only) return false;
    if (filter === 'open' && event.is_members_only) return false;
    if (filter === 'my_rsvps' && !myRsvpEventIds.has(event.id)) return false;
    if (filter === 'past') return isPastEvent(event, startOfToday);
    return !isPastEvent(event, startOfToday);
  });
}

function eventsByDay(events: Event[], dayKeyOf: (event: Event) => string): Map<string, Event[]> {
  const byDay = new Map<string, Event[]>();
  for (const event of events) {
    const key = dayKeyOf(event);
    const list = byDay.get(key) || [];
    list.push(event);
    byDay.set(key, list);
  }
  return byDay;
}

function EventMeta({ event }: { event: Event }) {
  const dateTime = useEventDateTime(event, { dateStyle: 'card' });
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {dateTime.timeRangeLabel || dateTime.dateLabel}
      </span>
      {event.location ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">{event.location}</span>
        </span>
      ) : null}
    </div>
  );
}

function EventPill({ event }: { event: Event }) {
  const dateTime = useEventDateTime(event, { dateStyle: 'card' });
  return (
    <a
      className="block rounded-md border border-border bg-background px-2 py-1 text-left text-xs text-foreground no-underline transition-colors hover:bg-accent"
      href={`/event?id=${event.id}`}
    >
      <span className="block min-w-0 break-words font-medium">{event.title}</span>
      <span className="text-muted-foreground">{dateTime.timeRangeLabel}</span>
    </a>
  );
}

function AgendaEvent({ event }: { event: Event }) {
  const dateTime = useEventDateTime(event, { dateStyle: 'agenda' });
  return (
    <Card>
      <a className="block text-foreground no-underline" href={`/event?id=${event.id}`}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardDescription>{dateTime.dateLabel}</CardDescription>
              <CardTitle className="break-words text-lg tracking-normal">{event.title}</CardTitle>
              {event.description ? <p className="line-clamp-2 break-words text-sm text-muted-foreground">{event.description}</p> : null}
            </div>
            {event.is_members_only ? (
              <Badge variant="secondary">
                <UserRound className="mr-1 h-3 w-3" />
                Members
              </Badge>
            ) : (
              <Badge variant="outline">Open</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <EventMeta event={event} />
        </CardContent>
      </a>
    </Card>
  );
}

function CalendarGrid({
  days,
  events,
  locale,
  todayKey,
}: {
  days: CalendarDay[];
  events: Map<string, Event[]>;
  locale: string | undefined;
  todayKey: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {weekdayLabels(locale).map((label) => (
          <div className="px-2 py-2" key={label}>
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-7 sm:divide-x sm:divide-y-0">
        {days.map((day) => {
          const dayEvents = events.get(day.key) || [];
          return (
            <div
              className={`min-h-28 space-y-2 p-3 ${day.inMonth ? 'bg-background' : 'bg-muted/20 text-muted-foreground'}`}
              data-day={day.key}
              key={day.key}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                    day.key === todayKey ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  {day.day}
                </span>
                {dayEvents.length ? <Badge variant="secondary">{dayEvents.length}</Badge> : null}
              </div>
              {dayEvents.length ? (
                <div className="space-y-1.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <EventPill event={event} key={event.id} />
                  ))}
                  {dayEvents.length > 3 ? <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} more</div> : null}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground sm:hidden">No events</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

interface CalendarPageAppProps {
  /**
   * Pre-fetched events from the per-request SSR pass — see
   * `src/lib/ssr-api.ts:ssrEventsList` + `calendar.astro`. Seeds
   * `useState` so the React island's first render matches the SSR
   * HTML byte-for-byte: month grid populates immediately, no
   * "loading…" flash between hydration and the API roundtrip.
   * Background `loadCalendar` still runs to pick up the current
   * member's RSVPs (auth-gated, only meaningful once the visitor's
   * session is in scope) and any admin edits made between request
   * and hydrate.
   */
  initialEvents?: Event[];
  /**
   * When the server rendered the page (ISO). The hydration pass reuses it as
   * "now" so the month, today and past/upcoming split match the server HTML
   * even across a UTC midnight; without it the first pass reads the clock.
   */
  renderedAt?: string;
}

export default function CalendarPageApp({ initialEvents, renderedAt }: CalendarPageAppProps = {}) {
  const [events, setEvents] = useState<Event[]>(() => initialEvents ?? []);
  const [myRsvpEventIds, setMyRsvpEventIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [shownMonth, setShownMonth] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(() => !initialEvents);
  const [error, setError] = useState('');

  const loadCalendar = useCallback(async () => {
    // Don't unconditionally flip loading=true — keeps the SSR-baked
    // month grid on screen during the refresh (locale-change / auth-
    // change events fire this; we want updates in place rather than
    // a skeleton re-paint). The first-mount skeleton is still covered
    // by the `useState` initializer when no `initialEvents` are present.
    setError('');
    try {
      await ready;
      const rows = await getEvents('order=starts_at.asc');
      const translated = await translateItems('event', rows, ['title', 'description', 'location']);
      setEvents(translated as Event[]);

      const memberId = getSession()?.user?.member?.id;
      if (memberId) {
        try {
          const rsvps = (await get(`event_rsvps?member_id=eq.${memberId}&select=event_id`)) as { event_id: number }[];
          setMyRsvpEventIds(new Set(rsvps.map((rsvp) => rsvp.event_id)));
        } catch {
          setMyRsvpEventIds(new Set());
        }
      } else {
        setMyRsvpEventIds(new Set());
      }
    } catch (loadError) {
      console.warn('Failed to load calendar:', loadError);
      setError('Could not load calendar events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendar();
    document.addEventListener('wl-auth-changed', loadCalendar);
    document.addEventListener('wl-locale-changed', loadCalendar);
    document.addEventListener('wl-events-changed', loadCalendar);
    return () => {
      document.removeEventListener('wl-auth-changed', loadCalendar);
      document.removeEventListener('wl-locale-changed', loadCalendar);
      document.removeEventListener('wl-events-changed', loadCalendar);
    };
  }, [loadCalendar]);

  const hydrated = useHydrated();
  const clock = useMemo(
    () => (hydrated ? localClock(new Date()) : stableClock(renderedAt ? new Date(renderedAt) : new Date())),
    [hydrated, renderedAt],
  );
  const month = shownMonth ?? clock.month;

  const filteredEvents = useMemo(() => {
    return filterEvents(events, filter, myRsvpEventIds, clock.startOfToday).sort((left, right) => left.starts_at.localeCompare(right.starts_at));
  }, [events, filter, myRsvpEventIds, clock]);
  const visible = useMemo(() => visibleDays(month), [month]);
  const dayEvents = useMemo(() => eventsByDay(filteredEvents, clock.dayKeyOf), [filteredEvents, clock]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Events calendar
            </div>
            <h2 className="text-2xl font-semibold tracking-normal">Calendar</h2>
            <p className="text-sm text-muted-foreground">Scan upcoming events by month, access level, or RSVP status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <Button
                aria-pressed={filter === item.value}
                key={item.value}
                onClick={() => setFilter(item.value)}
                size="sm"
                type="button"
                variant={filter === item.value ? 'default' : 'outline'}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button aria-label="Previous month" onClick={() => setShownMonth(addMonths(month, -1))} size="icon" type="button" variant="outline">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShownMonth(null)} type="button" variant="outline">
                Today
              </Button>
              <Button aria-label="Next month" onClick={() => setShownMonth(addMonths(month, 1))} size="icon" type="button" variant="outline">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-lg font-semibold">{monthLabel(month, clock.locale)}</div>
          </CardContent>
        </Card>

        {error ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : loading ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading calendar...
            </CardContent>
          </Card>
        ) : (
          <>
            <CalendarGrid days={visible} events={dayEvents} locale={clock.locale} todayKey={clock.todayKey} />
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-normal">Agenda</h3>
                <Badge variant="secondary">
                  {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
                </Badge>
              </div>
              {filteredEvents.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredEvents.map((event) => (
                    <AgendaEvent event={event} key={event.id} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">No events match this filter.</CardContent>
                </Card>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
