import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALENDAR_FIRST_PAINT_MARGIN_MS, calendarFirstPaintEvents } from '../../src/lib/calendar-first-paint';
import type { Event } from '../../src/schemas/event';

const now = new Date('2026-10-14T09:00:00Z');
const event = (id: number, starts_at: string) => ({ id, title: `Event ${id}`, starts_at }) as unknown as Event;

describe('calendarFirstPaintEvents', () => {
  it('keeps upcoming events and drops the archive (NSGS: 349 events back to 2011)', () => {
    const rows = [
      event(1, '2011-05-12T00:00:00Z'),
      event(2, '2026-09-30T18:00:00Z'),
      event(3, '2026-10-14T00:30:00Z'),
      event(4, '2026-11-14T19:00:00Z'),
      event(5, '2027-05-08T18:00:00Z'),
    ];
    expect(calendarFirstPaintEvents(rows, now).map((e) => e.id)).toEqual([3, 4, 5]);
  });

  it('keeps a margin for local days that start before the UTC instant', () => {
    const edge = new Date(now.getTime() - CALENDAR_FIRST_PAINT_MARGIN_MS).toISOString();
    expect(calendarFirstPaintEvents([event(1, edge)], now)).toHaveLength(1);
  });

  it('never drops an event whose start it cannot read', () => {
    expect(calendarFirstPaintEvents([event(1, 'not a date')], now)).toHaveLength(1);
  });
});

describe('SSR pages start their chrome reads before their own', () => {
  const pages = join(import.meta.dirname, '../../src/pages');
  it.each([
    ['calendar.astro', 'calendar', 'ssrEventsList'],
    ['event.astro', 'event', 'ssrEventGet'],
    ['search.astro', 'search', 'ssrSearchQuery'],
  ])('%s prefetches its chrome first', (file, slug, ownRead) => {
    const source = readFileSync(join(pages, file), 'utf8');
    const prefetch = source.indexOf(`prefetchSsrChrome(Astro, '${slug}')`);
    expect(prefetch).toBeGreaterThan(-1);
    expect(prefetch).toBeLessThan(source.indexOf(`await ${ownRead}`));
  });

  it('calendar asks the API for first-paint events only, and embeds only those', () => {
    const source = readFileSync(join(pages, 'calendar.astro'), 'utf8');
    expect(source).toContain('startsAfter: calendarFirstPaintCutoff(renderedAt)');
    expect(source).toContain('calendarFirstPaintEvents(');
  });

  it('Portal awaits the prefetched header rows', () => {
    const portal = readFileSync(join(import.meta.dirname, '../../src/layouts/Portal.astro'), 'utf8');
    expect(portal).toMatch(/prefetchedHeaderSections\(Astro\.locals, pageSlug\)/);
  });
});
