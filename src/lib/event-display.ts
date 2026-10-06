export type EventTimeDisplayMode = 'visitor' | 'source';

export interface EventTimeSource {
  starts_at?: string | null;
  ends_at?: string | null;
  source_timezone?: string | null | undefined;
  source_timezone_label?: string | null | undefined;
  time_display_mode?: string | null | undefined;
  all_day?: boolean | null | undefined;
}

export interface EventDisplayConfig {
  event_source_timezone?: string | null;
  event_time_display_mode?: string | null;
}

export interface EventDateTimeLabels {
  dateLabel: string;
  timeLabel: string;
  endTimeLabel: string;
  timezoneLabel: string;
  timeRangeLabel: string;
  dateTimeLabel: string;
  timezone?: string | undefined;
  mode: EventTimeDisplayMode;
  allDay: boolean;
}

export interface EventDateTimeFormatOptions {
  dateStyle?: 'card' | 'long' | 'agenda';
  includeTimezone?: boolean;
  /** What `timeRangeLabel` reads for an all-day event. */
  allDayLabel?: string;
}

const TIME_ZONE_CACHE = new Map<string, boolean>();

export function isValidTimeZone(timezone: string | null | undefined): timezone is string {
  const value = typeof timezone === 'string' ? timezone.trim() : '';
  if (!value) return false;
  const cached = TIME_ZONE_CACHE.get(value);
  if (cached != null) return cached;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date());
    TIME_ZONE_CACHE.set(value, true);
    return true;
  } catch {
    TIME_ZONE_CACHE.set(value, false);
    return false;
  }
}

function normalizeMode(value: string | null | undefined): EventTimeDisplayMode | null {
  return value === 'source' || value === 'visitor' ? value : null;
}

export function resolveEventTimezone(
  event: EventTimeSource,
  config: EventDisplayConfig = {},
): string | undefined {
  const eventTimezone = event.source_timezone;
  if (isValidTimeZone(eventTimezone)) return eventTimezone.trim();
  const siteTimezone = config.event_source_timezone;
  if (isValidTimeZone(siteTimezone)) return siteTimezone.trim();
  return undefined;
}

export function resolveEventTimeDisplayMode(
  event: EventTimeSource,
  config: EventDisplayConfig = {},
): EventTimeDisplayMode {
  return normalizeMode(event.time_display_mode) || normalizeMode(config.event_time_display_mode) || 'visitor';
}

export function isAllDayEvent(event: EventTimeSource): boolean {
  return event.all_day === true;
}

/**
 * The zone an all-day event's dates are read in. A date is not a moment, so it
 * must not shift with the visitor: whatever the display mode, it is the
 * event's source zone (or the site's), else UTC. Imports store an all-day
 * event as local midnight in that zone; the editor does the same
 * (`allDayStartIso`).
 */
export function allDayTimezone(event: EventTimeSource, config: EventDisplayConfig = {}): string {
  return resolveEventTimezone(event, config) || 'UTC';
}

function zoneOffsetMs(at: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at;
}

/**
 * Midnight of `date` (`YYYY-MM-DD`) in `timezone`, as an ISO instant: how an
 * all-day event's `starts_at` (and its last day's `ends_at`) is stored. Null
 * for a malformed date.
 */
export function allDayStartIso(date: string, timezone: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(wall)) return null;
  const zone = isValidTimeZone(timezone) ? timezone.trim() : 'UTC';
  let instant = wall - zoneOffsetMs(wall, zone);
  instant = wall - zoneOffsetMs(instant, zone);
  return new Date(instant).toISOString();
}

export function shouldUseSourceTime(
  event: EventTimeSource,
  config: EventDisplayConfig = {},
): boolean {
  return resolveEventTimeDisplayMode(event, config) === 'source' && !!resolveEventTimezone(event, config);
}

function dateOptions(style: EventDateTimeFormatOptions['dateStyle']): Intl.DateTimeFormatOptions {
  if (style === 'card') return { month: 'short', day: 'numeric', year: 'numeric' };
  if (style === 'agenda') return { weekday: 'long', month: 'short', day: 'numeric' };
  return { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
}

export function getTimezoneLabel(
  date: Date,
  timezone: string | undefined,
  locale = 'en',
): string {
  if (!timezone) return '';
  try {
    const part = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeZoneName: 'short',
      hour: 'numeric',
    }).formatToParts(date).find((p) => p.type === 'timeZoneName');
    return part?.value || '';
  } catch {
    return '';
  }
}

export function formatEventDateTime(
  event: EventTimeSource,
  locale = 'en',
  config: EventDisplayConfig = {},
  opts: EventDateTimeFormatOptions = {},
): EventDateTimeLabels {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const mode = resolveEventTimeDisplayMode(event, config);
  const sourceTimezone = resolveEventTimezone(event, config);
  const timezone = mode === 'source' ? sourceTimezone : undefined;
  const formatBase = timezone ? { timeZone: timezone } : {};
  const includeTimezone = opts.includeTimezone !== false;
  const allDay = isAllDayEvent(event);

  if (!start || Number.isNaN(start.getTime())) {
    return {
      dateLabel: '',
      timeLabel: '',
      endTimeLabel: '',
      timezoneLabel: '',
      timeRangeLabel: '',
      dateTimeLabel: '',
      timezone,
      mode,
      allDay,
    };
  }

  if (allDay) {
    // Dates only: no time, no zone label, and a range when it spans days.
    const zone = allDayTimezone(event, config);
    const format = new Intl.DateTimeFormat(locale, { ...dateOptions(opts.dateStyle), timeZone: zone });
    const range = allDayRange(event, config);
    const dateLabel = range && end && range.endDay !== range.startDay ? format.formatRange(start, end) : format.format(start);
    return {
      dateLabel,
      timeLabel: '',
      endTimeLabel: '',
      timezoneLabel: '',
      timeRangeLabel: opts.allDayLabel ?? 'All day',
      dateTimeLabel: dateLabel,
      timezone: zone,
      mode,
      allDay,
    };
  }

  const dateLabel = new Intl.DateTimeFormat(locale, {
    ...dateOptions(opts.dateStyle),
    ...formatBase,
  }).format(start);
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...formatBase,
  }).format(start);
  const endTimeLabel = end && !Number.isNaN(end.getTime())
    ? new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      ...formatBase,
    }).format(end)
    : '';
  const timezoneLabel = includeTimezone && timezone
    ? (event.source_timezone_label || getTimezoneLabel(start, timezone, locale))
    : '';
  const timeRangeLabel = `${timeLabel}${endTimeLabel ? ` - ${endTimeLabel}` : ''}${timezoneLabel ? ` ${timezoneLabel}` : ''}`;
  return {
    dateLabel,
    timeLabel,
    endTimeLabel,
    timezoneLabel,
    timeRangeLabel,
    dateTimeLabel: `${dateLabel}${timeRangeLabel ? ` at ${timeRangeLabel}` : ''}`,
    timezone,
    mode,
    allDay,
  };
}

export function eventDayKey(
  event: EventTimeSource,
  config: EventDisplayConfig = {},
  locale = 'en',
): string {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  if (!start || Number.isNaN(start.getTime())) return '';
  const timezone = isAllDayEvent(event)
    ? allDayTimezone(event, config)
    : shouldUseSourceTime(event, config) ? resolveEventTimezone(event, config) : undefined;
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(start);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

/**
 * Labels that come out identically on the server and in the browser's
 * hydration pass: pinned to the event's own source timezone (UTC when it has
 * none) and always labelled with it. `formatEventDateTime` in 'visitor' mode
 * formats in the runtime's local zone, which is UTC in the SSR Lambda and the
 * build but the visitor's zone in the browser, so its first-pass output both
 * misstates the time to no-JS readers and fails React hydration (#418).
 */
export function formatEventDateTimeStable(
  event: EventTimeSource,
  locale = 'en',
  opts: EventDateTimeFormatOptions = {},
): EventDateTimeLabels {
  const ownZone = isValidTimeZone(event.source_timezone);
  return formatEventDateTime(
    {
      ...event,
      source_timezone: ownZone ? event.source_timezone : 'UTC',
      source_timezone_label: ownZone ? event.source_timezone_label : null,
      time_display_mode: 'source',
    },
    locale,
    {},
    { ...opts, includeTimezone: true },
  );
}

/**
 * The calendar day (`YYYY-MM-DD`) an event falls on, pinned to the same zone
 * `formatEventDateTimeStable` labels it in (its own source zone, UTC when it
 * has none) so server HTML and the hydration pass bucket it identically.
 */
export function eventDayKeyStable(event: EventTimeSource): string {
  const ownZone = isValidTimeZone(event.source_timezone);
  return eventDayKey({ ...event, source_timezone: ownZone ? event.source_timezone : 'UTC', time_display_mode: 'source' });
}

/**
 * First and last calendar day (`YYYY-MM-DD`) of an all-day event, in
 * `allDayTimezone`. `ends_at` is any instant on the last day (inclusive);
 * without one the event is a single day.
 */
export function allDayRange(
  event: EventTimeSource,
  config: EventDisplayConfig = {},
): { startDay: string; endDay: string } | null {
  const startDay = eventDayKey({ ...event, all_day: true }, config);
  if (!startDay) return null;
  const endDay = event.ends_at ? eventDayKey({ ...event, all_day: true, starts_at: event.ends_at }, config) : '';
  return { startDay, endDay: endDay && endDay > startDay ? endDay : startDay };
}
