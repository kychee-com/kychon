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
import { eventDayKey, formatEventDateTime } from '@/lib/event-display';
import type { Event } from '@/schemas/event';

type CalendarFilter = 'all' | 'members' | 'open' | 'my_rsvps' | 'past';

const FILTERS: Array<{ label: string; value: CalendarFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Members', value: 'members' },
  { label: 'Open', value: 'open' },
  { label: 'My RSVPs', value: 'my_rsvps' },
  { label: 'Past', value: 'past' },
];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  next.setDate(date.getDate() - date.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setMonth(date.getMonth() + amount);
  return startOfMonth(next);
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function weekdayLabels(): string[] {
  const start = startOfWeek(new Date(2026, 0, 4));
  return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(addDays(start, index)));
}

function visibleDays(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

function isPastEvent(event: Event, now: Date): boolean {
  return new Date(event.starts_at) < startOfDay(now);
}

function filterEvents(events: Event[], filter: CalendarFilter, myRsvpEventIds: Set<number>, now: Date): Event[] {
  return events.filter((event) => {
    if (filter === 'members' && !event.is_members_only) return false;
    if (filter === 'open' && event.is_members_only) return false;
    if (filter === 'my_rsvps' && !myRsvpEventIds.has(event.id)) return false;
    if (filter === 'past') return isPastEvent(event, now);
    return !isPastEvent(event, now);
  });
}

function eventsByDay(events: Event[]): Map<string, Event[]> {
  const byDay = new Map<string, Event[]>();
  for (const event of events) {
    const key = eventDayKey(event, siteConfig) || dayKey(new Date(event.starts_at));
    const list = byDay.get(key) || [];
    list.push(event);
    byDay.set(key, list);
  }
  return byDay;
}

function EventMeta({ event }: { event: Event }) {
  const dateTime = formatEventDateTime(event, undefined, siteConfig, { dateStyle: 'card' });
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
  const dateTime = formatEventDateTime(event, undefined, siteConfig, { dateStyle: 'card' });
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
  const dateTime = formatEventDateTime(event, undefined, siteConfig, { dateStyle: 'agenda' });
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
  month,
}: {
  days: Date[];
  events: Map<string, Event[]>;
  month: Date;
}) {
  const today = new Date();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {weekdayLabels().map((label) => (
          <div className="px-2 py-2" key={label}>
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-7 sm:divide-x sm:divide-y-0">
        {days.map((date) => {
          const key = dayKey(date);
          const dayEvents = events.get(key) || [];
          const inMonth = date.getMonth() === month.getMonth();
          return (
            <div className={`min-h-28 space-y-2 p-3 ${inMonth ? 'bg-background' : 'bg-muted/20 text-muted-foreground'}`} key={key}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                    sameDay(date, today) ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  {date.getDate()}
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

export default function CalendarPageApp() {
  const [events, setEvents] = useState<Event[]>([]);
  const [myRsvpEventIds, setMyRsvpEventIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCalendar = useCallback(async () => {
    setLoading(true);
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

  const filteredEvents = useMemo(() => {
    return filterEvents(events, filter, myRsvpEventIds, new Date()).sort((left, right) => left.starts_at.localeCompare(right.starts_at));
  }, [events, filter, myRsvpEventIds]);
  const visible = useMemo(() => visibleDays(month), [month]);
  const dayEvents = useMemo(() => eventsByDay(filteredEvents), [filteredEvents]);

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
              <Button aria-label="Previous month" onClick={() => setMonth((value) => addMonths(value, -1))} size="icon" type="button" variant="outline">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={() => setMonth(startOfMonth(new Date()))} type="button" variant="outline">
                Today
              </Button>
              <Button aria-label="Next month" onClick={() => setMonth((value) => addMonths(value, 1))} size="icon" type="button" variant="outline">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-lg font-semibold">{monthLabel(month)}</div>
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
            <CalendarGrid days={visible} events={dayEvents} month={month} />
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
