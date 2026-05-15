import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarPlus, ChevronLeft, ChevronRight, X } from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/kychon/ui';
import { cn } from '@/lib/ui/cn';

export interface EventsCalendarShellProps {
  configJson: string;
  editableHeadingPath?: string;
  heading?: string;
}

export type EventsCalendarViewMode = 'month' | 'week' | 'agenda';
export type EventsCalendarFilter = 'all' | 'members' | 'open' | 'my_rsvps' | 'past';
export type EventsCalendarDensity = 'glance' | 'light' | 'rich';

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

export interface EventsCalendarEmptyProps {
  message: string;
}

export interface EventsCalendarPeekAvatar {
  avatarUrl?: string | null;
  initial: string;
  name: string;
}

export interface EventsCalendarPeekCapacity {
  label: string;
  tone: 'filling' | 'sold';
}

export interface EventsCalendarChipProps {
  avatarOverflow: number;
  avatars: EventsCalendarPeekAvatar[];
  capacity: EventsCalendarPeekCapacity | null;
  day: string;
  density: EventsCalendarDensity;
  href: string;
  id: number;
  isLive: boolean;
  isMembersOnly: boolean;
  liveNowLabel: string;
  membersOnlyLabel: string;
  thumbUrl?: string | null;
  time: string;
  title: string;
}

export interface EventsCalendarMoreButtonProps {
  day: string;
  label: string;
}

export interface EventsCalendarMonthCell {
  ariaLabel: string;
  chips: EventsCalendarChipProps[];
  day: string;
  dayLabel: string;
  focused: boolean;
  inMonth: boolean;
  isToday: boolean;
  moreButton: EventsCalendarMoreButtonProps | null;
}

export interface EventsCalendarMonthViewProps {
  density: EventsCalendarDensity;
  label: string;
  liveText: string;
  rows: EventsCalendarMonthCell[][];
  weekdays: string[];
}

export interface EventsCalendarAgendaDay {
  chips: EventsCalendarChipProps[];
  heading: string;
  isToday: boolean;
}

export interface EventsCalendarAgendaViewProps {
  days: EventsCalendarAgendaDay[];
  emptyMessage: string;
}

export interface EventsCalendarWeekDay {
  chips: EventsCalendarChipProps[];
  day: string;
  dayLabel: string;
  isToday: boolean;
  weekdayLabel: string;
}

export interface EventsCalendarWeekViewProps {
  days: EventsCalendarWeekDay[];
}

export interface EventsCalendarPeekItem {
  avatarOverflow: number;
  avatars: EventsCalendarPeekAvatar[];
  capacity: EventsCalendarPeekCapacity | null;
  href: string;
  id: number;
  isLive: boolean;
  isMembersOnly: boolean;
  location?: string | null;
  time: string;
  title: string;
}

export interface EventsCalendarPeekOverlayProps {
  addToCalendarLabel: string;
  closeLabel: string;
  heading: string;
  items: EventsCalendarPeekItem[];
  liveNowLabel: string;
  membersOnlyLabel: string;
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

function EventsCalendarEmpty({ message }: EventsCalendarEmptyProps) {
  return (
    <Card className="border-dashed shadow-none" data-events-calendar-empty>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
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

function EventsCalendarAvatarStack({
  overflow,
  people,
}: {
  overflow: number;
  people: EventsCalendarPeekAvatar[];
}) {
  if (!people.length) return null;

  return (
    <div className="flex items-center -space-x-2" data-events-calendar-peek-avatars>
      {people.map((person, index) => (
        <Avatar className="h-6 w-6 border border-background" key={`${person.name}-${index}`}>
          {person.avatarUrl ? <AvatarImage alt={person.name} src={person.avatarUrl} /> : null}
          <AvatarFallback className="text-[10px]">{person.initial}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-background bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function EventsCalendarChip({
  avatarOverflow,
  avatars,
  capacity,
  day,
  density,
  href,
  id,
  isLive,
  isMembersOnly,
  liveNowLabel,
  membersOnlyLabel,
  thumbUrl,
  time,
  title,
}: EventsCalendarChipProps) {
  if (density === 'glance') {
    return (
      <a
        aria-label={`${time} ${title}`.trim()}
        className={cn('block h-2 rounded-full border hover:no-underline', isLive ? 'border-primary bg-primary' : 'border-primary/40 bg-primary/60')}
        data-day={day}
        data-event-id={id}
        data-events-calendar-chip
        draggable
        href={href}
      >
        <span className="sr-only">{`${time} ${title}`.trim()}</span>
      </a>
    );
  }

  return (
    <a
      className={cn(
        'flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md border bg-card px-2 py-1 text-xs text-card-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground hover:no-underline',
        density === 'rich' ? 'min-h-10' : 'min-h-8',
        isLive ? 'border-primary/50' : 'border-border',
      )}
      data-day={day}
      data-event-id={id}
      data-events-calendar-chip
      draggable
      href={href}
    >
      {thumbUrl ? (
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 rounded bg-muted bg-cover bg-center"
          style={{ backgroundImage: `url('${thumbUrl}')` }}
        />
      ) : null}
      {isLive ? <span aria-label={liveNowLabel} className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" role="img" /> : null}
      <span className="min-w-0 truncate tabular-nums text-muted-foreground">{time}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      {isMembersOnly ? (
        <Badge aria-label={membersOnlyLabel} className="shrink-0 px-1.5 py-0 text-[10px]" variant="outline">
          {membersOnlyLabel}
        </Badge>
      ) : null}
      {capacity ? (
        <Badge className="shrink-0 px-1.5 py-0 text-[10px]" variant={capacity.tone === 'sold' ? 'destructive' : 'secondary'}>
          {capacity.label}
        </Badge>
      ) : null}
      {density === 'rich' ? <EventsCalendarAvatarStack overflow={avatarOverflow} people={avatars} /> : null}
    </a>
  );
}

function EventsCalendarMoreButton({ day, label }: EventsCalendarMoreButtonProps) {
  return (
    <Button
      className="h-auto justify-start px-1 py-0 text-xs"
      data-day-peek={day}
      size="sm"
      type="button"
      variant="link"
    >
      {label}
    </Button>
  );
}

function EventsCalendarMonthView({ density, label, liveText, rows, weekdays }: EventsCalendarMonthViewProps) {
  return (
    <>
      <Card className="overflow-hidden shadow-none" data-events-calendar-month role="grid" aria-label={label}>
        <div className="grid grid-cols-7 border-b bg-muted/50" role="row">
          {weekdays.map((weekday, index) => (
            <div className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground" key={`${weekday}-${index}`} role="columnheader">
              {weekday}
            </div>
          ))}
        </div>
        {rows.map((row, rowIndex) => (
          <div className="grid grid-cols-7" key={`row-${rowIndex}`} role="row">
            {row.map((cell, cellIndex) => (
              <div
                aria-label={cell.ariaLabel}
                className={cn(
                  'flex min-h-24 min-w-0 flex-col gap-1 border-b border-r p-1.5 outline-none last:border-r-0',
                  rowIndex === rows.length - 1 ? 'border-b-0' : '',
                  cell.inMonth ? 'bg-card' : 'bg-muted/30',
                  cell.focused ? 'ring-2 ring-inset ring-primary' : '',
                )}
                data-day={cell.day}
                data-events-calendar-cell
                key={`${cell.day}-${cellIndex}`}
                role="gridcell"
                tabIndex={cell.focused ? 0 : -1}
              >
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums text-muted-foreground',
                    cell.isToday ? 'bg-accent text-accent-foreground font-semibold' : '',
                    cell.inMonth ? '' : 'opacity-45',
                  )}
                >
                  {cell.dayLabel}
                </span>
                <div className={cn('flex min-w-0 flex-1 gap-1', density === 'glance' ? 'flex-row flex-wrap content-start' : 'flex-col')}>
                  {cell.chips.map((chip) => <EventsCalendarChip {...chip} key={chip.id} />)}
                  {cell.moreButton ? <EventsCalendarMoreButton {...cell.moreButton} /> : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      </Card>
      <div className="sr-only" aria-live="polite" data-events-calendar-live-region>
        {liveText}
      </div>
    </>
  );
}

function EventsCalendarAgendaView({ days, emptyMessage }: EventsCalendarAgendaViewProps) {
  if (!days.length) return <EventsCalendarEmpty message={emptyMessage} />;

  return (
    <div className="flex flex-col gap-4" data-events-calendar-agenda>
      {days.map((day) => (
        <section data-events-calendar-agenda-day key={day.heading}>
          <h4
            className={cn(
              'sticky top-0 z-10 mb-2 border-b bg-background py-2 text-sm font-semibold uppercase text-muted-foreground tracking-normal',
              day.isToday ? 'text-accent' : '',
            )}
          >
            {day.heading}
          </h4>
          <div className="flex flex-col gap-2">
            {day.chips.map((chip) => <EventsCalendarChip {...chip} key={chip.id} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventsCalendarWeekView({ days }: EventsCalendarWeekViewProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7" data-events-calendar-week>
      {days.map((day) => (
        <Card
          className={cn('min-h-48 shadow-none', day.isToday ? 'border-primary' : '')}
          data-day={day.day}
          data-events-calendar-week-day
          key={day.day}
        >
          <CardHeader className="items-center border-b p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-normal">{day.weekdayLabel}</div>
            <CardTitle className="text-lg tracking-normal">{day.dayLabel}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 p-2">
            {day.chips.length ? day.chips.map((chip) => <EventsCalendarChip {...chip} key={chip.id} />) : (
              <div className="min-h-8 rounded-md border border-dashed" data-events-calendar-week-empty />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EventsCalendarPeekOverlay({
  addToCalendarLabel,
  closeLabel,
  heading,
  items,
  liveNowLabel,
  membersOnlyLabel,
}: EventsCalendarPeekOverlayProps) {
  return (
    <Card
      aria-label={heading}
      aria-modal="false"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80vh] w-full overflow-y-auto rounded-b-none p-0 shadow-lg sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(28rem,90vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
      data-events-calendar-peek
      role="dialog"
    >
      <Button
        aria-label={closeLabel}
        className="absolute right-2 top-2"
        data-events-calendar-peek-close
        size="icon"
        type="button"
        variant="ghost"
      >
        <X />
      </Button>
      <CardHeader className="pb-3 pr-12">
        <CardTitle className="text-base tracking-normal">{heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item) => (
            <li className="border-b border-border pb-3 last:border-0 last:pb-0" key={item.id}>
              <a className="flex items-center gap-2 font-medium text-foreground hover:underline" href={item.href}>
                {item.isLive ? (
                  <span aria-label={liveNowLabel} className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" role="img" />
                ) : null}
                <span className="shrink-0 tabular-nums text-muted-foreground">{item.time}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.isMembersOnly ? (
                  <Badge aria-label={membersOnlyLabel} className="shrink-0" variant="secondary">
                    {membersOnlyLabel}
                  </Badge>
                ) : null}
                {item.capacity ? (
                  <Badge className="shrink-0" variant={item.capacity.tone === 'sold' ? 'destructive' : 'secondary'}>
                    {item.capacity.label}
                  </Badge>
                ) : null}
              </a>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{item.location || ''}</span>
                <EventsCalendarAvatarStack overflow={item.avatarOverflow} people={item.avatars} />
              </div>
              <div className="mt-2">
                <Button data-event-id={item.id} data-events-calendar-peek-ics size="sm" type="button">
                  <CalendarPlus />
                  {addToCalendarLabel}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function renderEventsCalendarShellHtml(props: EventsCalendarShellProps): string {
  return renderToStaticMarkup(<EventsCalendarShell {...props} />);
}

export function renderEventsCalendarControlsHtml(props: EventsCalendarControlsProps): string {
  return renderToStaticMarkup(<EventsCalendarControls {...props} />);
}

export function renderEventsCalendarChipHtml(props: EventsCalendarChipProps): string {
  return renderToStaticMarkup(<EventsCalendarChip {...props} />);
}

export function renderEventsCalendarMoreButtonHtml(props: EventsCalendarMoreButtonProps): string {
  return renderToStaticMarkup(<EventsCalendarMoreButton {...props} />);
}

export function renderEventsCalendarMonthViewHtml(props: EventsCalendarMonthViewProps): string {
  return renderToStaticMarkup(<EventsCalendarMonthView {...props} />);
}

export function renderEventsCalendarAgendaViewHtml(props: EventsCalendarAgendaViewProps): string {
  return renderToStaticMarkup(<EventsCalendarAgendaView {...props} />);
}

export function renderEventsCalendarWeekViewHtml(props: EventsCalendarWeekViewProps): string {
  return renderToStaticMarkup(<EventsCalendarWeekView {...props} />);
}

export function renderEventsCalendarEmptyHtml(props: EventsCalendarEmptyProps): string {
  return renderToStaticMarkup(<EventsCalendarEmpty {...props} />);
}

export function renderEventsCalendarPeekOverlayHtml(props: EventsCalendarPeekOverlayProps): string {
  return renderToStaticMarkup(<EventsCalendarPeekOverlay {...props} />);
}
