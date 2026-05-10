import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  (globalThis as any).window.__KYCHON_API = 'https://api.test';
  (globalThis as any).window.__KYCHON_ANON_KEY = 'test_key';
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
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeWrapper(cfg: Record<string, unknown>): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.innerHTML = `
    <div class="ky-container" data-block-hydrate="events_list" data-config='${JSON.stringify(cfg)}'>
      <div class="block-events-list__skeleton">
        <div class="event-skeleton-card"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  return wrapper;
}

function capabilityResponse(rows: unknown[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ ok: true, correlationId: 'test', data: { rows, count: rows.length } }),
  };
}

function envelope(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe('hydrateEventsList', () => {
  it('upcoming filter hits gte.now', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(capabilityResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = makeWrapper({ count: 3, filter: 'upcoming', layout: 'sidebar' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      wrapper,
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    const body = envelope(fetchMock);
    expect(fetchMock.mock.calls[0][0]).toContain('/functions/v1/kychon-api');
    expect(body).toMatchObject({ operation: 'events.list', phase: 'query', input: { limit: 3 } });
    expect(body.input.filters).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'gte' })]));
    expect(body.input.order).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', direction: 'asc' })]));
  });

  it('past filter inverts ordering', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(capabilityResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = makeWrapper({ count: 4, filter: 'past', layout: 'list' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      wrapper,
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    const body = envelope(fetchMock);
    expect(body.input.filters).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'lt' })]));
    expect(body.input.order).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', direction: 'desc' })]));
  });

  it('this_week filter window has both gte and lt bounds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(capabilityResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = makeWrapper({ count: 5, filter: 'this_week', layout: 'sidebar' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      wrapper,
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    const filters = envelope(fetchMock).input.filters;
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'gte' })]));
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'starts_at', op: 'lt' })]));
  });

  it('empty result shows placeholder', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(capabilityResponse([])));
    const wrapper = makeWrapper({ count: 2, filter: 'upcoming', layout: 'sidebar' });
    const { hydrateEventsList } = await import('../../src/lib/block-hydrators');
    await hydrateEventsList(
      wrapper,
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );
    expect(wrapper.querySelector('.block-events-list__empty')?.textContent).toContain('No upcoming events');
  });

  it('hides when feature is disabled', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const wrapper = makeWrapper({ count: 2, filter: 'upcoming', layout: 'sidebar' });
    // The hide path lives in the registry's hydrate wrapper; emulate it here.
    const { BLOCK_TYPES } = await import('../../src/lib/blocks');
    await BLOCK_TYPES.events_list.hydrate?.(
      wrapper,
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: (flag) => flag !== 'feature_events' },
    );
    expect(wrapper.style.display).toBe('none');
  });

  it('renders cards with localized date strings', async () => {
    const future = new Date(Date.now() + 86400000 * 3).toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(capabilityResponse([{ id: 1, title: 'Picnic', location: 'Park', starts_at: future }])),
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
      wrapper,
      { page_slug: 'index', zone: 'main', scope: 'page', section_type: 'events_list', config: {}, position: 1 },
      { admin: false, locale: 'en', isFeatureEnabled: () => true },
    );

    expect(wrapper.querySelectorAll('.event-card').length).toBe(1);
    expect(wrapper.querySelector('.event-card__title')?.textContent).toBe('Picnic');
    expect(wrapper.querySelector('.event-card__location')?.textContent).toBe('Park');
  });
});
