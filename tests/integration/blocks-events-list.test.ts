import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture, clearBodyFixture, escapeHtml } from '../helpers/dom-fixture.js';

beforeEach(() => {
  window.__KYCHON_API = 'https://api.test';
  window.__KYCHON_ANON_KEY = 'test_key';
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  });
  clearBodyFixture();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeWrapper(cfg: Record<string, unknown>): HTMLElement {
  bodyFixture(`
    <section data-section>
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container data-block-hydrate="events_list" data-config='${escapeHtml(
        JSON.stringify(cfg),
      )}'></div>
    </section>
  `);
  return document.querySelector('section') as HTMLElement;
}

function eventsListHost(wrapper: HTMLElement): HTMLElement {
  return wrapper.querySelector('[data-block-hydrate="events_list"]') as HTMLElement;
}

function capabilityResponse(rows: unknown[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ ok: true, correlationId: 'test', data: { rows, count: rows.length } }),
  };
}

// Select THIS test's events.list call by its unique `limit` (each filter test
// uses a distinct `count`). EventsListIsland mounts a React island whose
// useEffect fetches asynchronously and is not unmounted between tests, so a
// prior test's island can land a stray call in the shared mock — keying off
// limit makes the assertion immune to that leak instead of trusting calls[0].
function eventsCall(fetchMock: ReturnType<typeof vi.fn>, limit: number) {
  const call = fetchMock.mock.calls.find((entry) => {
    try {
      const body = JSON.parse(String((entry[1] as RequestInit).body));
      return body.operation === 'events.list' && body.input?.limit === limit;
    } catch {
      return false;
    }
  });
  if (!call) throw new Error(`no events.list call with limit ${limit}`);
  return { url: call[0] as string, body: JSON.parse(String((call[1] as RequestInit).body)) };
}

describe('hydrateEventsList', () => {
  it('upcoming filter hits gte.now', async () => {
    const fetchMock = vi.fn().mockResolvedValue(capabilityResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = makeWrapper({ count: 3, filter: 'upcoming', layout: 'sidebar' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      eventsListHost(wrapper),
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const { url, body } = eventsCall(fetchMock, 3);
    expect(url).toContain('/api/kychon');
    expect(body).toMatchObject({ operation: 'events.list', phase: 'query', input: { limit: 3 } });
    expect(body.input.filters).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'gte' })]),
    );
    expect(body.input.order).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'starts_at', direction: 'asc' })]),
    );
  });

  it('past filter inverts ordering', async () => {
    const fetchMock = vi.fn().mockResolvedValue(capabilityResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = makeWrapper({ count: 4, filter: 'past', layout: 'list' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      eventsListHost(wrapper),
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const { body } = eventsCall(fetchMock, 4);
    expect(body.input.filters).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'lt' })]),
    );
    expect(body.input.order).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'starts_at', direction: 'desc' })]),
    );
  });

  it('this_week filter window has both gte and lt bounds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(capabilityResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = makeWrapper({ count: 5, filter: 'this_week', layout: 'sidebar' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      eventsListHost(wrapper),
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const filters = eventsCall(fetchMock, 5).body.input.filters;
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'gte' })]));
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'lt' })]));
  });

  it('empty result shows placeholder', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(capabilityResponse([])));
    const wrapper = makeWrapper({ count: 2, filter: 'upcoming', layout: 'sidebar' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      eventsListHost(wrapper),
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );
    await vi.waitFor(() => {
      expect(wrapper.querySelector('[data-events-list-empty]')?.textContent).toContain('No upcoming events');
    });
  });

  it('hides when feature is disabled', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const wrapper = makeWrapper({ count: 2, filter: 'upcoming', layout: 'sidebar' });
    // The hide path lives in the registry's hydrate wrapper; emulate it here.
    const { BLOCK_TYPES } = await import('../../src/lib/blocks');
    await BLOCK_TYPES.events_list.hydrate?.(
      eventsListHost(wrapper),
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: (flag) => flag !== 'feature_events' },
    );
    expect(wrapper.hidden).toBe(true);
  });

  it('renders cards with localized date strings', async () => {
    const future = new Date(Date.now() + 86400000 * 3).toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(capabilityResponse([{ id: 1, title: 'Picnic', location: 'Park', starts_at: future }])),
    );

    const wrapper = makeWrapper({
      count: 1,
      filter: 'upcoming',
      layout: 'sidebar',
      show_location: true,
      show_time: true,
    });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      eventsListHost(wrapper),
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    await vi.waitFor(() => expect(wrapper.querySelectorAll('[data-event-card]').length).toBe(1));
    expect(wrapper.textContent).toContain('Picnic');
    expect(wrapper.textContent).toContain('Park');
    expect(wrapper.querySelector('.event-card')).toBeNull();
  });
});
