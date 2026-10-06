/**
 * kychon#188: all-day (date-only) events show their date or date range and no
 * time, read in the event's source zone whatever the display mode, so an
 * imported trip stored as local midnight never renders "12:00 AM".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allDayRange,
  allDayStartIso,
  eventDayKey,
  eventDayKeyStable,
  formatEventDateTime,
  formatEventDateTimeStable,
} from '../../src/lib/event-display';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const SCHEMA = readFileSync(join(process.cwd(), 'schema.sql'), 'utf8');

// OCEY's imported "Hike in Turkey": local midnight in Toronto, no end.
const HIKE = {
  starts_at: '2026-10-18T04:00:00+00:00',
  ends_at: null,
  source_timezone: 'America/Toronto',
  source_timezone_label: 'EDT',
  time_display_mode: 'source',
  all_day: true,
};

describe('all-day event display', () => {
  it('shows the date and no time for an imported date-only event', () => {
    const labels = formatEventDateTime(HIKE, 'en-US', {}, { dateStyle: 'long' });
    expect(labels.allDay).toBe(true);
    expect(labels.dateTimeLabel).toBe('Sunday, October 18, 2026');
    expect(labels.dateTimeLabel).not.toMatch(/12:00|AM|EDT/);
    expect(labels.timeLabel).toBe('');
    expect(labels.timezoneLabel).toBe('');
    expect(labels.timeRangeLabel).toBe('All day');
  });

  it('keeps the source date in visitor mode instead of shifting it', () => {
    const labels = formatEventDateTime({ ...HIKE, time_display_mode: 'visitor' }, 'en-US', {}, { dateStyle: 'card' });
    expect(labels.dateLabel).toBe('Oct 18, 2026');
    expect(eventDayKey({ ...HIKE, time_display_mode: 'visitor' })).toBe('2026-10-18');
  });

  it('reads the site event timezone when the event has none', () => {
    // Midnight Sydney is the previous day in UTC.
    const event = { starts_at: '2026-10-17T13:00:00Z', all_day: true };
    expect(eventDayKey(event, { event_source_timezone: 'Australia/Sydney' })).toBe('2026-10-18');
    expect(
      formatEventDateTime(event, 'en-US', { event_source_timezone: 'Australia/Sydney' }, { dateStyle: 'card' })
        .dateLabel,
    ).toBe('Oct 18, 2026');
  });

  it('shows a date range for a multi-day event', () => {
    const trip = { ...HIKE, starts_at: '2027-01-22T05:00:00Z', ends_at: '2027-01-29T05:00:00Z' };
    const labels = formatEventDateTime(trip, 'en-US', {}, { dateStyle: 'card' });
    expect(labels.dateLabel).toMatch(/^Jan 22\s?[–-]\s?29, 2027$/);
    expect(allDayRange(trip)).toEqual({ startDay: '2027-01-22', endDay: '2027-01-29' });
  });

  it('agrees between the stable first pass and the hydrated pass', () => {
    const stable = formatEventDateTimeStable(HIKE, 'en-US', { dateStyle: 'long' });
    const hydrated = formatEventDateTime(HIKE, 'en-US', {}, { dateStyle: 'long' });
    expect(stable.dateTimeLabel).toBe(hydrated.dateTimeLabel);
    expect(eventDayKeyStable(HIKE)).toBe('2026-10-18');
  });

  it('uses a caller-supplied all-day label', () => {
    expect(formatEventDateTime(HIKE, 'en-US', {}, { allDayLabel: 'Toute la journée' }).timeRangeLabel).toBe(
      'Toute la journée',
    );
  });

  it('leaves timed events unchanged', () => {
    const labels = formatEventDateTime({ ...HIKE, all_day: false }, 'en-US', {}, { dateStyle: 'card' });
    expect(labels.allDay).toBe(false);
    expect(labels.timeRangeLabel).toBe('12:00 AM EDT');
  });
});

describe('allDayStartIso', () => {
  it('stores local midnight of the day in the zone', () => {
    expect(allDayStartIso('2026-10-18', 'America/Toronto')).toBe('2026-10-18T04:00:00.000Z');
    expect(allDayStartIso('2027-01-22', 'America/Toronto')).toBe('2027-01-22T05:00:00.000Z');
    expect(allDayStartIso('2026-10-18', 'Australia/Sydney')).toBe('2026-10-17T13:00:00.000Z');
    expect(allDayStartIso('2026-10-18', undefined)).toBe('2026-10-18T00:00:00.000Z');
  });

  it('round-trips through the display zone', () => {
    for (const zone of ['America/Los_Angeles', 'Europe/Berlin', 'Asia/Kolkata', 'Pacific/Auckland']) {
      const starts_at = allDayStartIso('2026-03-29', zone);
      expect(eventDayKey({ starts_at, all_day: true, source_timezone: zone })).toBe('2026-03-29');
    }
  });

  it('rejects a malformed date', () => {
    expect(allDayStartIso('2026-10-18 09:00', 'UTC')).toBeNull();
    expect(allDayStartIso('', 'UTC')).toBeNull();
  });
});

describe('events.all_day migration', () => {
  it('backfills pre-column rows from source_metadata once, then keeps admin edits', async () => {
    const db = await freshKychonDb();
    // A portal from before the column: drop it and stash the port's flag.
    await db.exec('ALTER TABLE events DROP COLUMN all_day');
    await db.exec(`INSERT INTO events (title, starts_at, source_metadata) VALUES
      ('Hike in Turkey', '2026-10-18T04:00:00Z', '{"all_day": true}'),
      ('Ski night', '2027-02-11T13:00:00Z', '{"all_day": false}'),
      ('Picnic', '2027-03-01T17:00:00Z', '{}')`);
    await db.exec(SCHEMA);
    expect(await rows(db, 'SELECT title, all_day FROM events ORDER BY id')).toEqual([
      { title: 'Hike in Turkey', all_day: true },
      { title: 'Ski night', all_day: false },
      { title: 'Picnic', all_day: false },
    ]);

    // An admin turns it off; the next migration must not flip it back.
    await db.exec(`UPDATE events SET all_day = false WHERE title = 'Hike in Turkey'`);
    await db.exec(SCHEMA);
    expect(await rows(db, `SELECT all_day FROM events WHERE title = 'Hike in Turkey'`)).toEqual([{ all_day: false }]);

    await db.exec(`INSERT INTO events (title, starts_at) VALUES ('New', now())`);
    expect(await rows(db, `SELECT all_day FROM events WHERE title = 'New'`)).toEqual([{ all_day: false }]);
  }, 60_000);
});

describe('all-day .ics export', () => {
  it('writes DATE values with an exclusive end', async () => {
    const { icsTimeLines } = await import('../../src/lib/blocks/events-calendar');
    const base = {
      id: 30,
      title: 'Ski trip',
      description: null,
      location: null,
      capacity: null,
      image_url: null,
      is_members_only: false,
      created_by: null,
      created_at: '2026-10-06T00:00:00Z',
    };
    expect(icsTimeLines({ ...base, ...HIKE })).toEqual(['DTSTART;VALUE=DATE:20261018', 'DTEND;VALUE=DATE:20261019']);
    expect(
      icsTimeLines({ ...base, ...HIKE, starts_at: '2027-01-22T05:00:00Z', ends_at: '2027-01-29T05:00:00Z' }),
    ).toEqual(['DTSTART;VALUE=DATE:20270122', 'DTEND;VALUE=DATE:20270130']);
    expect(icsTimeLines({ ...base, ...HIKE, all_day: false })).toEqual([
      'DTSTART:20261018T040000Z',
      'DTEND:20261018T050000Z',
    ]);
  });
});
