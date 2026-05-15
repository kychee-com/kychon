import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CalendarDays, MapPin } from 'lucide-react';

import { Card, CardContent } from '@/components/kychon/ui';
import { get } from '@/lib/api';
import { siteConfig } from '@/lib/config';
import { formatEventDateTime } from '@/lib/event-display';
import { cn } from '@/lib/ui/cn';

type EventsListLayout = 'grid' | 'list' | 'sidebar';
type EventsListFilter = 'past' | 'this_week' | 'upcoming';

interface EventsListConfig {
  color_scheme?: string;
  count?: number;
  filter?: EventsListFilter;
  heading?: string;
  layout?: EventsListLayout;
  show_image?: boolean;
  show_location?: boolean;
  show_time?: boolean;
}

interface EventsListProps {
  config: EventsListConfig;
  headingEditablePath?: string;
}

type EventsListState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; events: EventRow[] };

interface EventRow {
  cover_image_url?: string | null;
  ends_at?: string | null;
  id?: number | string | null;
  image_url?: string | null;
  location?: string | null;
  starts_at?: string | null;
  timezone?: string | null;
  title?: string | null;
}

const roots = new WeakMap<HTMLElement, Root>();
const EVENTS_LIST_FILTER_DAYS = 7;
const ALLOWED_LAYOUTS = new Set<EventsListLayout>(['grid', 'list', 'sidebar']);
const ALLOWED_FILTERS = new Set<EventsListFilter>(['past', 'this_week', 'upcoming']);

function normalizeLayout(value: unknown): EventsListLayout {
  return ALLOWED_LAYOUTS.has(value as EventsListLayout) ? (value as EventsListLayout) : 'sidebar';
}

function normalizeFilter(value: unknown): EventsListFilter {
  return ALLOWED_FILTERS.has(value as EventsListFilter) ? (value as EventsListFilter) : 'upcoming';
}

function normalizeCount(value: unknown): number {
  return Math.max(1, Math.min(50, Number(value) || 4));
}

function eventsQuery(config: EventsListConfig): string {
  const count = normalizeCount(config.count);
  const filter = normalizeFilter(config.filter);
  const nowIso = new Date().toISOString();
  if (filter === 'past') return `events?starts_at=lt.${nowIso}&order=starts_at.desc&limit=${count}`;
  if (filter === 'this_week') {
    const inAWeek = new Date(Date.now() + EVENTS_LIST_FILTER_DAYS * 86400 * 1000).toISOString();
    return `events?and=(starts_at.gte.${nowIso},starts_at.lt.${inAWeek})&order=starts_at.asc&limit=${count}`;
  }
  return `events?starts_at=gte.${nowIso}&order=starts_at.asc&limit=${count}`;
}

function safeImageSrc(value: unknown): string {
  const src = String(value ?? '').trim();
  if (!src || src.length > 2048 || /[\r\n\t\x00-\x1f]/.test(src)) return '';
  return /^(https?:\/\/[^\s]+|\/[^\s]*|\.[./][^\s]*)$/i.test(src) ? src : '';
}

function EventsListIsland({ config, headingEditablePath }: EventsListProps) {
  const [state, setState] = React.useState<EventsListState>({ status: 'loading' });
  const layout = normalizeLayout(config.layout);
  const count = normalizeCount(config.count);
  const heading = String(config.heading || '').trim();

  React.useEffect(() => {
    let ignore = false;
    async function refresh(): Promise<void> {
      try {
        const events = await get(eventsQuery(config)) as EventRow[];
        if (ignore) return;
        setState(events.length > 0 ? { status: 'ready', events } : { status: 'empty' });
      } catch (error) {
        console.warn('events_list hydrate failed:', error);
        if (!ignore) setState({ status: 'empty' });
      }
    }
    void refresh();
    return () => {
      ignore = true;
    };
  }, [config]);

  return (
    <div className="space-y-4" data-events-list>
      {heading && (
        <h2 className="text-2xl font-semibold tracking-normal" data-editable={headingEditablePath || undefined}>
          {heading}
        </h2>
      )}
      {state.status === 'loading' && <EventsLoading count={count} layout={layout} />}
      {state.status === 'empty' && (
        <p className="text-sm text-muted-foreground" data-events-list-empty>
          No upcoming events.
        </p>
      )}
      {state.status === 'ready' && (
        <div
          className={cn(
            layout === 'grid' && 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
            layout === 'list' && 'grid gap-2',
            layout === 'sidebar' && 'grid gap-3',
          )}
        >
          {state.events.map((event) => (
            <EventCard
              event={event}
              key={String(event.id ?? `${event.title}-${event.starts_at}`)}
              layout={layout}
              showImage={config.show_image === true}
              showLocation={config.show_location !== false}
              showTime={config.show_time !== false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventsLoading({ count, layout }: { count: number; layout: EventsListLayout }) {
  return (
    <div
      className={cn(
        layout === 'grid' && 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
        layout !== 'grid' && 'grid gap-2',
      )}
      aria-label="Loading events"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EventCard({
  event,
  layout,
  showImage,
  showLocation,
  showTime,
}: {
  event: EventRow;
  layout: EventsListLayout;
  showImage: boolean;
  showLocation: boolean;
  showTime: boolean;
}) {
  const dateTime = formatEventDateTime(event, undefined, siteConfig, { dateStyle: 'card' });
  const href = event.id ? `/event?id=${encodeURIComponent(String(event.id))}` : '/events';
  const imageSrc = safeImageSrc(event.image_url || event.cover_image_url);
  const showImageBlock = layout === 'grid' && showImage && imageSrc;

  return (
    <Card data-event-card>
      <CardContent className="p-0">
        <a
          className={cn(
            'block text-foreground no-underline hover:bg-accent hover:text-accent-foreground',
            layout === 'grid' ? 'p-3' : 'p-4',
          )}
          href={href}
        >
          {showImageBlock && (
            <img
              alt=""
              className="mb-3 aspect-video w-full rounded-md object-cover"
              loading="lazy"
              src={imageSrc}
            />
          )}
          <div className={cn('flex gap-3', layout === 'grid' && 'items-start')}>
            {dateTime.dateLabel && (
              <div className="flex w-24 shrink-0 flex-col rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-semibold text-primary">{dateTime.dateLabel}</span>
                {showTime && dateTime.timeRangeLabel && (
                  <span className="text-xs text-muted-foreground">{dateTime.timeRangeLabel}</span>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="m-0 text-base font-semibold leading-6">{event.title || 'Untitled event'}</h3>
              {showLocation && event.location && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{event.location}</span>
                </p>
              )}
              {!dateTime.dateLabel && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Date to be announced
                </p>
              )}
            </div>
          </div>
        </a>
      </CardContent>
    </Card>
  );
}

export function mountEventsListIsland(
  element: HTMLElement,
  props: {
    config: EventsListConfig;
    headingEditablePath?: string;
  },
): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<EventsListIsland {...props} />);
}
