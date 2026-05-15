import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// happy-dom env from vitest project config provides document/window/localStorage.
// We mock window globals required by api.ts.
beforeEach(() => {
  window.__KYCHON_API = 'https://api.test';
  window.__KYCHON_ANON_KEY = 'test_key';
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
    const fetchMock = vi.fn().mockResolvedValue({
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
    wrapper.innerHTML = `
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container data-block-hydrate="link_list" data-config='${JSON.stringify(
        {
          layout: 'rows',
          source: 'resources',
          filter: { category: 'newsletters', limit: 3, order: 'newest' },
        },
      )}'>
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

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
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
    await vi.waitFor(() => expect(wrapper.querySelector('[data-link-list-item]')).toBeTruthy());
    const items = wrapper.querySelectorAll('[data-link-list-item]');
    expect(items.length).toBe(2);
    expect(wrapper.textContent).toContain('A doc');
    expect(wrapper.textContent).toContain('PDF');
    expect(wrapper.querySelector('a[target="_blank"]')).toBeTruthy();
    expect(wrapper.querySelector('.block-link-list__item')).toBeNull();
  });

  it('hides the section when no resources match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, correlationId: 'test', data: { rows: [], count: 0 } }),
      }),
    );

    const wrapper = document.createElement('section');
    wrapper.innerHTML = `
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container data-block-hydrate="link_list" data-config='${JSON.stringify(
        {
          layout: 'rows',
          source: 'resources',
          filter: { category: 'nope', limit: 5, order: 'newest' },
        },
      )}'>
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

    await vi.waitFor(() => expect(wrapper.hidden).toBe(true));
  });

  it('hydrates manual links through the same island without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = document.createElement('section');
    wrapper.innerHTML = `
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container data-block-hydrate="link_list" data-config='${JSON.stringify(
        {
          heading: 'Curated',
          layout: 'compact',
          source: 'manual',
          items: [
            { label: 'A', href: '/a' },
            { label: 'PDF', href: '/b.pdf', badge: 'PDF' },
            { label: 'External', href: 'https://www.example.com', external: true },
          ],
        },
      )}'></div>
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

    await vi.waitFor(() => expect(wrapper.querySelectorAll('[data-link-list-item]').length).toBe(3));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.textContent).toContain('Curated');
    expect(wrapper.textContent).toContain('PDF');
    expect(wrapper.querySelector('a[target="_blank"]')).toBeTruthy();
  });
});
