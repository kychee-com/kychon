import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// happy-dom env from vitest project config provides document/window/localStorage.
// We mock window globals required by api.ts.
beforeEach(() => {
  (globalThis as any).window.__KYCHON_API = 'https://api.test';
  (globalThis as any).window.__KYCHON_ANON_KEY = 'test_key';
  // happy-dom's localStorage isn't always wired in time — provide a shim.
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

async function loadHydrator() {
  return await import('../../src/lib/block-hydrators');
}

describe('hydrateLinkListResources', () => {
  it('replaces skeleton with fetched items and tags hydrated', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          correlationId: 'test',
          data: {
            rows: [
              { id: 1, title: 'A doc', file_url: '/r/a.pdf', file_type: 'pdf', created_at: '2026-04-01T00:00:00Z' },
              {
                id: 2,
                title: 'External',
                file_url: 'https://www.example.com/blog',
                file_type: 'link',
                created_at: '2026-03-01T00:00:00Z',
              },
            ],
            count: 2,
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = document.createElement('section');
    wrapper.className = 'section section-link-list block-link-list block-link-list--rows';
    wrapper.innerHTML = `
      <div class="ky-container" data-block-hydrate="link_list" data-config='${JSON.stringify({
        layout: 'rows',
        source: 'resources',
        filter: { category: 'newsletters', limit: 3, order: 'newest' },
      })}'>
        <ul class="block-link-list__skeleton"><li class="skeleton"></li></ul>
      </div>
    `;
    document.body.appendChild(wrapper);

    const { hydrateLinkListResources } = await loadHydrator();
    await hydrateLinkListResources(
      wrapper as HTMLElement,
      {
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        section_type: 'link_list',
        config: {},
        position: 1,
      },
      { admin: false, locale: 'en' },
    );

    expect(fetchMock).toHaveBeenCalled();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/functions/v1/kychon-api');
    const envelope = JSON.parse(String(calledInit.body));
    expect(envelope).toMatchObject({
      operation: 'resources.list',
      phase: 'query',
      input: { category: 'newsletters' },
    });

    const root = wrapper.querySelector('[data-block-hydrate="link_list"]') as HTMLElement;
    expect(root.dataset.hydrated).toBe('true');
    // Skeleton removed
    expect(wrapper.querySelector('.block-link-list__skeleton')).toBeNull();
    // Items rendered
    const items = wrapper.querySelectorAll('.block-link-list__item');
    expect(items.length).toBe(2);
    expect(wrapper.innerHTML).toContain('A doc');
    expect(wrapper.innerHTML).toContain('block-link-list__badge--pdf');
    expect(wrapper.innerHTML).toContain('target="_blank"');
  });

  it('hides the section when no resources match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, correlationId: 'test', data: { rows: [], count: 0 } }),
      }),
    );

    const wrapper = document.createElement('section');
    wrapper.innerHTML = `
      <div class="ky-container" data-block-hydrate="link_list" data-config='${JSON.stringify({
        layout: 'rows',
        source: 'resources',
        filter: { category: 'nope', limit: 5, order: 'newest' },
      })}'>
        <ul class="block-link-list__skeleton"></ul>
      </div>
    `;
    document.body.appendChild(wrapper);

    const { hydrateLinkListResources } = await loadHydrator();
    await hydrateLinkListResources(
      wrapper as HTMLElement,
      {
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        section_type: 'link_list',
        config: {},
        position: 1,
      },
      { admin: false, locale: 'en' },
    );

    expect(wrapper.style.display).toBe('none');
  });
});
