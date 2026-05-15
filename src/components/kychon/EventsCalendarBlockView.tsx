import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button, Card, CardContent } from '@/components/kychon/ui';
import { cn } from '@/lib/ui/cn';

export interface EventsCalendarShellProps {
  configJson: string;
  editableHeadingPath?: string;
  heading?: string;
}

export type EventsCalendarViewMode = 'month' | 'week' | 'agenda';
export type EventsCalendarFilter = 'all' | 'members' | 'open' | 'my_rsvps' | 'past';

export interface EventsCalendarControlsLabels {
  agenda: string;
  all: string;
  members: string;
  month: string;
  myRsvps: string;
  nextMonth: string;
  open: string;
  past: string;
  previousMonth: string;
  today: string;
  week: string;
}

export interface EventsCalendarControlsProps {
  activeView: EventsCalendarViewMode;
  filter: EventsCalendarFilter;
  isAuthenticated: boolean;
  labels: EventsCalendarControlsLabels;
  monthLabel: string;
  showFilterChips: boolean;
}

function EventsCalendarShell({ configJson, editableHeadingPath, heading }: EventsCalendarShellProps) {
  return (
    <div className="ky-container" data-block-hydrate="events_calendar" data-config={configJson}>
      {heading ? (
        <h2 className="mb-4 text-2xl font-semibold tracking-normal" data-editable={editableHeadingPath} data-events-calendar-heading>
          {heading}
        </h2>
      ) : null}
      <div aria-label="Loading events" className="grid min-h-32 grid-cols-1 gap-2 sm:grid-cols-2" data-events-calendar-skeleton>
        {Array.from({ length: 4 }, (_, index) => (
          <Card className="shadow-none" data-events-calendar-skeleton-card key={index}>
            <CardContent className="h-24 animate-pulse rounded-md bg-muted p-0" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function activeButtonClass(active: boolean) {
  return cn(active ? '' : 'bg-background', 'shrink-0');
}

function EventsCalendarControls({
  activeView,
  filter,
  isAuthenticated,
  labels,
  monthLabel,
  showFilterChips,
}: EventsCalendarControlsProps) {
  const viewButtons: Array<{ label: string; value: EventsCalendarViewMode }> = [
    { label: labels.month, value: 'month' },
    { label: labels.week, value: 'week' },
    { label: labels.agenda, value: 'agenda' },
  ];
  const filterButtons: Array<{ hidden?: boolean; label: string; value: EventsCalendarFilter }> = [
    { label: labels.all, value: 'all' },
    { label: labels.members, value: 'members' },
    { label: labels.open, value: 'open' },
    { hidden: !isAuthenticated, label: labels.myRsvps, value: 'my_rsvps' },
    { label: labels.past, value: 'past' },
  ];

  return (
    <div className="mb-3 space-y-3" data-events-calendar-controls>
      <Card className="shadow-none" data-events-calendar-nav-card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2" data-events-calendar-nav>
            <Button aria-label={labels.previousMonth} data-nav="prev" size="icon" type="button" variant="outline">
              <ChevronLeft />
            </Button>
            <Button data-nav="today" type="button" variant="outline">
              {labels.today}
            </Button>
            <Button aria-label={labels.nextMonth} data-nav="next" size="icon" type="button" variant="outline">
              <ChevronRight />
            </Button>
          </div>
          <h3 aria-live="polite" className="text-lg font-semibold tracking-normal" data-events-calendar-month-label>
            {monthLabel}
          </h3>
          <div className="flex flex-wrap gap-2" data-events-calendar-view-tabs role="tablist" aria-label="View mode">
            {viewButtons.map((item) => {
              const active = activeView === item.value;
              return (
                <Button
                  aria-pressed={active}
                  className={activeButtonClass(active)}
                  data-view={item.value}
                  key={item.value}
                  size="sm"
                  type="button"
                  variant={active ? 'default' : 'outline'}
                >
                  {item.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {showFilterChips ? (
        <div className="flex flex-wrap gap-2" data-events-calendar-filters role="group" aria-label="Filter">
          {filterButtons.map((item) => {
            if (item.hidden) return null;
            const active = filter === item.value;
            return (
              <Button
                aria-pressed={active}
                className={activeButtonClass(active)}
                data-filter={item.value}
                key={item.value}
                size="sm"
                type="button"
                variant={active ? 'default' : 'outline'}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function renderEventsCalendarShellHtml(props: EventsCalendarShellProps): string {
  return renderToStaticMarkup(<EventsCalendarShell {...props} />);
}

export function renderEventsCalendarControlsHtml(props: EventsCalendarControlsProps): string {
  return renderToStaticMarkup(<EventsCalendarControls {...props} />);
}
