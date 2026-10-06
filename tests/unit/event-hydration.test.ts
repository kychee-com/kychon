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
import { afterEach, describe, expect, it } from 'vitest';
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

afterEach(() => {
  clearSiteConfig();
  clearBodyFixture();
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
