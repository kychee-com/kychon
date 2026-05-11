import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Section } from '../../src/lib/blocks';

const configRows = [
  { key: 'site_name', value: 'AAGE', category: 'branding' },
  { key: 'brand_text', value: 'AAGE', category: 'branding' },
  { key: 'languages', value: ['en', 'es'], category: 'i18n' },
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

function writeCache(store: Record<string, string>, key: string, data: unknown, ts = Date.now()): void {
  store[key] = JSON.stringify({ data, ts });
}

function mountPortalShell(): void {
  document.body.innerHTML = `
    <nav id="zone-header" class="nav" data-zone="header">
      <div class="ky-container"></div>
    </nav>
    <main class="page-content" id="main-content">
      <div id="sections" data-zone="main"></div>
    </main>
    <footer id="zone-footer" class="footer" data-zone="footer">
      <div class="ky-container"></div>
    </footer>
    <div id="auth-modal-root"></div>
  `;
}

function signInBarSection(config: Record<string, unknown>): Section {
  return {
    id: 89,
    page_slug: '*',
    zone: 'header',
    scope: 'global',
    section_type: 'sign_in_bar',
    config,
    position: 1,
    visible: true,
  };
}

function pageBannerSection(config: Record<string, unknown>): Section {
  return {
    id: 90,
    page_slug: 'index',
    zone: 'header',
    scope: 'page',
    section_type: 'page_banner',
    config,
    position: 2,
    visible: true,
  };
}

async function hydrateFromCachedSections(sections: Section[]): Promise<void> {
  const store = installLocalStorage();
  writeCache(store, 'wl_cache_site_config', configRows);
  writeCache(store, 'wl_cache_i18n_en', { 'nav.sign_in': 'Sign in' });
  writeCache(store, 'wl_cache_sections_index', sections, Date.now() - 10 * 60 * 1000);
  mountPortalShell();

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(sections)),
      json: () => Promise.resolve(sections),
    }),
  );

  const testWindow = window as Window & { __KYCHON_API: string; __KYCHON_ANON_KEY: string };
  testWindow.__KYCHON_API = 'https://api.test';
  testWindow.__KYCHON_ANON_KEY = 'test_key';

  const { init } = await import('../../src/lib/config');
  const { hydratePage } = await import('../../src/lib/page-render');

  await init();
  await hydratePage('index');
}

describe('sign_in_bar hydration', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('honors hidden toggle config on root-level hydrate hosts', async () => {
    await hydrateFromCachedSections([signInBarSection({ show_lang_toggle: false, show_theme_toggle: false })]);

    expect(document.querySelector('#nav-user')).toBeTruthy();
    expect(document.querySelector('#login-btn')).toBeTruthy();
    expect(document.querySelector('#lang-toggle')).toBeNull();
    expect(document.querySelector('#theme-toggle')).toBeNull();
  });

  it('keeps sign-in controls configurable when toggles are enabled', async () => {
    await hydrateFromCachedSections([signInBarSection({ show_lang_toggle: true, show_theme_toggle: true })]);

    expect(document.querySelector('#login-btn')).toBeTruthy();
    expect(document.querySelector('#lang-toggle')).toBeTruthy();
    expect(document.querySelector('#theme-toggle')).toBeTruthy();
  });

  it('opens auth through the Kychon event boundary', async () => {
    await hydrateFromCachedSections([signInBarSection({ show_lang_toggle: false, show_theme_toggle: false })]);

    const events: CustomEvent[] = [];
    document.addEventListener('kychon:auth-open', ((event: CustomEvent) => {
      events.push(event);
    }) as EventListener);

    const login = document.querySelector('#login-btn') as HTMLButtonElement | null;
    login?.click();

    await vi.waitFor(() => {
      expect(events).toHaveLength(1);
    });
    expect(events[0]?.detail.trigger).toBe(login);
  });

  it('renders full-bleed header banners outside the sticky nav shell', async () => {
    await hydrateFromCachedSections([
      signInBarSection({ show_lang_toggle: false, show_theme_toggle: false }),
      pageBannerSection({
        image_url: '/assets/about-hero.jpg',
        image_alt: 'About',
        height: 'medium',
      }),
    ]);

    const host = document.querySelector('[data-fullbleed-host]') as HTMLElement | null;
    expect(host).toBeTruthy();
    expect(host?.previousElementSibling).toBe(document.getElementById('zone-header'));
    expect(host?.getAttribute('data-zone-fullbleed')).toBe('header');
    expect(document.querySelector('.nav [data-fullbleed-host]')).toBeNull();
    expect(host?.querySelector('.block-page-banner')).toBeTruthy();
  });
});
