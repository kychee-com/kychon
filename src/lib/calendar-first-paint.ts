import type { Event } from '../schemas/event';

/**
 * The calendar's default view hides events that started before today
 * (CalendarPageApp `isPastEvent`), in the grid and the agenda alike. "Today"
 * is a local day that can begin up to a day before the UTC instant, so keep a
 * two-day margin; anything older is filtered out on screen anyway.
 */
export const CALENDAR_FIRST_PAINT_MARGIN_MS = 2 * 24 * 60 * 60 * 1000;

/** The earliest start `/calendar` needs for first paint. */
export function calendarFirstPaintCutoff(now: Date): Date {
  return new Date(now.getTime() - CALENDAR_FIRST_PAINT_MARGIN_MS);
}

/** The events `/calendar` embeds for first paint; the island loads the rest. */
export function calendarFirstPaintEvents(events: Event[], now: Date): Event[] {
  const cutoff = calendarFirstPaintCutoff(now).getTime();
  return events.filter((event) => {
    const startsAt = Date.parse(event.starts_at);
    return Number.isNaN(startsAt) || startsAt >= cutoff;
  });
}
