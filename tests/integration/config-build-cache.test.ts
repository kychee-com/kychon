import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const staleConfig = [
  { key: 'site_name', value: 'Old AAGE', category: 'branding' },
  { key: 'brand_text', value: 'Old AAGE', category: 'branding' },
  { key: 'default_language', value: 'en', category: 'i18n' },
];

const freshConfig = [
  { key: 'site_name', value: 'AAGE', category: 'branding' },
  { key: 'brand_text', value: 'AAGE', category: 'branding' },
  { key: 'default_language', value: 'en', category: 'i18n' },
];

function installLocalStorage(): Record<string, string> {
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
  return store;
}

describe('site_config cache build awareness', () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '<title>Kychon</title><link rel="icon" href="/favicon.svg">';
    document.body.innerHTML = '';
    window.history.pushState(null, '', '/index.html');
    const testWindow = window as Window & {
      __KYCHON_API: string;
      __KYCHON_ANON_KEY: string;
      __KYCHON_BUILD_ID?: string;
    };
    testWindow.__KYCHON_API = 'https://api.test';
    testWindow.__KYCHON_ANON_KEY = 'test_key';
    testWindow.__KYCHON_BUILD_ID = 'new-build';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches fresh site_config instead of applying a different deploy cache entry', async () => {
    const store = installLocalStorage();
    store.wl_cache_site_config = JSON.stringify({
      data: staleConfig,
      ts: Date.now(),
      buildId: 'old-build',
    });
    store.wl_cache_i18n_en = JSON.stringify({ data: {}, ts: Date.now() });

    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://api.test/rest/v1/site_config') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(freshConfig)),
        };
      }
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('{}'),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { init, siteConfig } = await import('../../src/lib/config');

    await init();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/rest/v1/site_config',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(siteConfig.brand_text).toBe('AAGE');
    expect(JSON.parse(store.wl_cache_site_config).buildId).toBe('new-build');
  });
});
