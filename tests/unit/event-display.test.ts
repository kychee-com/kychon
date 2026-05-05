import { describe, expect, it } from 'vitest';
import {
  eventDayKey,
  formatEventDateTime,
  getTimezoneLabel,
  resolveEventTimezone,
} from '../../src/lib/event-display';

describe('event source timezone display', () => {
  it('resolves event override before site default', () => {
    const timezone = resolveEventTimezone(
      { starts_at: '2026-05-05T00:00:00Z', source_timezone: 'Australia/Perth' },
      { event_source_timezone: 'Australia/Sydney' },
    );
    expect(timezone).toBe('Australia/Perth');
  });

  it('formats Australia/Sydney source time for a remote visitor', () => {
    const labels = formatEventDateTime(
      {
        starts_at: '2026-05-05T00:00:00Z',
        ends_at: '2026-05-05T01:30:00Z',
        time_display_mode: 'source',
      },
      'en-US',
      { event_source_timezone: 'Australia/Sydney' },
      { dateStyle: 'long' },
    );

    expect(labels.dateTimeLabel).toContain('Tuesday, May 5, 2026');
    expect(labels.timeRangeLabel).toContain('10:00 AM');
    expect(labels.timeRangeLabel).toContain('11:30 AM');
    expect(labels.timezoneLabel).toMatch(/AEST|GMT\+10/);
  });

  it('uses imported source-visible timezone label when present', () => {
    const labels = formatEventDateTime(
      {
        starts_at: '2026-05-05T00:00:00Z',
        source_timezone: 'Australia/Sydney',
        source_timezone_label: 'Club time',
        time_display_mode: 'source',
      },
      'en-US',
    );

    expect(labels.timezoneLabel).toBe('Club time');
    expect(labels.timeRangeLabel).toContain('Club time');
  });

  it('keeps visitor-local behavior when source display is not selected', () => {
    const labels = formatEventDateTime(
      {
        starts_at: '2026-05-05T00:00:00Z',
        source_timezone: 'Australia/Sydney',
        time_display_mode: 'visitor',
      },
      'en-US',
    );

    expect(labels.timezone).toBeUndefined();
    expect(labels.timezoneLabel).toBe('');
  });

  it('computes day keys in the source timezone', () => {
    const key = eventDayKey(
      {
        starts_at: '2026-05-04T14:30:00Z',
        source_timezone: 'Australia/Sydney',
        time_display_mode: 'source',
      },
      {},
      'en-US',
    );

    expect(key).toBe('2026-05-05');
  });

  it('uses daylight-saving labels for the event date', () => {
    const winter = getTimezoneLabel(new Date('2026-07-01T00:00:00Z'), 'Australia/Sydney', 'en-US');
    const summer = getTimezoneLabel(new Date('2026-01-01T00:00:00Z'), 'Australia/Sydney', 'en-US');

    expect(winter).toMatch(/AEST|GMT\+10/);
    expect(summer).toMatch(/AEDT|GMT\+11/);
    expect(winter).not.toBe(summer);
  });
});
