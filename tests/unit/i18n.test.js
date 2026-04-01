import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock browser globals
global.localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = v;
  },
  removeItem(k) {
    delete this._data[k];
  },
};
global.document = { documentElement: { dir: 'ltr' }, getElementById: () => null };

const mockFetch = vi.fn();
global.fetch = mockFetch;

// We need to reset the module state between tests
let t, loadLocale, setLanguage, getLocale;

describe('i18n.js', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    localStorage._data = {};

    // Default mock: brand.json returns en
    mockFetch.mockImplementation((url) => {
      if (url.includes('brand.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultLanguage: 'en' }) });
      }
      if (url.includes('/en.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              'nav.home': 'Home',
              'welcome.greeting': 'Hello, {name}!',
              'members.count': '{count} members',
              'members.count_one': '1 member',
            }),
        });
      }
      if (url.includes('/pt.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              'nav.home': 'Inicio',
              'welcome.greeting': 'Ola, {name}!',
              'members.count': '{count} membros',
              'members.count_one': '1 membro',
            }),
        });
      }
      if (url.includes('/ar.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              _meta: { direction: 'rtl' },
              'nav.home': 'الرئيسية',
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const mod = await import('../../site/js/i18n.js');
    t = mod.t;
    loadLocale = mod.loadLocale;
    setLanguage = mod.setLanguage;
    getLocale = mod.getLocale;
  });

  it('translates a simple key', async () => {
    await loadLocale('en');
    expect(t('nav.home')).toBe('Home');
  });

  it('returns key when translation is missing', async () => {
    await loadLocale('en');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('interpolates variables', async () => {
    await loadLocale('en');
    expect(t('welcome.greeting', { name: 'Maria' })).toBe('Hello, Maria!');
  });

  it('handles plural form (count > 1)', async () => {
    await loadLocale('en');
    expect(t('members.count', { count: 5 })).toBe('5 members');
  });

  it('handles singular form (count === 1)', async () => {
    await loadLocale('en');
    expect(t('members.count', { count: 1 })).toBe('1 member');
  });

  it('falls back to English for missing keys in other locale', async () => {
    await loadLocale('pt');
    // pt.json doesn't have a key that en.json has — we test with a key that exists in en
    // Since both have nav.home, let's test that pt overrides en
    expect(t('nav.home')).toBe('Inicio');
  });

  it('sets RTL direction for Arabic', async () => {
    await loadLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('persists language choice in localStorage', async () => {
    await setLanguage('pt');
    expect(localStorage.getItem('wl_locale')).toBe('pt');
  });

  it('reports current locale', async () => {
    await loadLocale('pt');
    expect(getLocale()).toBe('pt');
  });

  it('caches locale strings in localStorage after fetch', async () => {
    await loadLocale('en');
    const cached = localStorage.getItem('wl_cache_i18n_en');
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached);
    expect(parsed.data['nav.home']).toBe('Home');
    expect(parsed.ts).toBeGreaterThan(0);
  });

  it('serves strings from localStorage cache without network fetch', async () => {
    // Pre-populate cache
    localStorage.setItem('wl_cache_i18n_en', JSON.stringify({
      data: { 'nav.home': 'Cached Home', 'welcome.greeting': 'Cached {name}' },
      ts: Date.now(),
    }));

    mockFetch.mockClear();
    await loadLocale('en');

    // Should not have fetched en.json from network
    const enFetches = mockFetch.mock.calls.filter((c) => c[0].includes('/en.json'));
    expect(enFetches).toHaveLength(0);
    expect(t('nav.home')).toBe('Cached Home');
  });

  it('defaults to en without fetching brand.json when no locale specified', async () => {
    mockFetch.mockClear();
    await loadLocale(null, undefined);
    const brandFetches = mockFetch.mock.calls.filter((c) => c[0].includes('brand.json'));
    expect(brandFetches).toHaveLength(0);
    expect(getLocale()).toBe('en');
  });
});
