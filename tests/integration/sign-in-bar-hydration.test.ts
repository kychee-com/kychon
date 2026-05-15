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
  const storage = {
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
  };
  vi.stubGlobal('localStorage', storage);
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  return store;
}

function writeCache(store: Record<string, string>, key: string, data: unknown, ts = Date.now()): void {
  store[key] = JSON.stringify({ data, ts });
}

function capabilityResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true, correlationId: 'test', data }),
  };
}

function envelopeFrom(init?: RequestInit) {
  return JSON.parse(String(init?.body || '{}'));
}

function mountPortalShell(): void {
  document.body.innerHTML = `
    <nav id="zone-header" class="nav" data-zone="header">
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container></div>
    </nav>
    <div data-fullbleed-host data-zone-fullbleed="header"></div>
    <main class="flex-1 py-8" id="main-content">
      <div id="sections" data-zone="main"></div>
    </main>
    <footer id="zone-footer" class="footer" data-zone="footer">
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container></div>
      <div data-fullbleed-host></div>
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

async function hydrateFromCachedSections(sections: Section[], session?: unknown): Promise<Record<string, string>> {
  const store = installLocalStorage();
  if (session) store.wl_session = JSON.stringify(session);
  writeCache(store, 'wl_cache_site_config', configRows);
  writeCache(store, 'wl_cache_i18n_en', {
    'nav.profile': 'Profile',
    'nav.sign_in': 'Sign in',
    'nav.sign_out': 'Sign out',
  });
  writeCache(store, 'wl_cache_sections_index', sections, Date.now() - 10 * 60 * 1000);
  mountPortalShell();

  const testWindow = window as Window & { __KYCHON_API: string; __KYCHON_ANON_KEY: string };
  testWindow.__KYCHON_API = 'https://api.test';
  testWindow.__KYCHON_ANON_KEY = 'test_key';

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const envelope = envelopeFrom(init);
      if (envelope.operation === 'sections.list') return capabilityResponse({ rows: sections, count: sections.length });
      if (envelope.operation === 'auth.whoami') {
        return capabilityResponse({
          actor: {
            state: session ? 'active_member' : 'anonymous',
            authenticated: Boolean(session),
            user: session ? { id: 'session-user', email: 'demo@example.test' } : null,
            member: session
              ? {
                  id: '7',
                  userId: 'session-user',
                  email: 'demo@example.test',
                  displayName: 'Demo Member',
                  role: 'member',
                  status: 'active',
                }
              : null,
            authority: { projectAdmin: false, activeMemberAdmin: false },
          },
        });
      }
      if (envelope.operation === 'members.list') {
        return capabilityResponse({
          rows: [
            {
              id: 7,
              user_id: 'session-user',
              email: 'demo@example.test',
              display_name: 'Demo Member',
              role: 'member',
              status: 'active',
            },
          ],
          count: 1,
        });
      }
      return capabilityResponse({ rows: [], count: 0 });
    }),
  );

  const { init } = await import('../../src/lib/config');
  const { hydratePage } = await import('../../src/lib/page-render');

  await init();
  await hydratePage('index');
  return store;
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

    await vi.waitFor(() => {
      expect(document.querySelector('#nav-user')).toBeTruthy();
      expect(document.querySelector('#login-btn')).toBeTruthy();
    });
    expect(document.querySelector('#lang-toggle')).toBeNull();
    expect(document.querySelector('#theme-toggle')).toBeNull();
  });

  it('keeps sign-in controls configurable when toggles are enabled', async () => {
    await hydrateFromCachedSections([signInBarSection({ show_lang_toggle: true, show_theme_toggle: true })]);

    await vi.waitFor(() => {
      expect(document.querySelector('#login-btn')).toBeTruthy();
      expect(document.querySelector('#lang-toggle')).toBeTruthy();
      expect(document.querySelector('#theme-toggle')).toBeTruthy();
    });
  });

  it('toggles and persists visitor dark mode from the header utility button', async () => {
    const store = await hydrateFromCachedSections([
      signInBarSection({ show_lang_toggle: true, show_theme_toggle: true }),
    ]);

    let toggle: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      toggle = document.querySelector('#theme-toggle') as HTMLButtonElement | null;
      expect(toggle).toBeTruthy();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();

    toggle?.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(store.wl_theme).toBe('dark');

    toggle?.click();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(store.wl_theme).toBe('light');
  });

  it('keeps signed-in account actions inside the avatar menu', async () => {
    await hydrateFromCachedSections([signInBarSection({ show_lang_toggle: true, show_theme_toggle: true })], {
      user: { display_name: 'Demo Member', email: 'demo@example.test' },
      access_token: 'token',
    });

    let accountTrigger: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      expect(document.querySelector('#theme-toggle')).toBeTruthy();
      accountTrigger = document.querySelector('[aria-label="Demo Member account menu"]') as HTMLButtonElement | null;
      expect(accountTrigger).toBeTruthy();
    });

    expect(document.querySelector('[data-nav-avatar-fallback]')?.textContent).toBe('D');
    expect(document.querySelector('#nav-user #logout-btn')).toBeNull();

    accountTrigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => {
      expect(document.querySelector('#logout-btn')?.textContent).toContain('Sign out');
    });
  });

  it('opens auth through the Kychon event boundary', async () => {
    await hydrateFromCachedSections([signInBarSection({ show_lang_toggle: false, show_theme_toggle: false })]);

    const events: CustomEvent[] = [];
    document.addEventListener('kychon:auth-open', ((event: CustomEvent) => {
      events.push(event);
    }) as EventListener);

    let login: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      login = document.querySelector('#login-btn') as HTMLButtonElement | null;
      expect(login).toBeTruthy();
    });
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
    expect(host?.querySelector('[data-page-banner]')).toBeTruthy();
  });
});
