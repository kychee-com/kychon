// @vitest-environment happy-dom
/**
 * Server-rendered event islands must hydrate without a text mismatch even
 * though the browser formats times differently from the server (visitor zone,
 * site display settings loaded client-side). A mismatch throws React #418 and
 * re-renders the whole island on the client; live /event, /events and
 * /calendar did exactly that once events were server-rendered.
 */
import { act, createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarPageApp from '../../src/components/kychon/CalendarPageApp';
import EventDetailPageApp from '../../src/components/kychon/EventDetailPageApp';
import EventsPageApp from '../../src/components/kychon/EventsPageApp';
import { siteConfig } from '../../src/lib/config';
import { formatEventDateTimeStable } from '../../src/lib/event-display';
import type { Event } from '../../src/schemas/event';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const event = {
  id: 7,
  title: 'Spring Gala',
  description: '<p>Dinner and dancing.</p>',
  location: 'Hall',
  starts_at: '2099-05-01T18:00:00Z',
  ends_at: '2099-05-01T20:00:00Z',
  capacity: null,
  image_url: null,
  is_members_only: false,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
} as Event;

function clearSiteConfig() {
  for (const key of Object.keys(siteConfig)) delete siteConfig[key];
}

const originalTimeZone = process.env.TZ;

function setProcessTimeZone(timezone: string | undefined) {
  if (timezone === undefined) delete process.env.TZ;
  else process.env.TZ = timezone;
}

afterEach(() => {
  clearSiteConfig();
  clearBodyFixture();
  setProcessTimeZone(originalTimeZone);
  vi.useRealTimers();
});

describe('formatEventDateTimeStable', () => {
  it('pins events without a source zone to labelled UTC', () => {
    expect(formatEventDateTimeStable(event).timeRangeLabel).toBe('6:00 PM - 8:00 PM UTC');
  });

  it("keeps the event's own source zone and label", () => {
    const labels = formatEventDateTimeStable({
      ...event,
      source_timezone: 'America/Chicago',
      source_timezone_label: 'Central',
      time_display_mode: 'visitor',
    });
    expect(labels.timeRangeLabel).toBe('1:00 PM - 3:00 PM Central');
  });

  it('ignores an invalid source zone and its label', () => {
    const labels = formatEventDateTimeStable({
      ...event,
      source_timezone: 'Mars/Olympus',
      source_timezone_label: 'Mars',
    });
    expect(labels.timeRangeLabel).toBe('6:00 PM - 8:00 PM UTC');
  });
});

describe('EventDetailPageApp hydration', () => {
  it('hydrates cleanly when the browser would format the time differently, then switches labels', async () => {
    clearSiteConfig();
    const html = renderToString(createElement(EventDetailPageApp, { initialEvent: event }));
    expect(html).toContain('6:00 PM - 8:00 PM UTC');

    // The browser has the site's display settings the server render lacked.
    siteConfig.event_time_display_mode = 'source';
    siteConfig.event_source_timezone = 'America/Chicago';

    const container = bodyFixture(`<div data-island>${html}</div>`).firstElementChild as Element;
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, createElement(EventDetailPageApp, { initialEvent: event }), {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });

    expect(recoverable).toEqual([]);
    expect(container.textContent).toContain('1:00 PM - 3:00 PM');
    expect(container.textContent).not.toContain('UTC');
  });
});

describe('EventsPageApp hydration', () => {
  it('hydrates baked event cards cleanly when the browser would format the time differently', async () => {
    clearSiteConfig();
    const html = renderToString(createElement(EventsPageApp, { initialEvents: [event] }));
    expect(html).toContain('6:00 PM - 8:00 PM UTC');

    siteConfig.event_time_display_mode = 'source';
    siteConfig.event_source_timezone = 'America/Chicago';

    const container = bodyFixture(`<div data-island>${html}</div>`).firstElementChild as Element;
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, createElement(EventsPageApp, { initialEvents: [event] }), {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });

    expect(recoverable).toEqual([]);
    expect(container.textContent).toContain('1:00 PM - 3:00 PM');
  });
});

describe('CalendarPageApp hydration', () => {
  // A month grid around events that sit near a UTC day boundary, so the
  // server (UTC, no site settings) and the browser (another zone, or the
  // site's source zone) put them on different days.
  const renderedAt = '2099-05-01T12:00:00.000Z';
  const lateSocial = {
    ...event,
    id: 21,
    title: 'Late Social',
    starts_at: '2099-05-01T23:30:00Z',
    ends_at: '2099-05-02T00:30:00Z',
  } as Event;
  const earlyRide = {
    ...event,
    id: 22,
    title: 'Early Ride',
    starts_at: '2099-05-02T03:00:00Z',
    ends_at: '2099-05-02T04:00:00Z',
  } as Event;
  const initialEvents = [lateSocial, earlyRide];

  function dayText(container: Element, key: string): string {
    return container.querySelector(`[data-day="${key}"]`)?.textContent ?? '';
  }

  async function serverRenderThenHydrate(
    prepareBrowser: () => void,
  ): Promise<{ container: Element; recoverable: unknown[] }> {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(renderedAt));
    setProcessTimeZone('UTC');
    clearSiteConfig();
    const html = renderToString(createElement(CalendarPageApp, { initialEvents, renderedAt }));
    expect(html).toContain('May 2099');
    expect(html).toContain('Late Social');

    prepareBrowser();

    const container = bodyFixture(`<div data-island>${html}</div>`).firstElementChild as Element;
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, createElement(CalendarPageApp, { initialEvents, renderedAt }), {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });
    return { container, recoverable };
  }

  it('hydrates cleanly when the site source zone moves events to another day, then buckets them there', async () => {
    const { container, recoverable } = await serverRenderThenHydrate(() => {
      siteConfig.event_time_display_mode = 'source';
      siteConfig.event_source_timezone = 'Asia/Tokyo';
    });

    expect(recoverable).toEqual([]);
    expect(dayText(container, '2099-05-01')).not.toContain('Late Social');
    expect(dayText(container, '2099-05-02')).toContain('Late Social');
    expect(dayText(container, '2099-05-02')).toContain('Early Ride');
  });

  it("hydrates cleanly in a visitor zone west of UTC, then buckets events on the visitor's days", async () => {
    const { container, recoverable } = await serverRenderThenHydrate(() => {
      setProcessTimeZone('America/Los_Angeles');
    });

    expect(recoverable).toEqual([]);
    expect(dayText(container, '2099-05-01')).toContain('Late Social');
    expect(dayText(container, '2099-05-01')).toContain('Early Ride');
    expect(dayText(container, '2099-05-02')).not.toContain('Early Ride');
    expect(container.textContent).toContain('May 2099');
  });
});
