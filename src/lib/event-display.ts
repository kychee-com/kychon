export type EventTimeDisplayMode = 'visitor' | 'source';

export interface EventTimeSource {
  starts_at?: string | null;
  ends_at?: string | null;
  source_timezone?: string | null;
  source_timezone_label?: string | null;
  time_display_mode?: string | null;
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
  timezone?: string;
  mode: EventTimeDisplayMode;
}

export interface EventDateTimeFormatOptions {
  dateStyle?: 'card' | 'long' | 'agenda';
  includeTimezone?: boolean;
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
  };
}

export function eventDayKey(
  event: EventTimeSource,
  config: EventDisplayConfig = {},
  locale = 'en',
): string {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  if (!start || Number.isNaN(start.getTime())) return '';
  const timezone = shouldUseSourceTime(event, config) ? resolveEventTimezone(event, config) : undefined;
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(start);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}
