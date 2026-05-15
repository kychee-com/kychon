import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateSiteSearch } from '../../src/lib/block-hydrators.ts';
import type { BlockRenderContext, Section } from '../../src/lib/blocks.ts';

const fetchMock = vi.fn();

const section: Section = {
  id: 1,
  page_slug: '*',
  zone: 'header',
  scope: 'global',
  section_type: 'site_search',
  config: { default_type: 'pages', min_chars: 2 },
  position: 1,
};

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
};

function mount() {
  document.body.innerHTML = `
    <section>
      <div class="site-search" data-block-hydrate="site_search" data-config='{"default_type":"pages","min_chars":2}'>
        <form action="/search" method="get">
          <input id="site-search-1" name="q" type="search" aria-expanded="false" aria-controls="site-search-list-1">
          <input name="type" type="hidden" value="all">
          <button type="submit">Search</button>
          <div id="site-search-list-1" role="listbox" hidden></div>
        </form>
      </div>
    </section>
  `;
  return document.querySelector('section') as HTMLElement;
}

describe('site_search hydration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.__KYCHON_API = 'https://api.test';
    window.__KYCHON_ANON_KEY = 'anon';
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key of Object.keys(store)) delete store[key];
      },
    });
  });

  it('fetches title-only suggestions after debounce and renders visible options', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          correlationId: 'test',
          data: { results: [{ type: 'page', title: 'Membership', url: '/page.html?slug=membership' }] },
        }),
    });
    const host = mount();
    await hydrateSiteSearch(host, section, ctx);

    const input = host.querySelector('input[name="q"]') as HTMLInputElement;
    input.value = 'mem';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(220);

    expect(fetchMock.mock.calls[0][0]).toContain('/functions/v1/kychon-api');
    const envelope = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(envelope).toMatchObject({
      operation: 'search.suggest',
      phase: 'query',
      input: { q: 'mem', type: 'pages' },
    });
    const list = host.querySelector('[role="listbox"]') as HTMLElement;
    expect(list.hidden).toBe(false);
    expect(list.textContent).toContain('Membership');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not fetch below min chars and closes suggestions on Escape', async () => {
    const host = mount();
    await hydrateSiteSearch(host, section, ctx);
    const input = host.querySelector('input[name="q"]') as HTMLInputElement;
    input.value = 'm';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(220);
    expect(fetchMock).not.toHaveBeenCalled();

    const list = host.querySelector('[role="listbox"]') as HTMLElement;
    list.hidden = false;
    list.innerHTML = '<a id="opt" role="option" href="/x">X</a>';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(list.hidden).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
