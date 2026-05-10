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

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/functions/v1/kychon-api') {
        const envelope = envelopeFrom(init);
        if (envelope.operation === 'config.get') return capabilityResponse({ rows: freshConfig, count: freshConfig.length });
      }
      return capabilityResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const { init, siteConfig } = await import('../../src/lib/config');

    await init();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/functions/v1/kychon-api',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"operation":"config.get"'),
      }),
    );
    expect(siteConfig.brand_text).toBe('AAGE');
    expect(JSON.parse(store.wl_cache_site_config).buildId).toBe('new-build');
  });

  it('attaches an admin member by session email when the auth user id changed', async () => {
    const store = installLocalStorage();
    store.wl_session = JSON.stringify({
      access_token: 'token',
      user: {
        id: 'google-user-id',
        email: 'Major.Tal@gmail.com',
        email_verified_at: new Date().toISOString(),
      },
    });

    const member = {
      id: 2,
      user_id: 'invited-user-id',
      email: 'major.tal@gmail.com',
      display_name: 'Tal Weiss',
      role: 'admin',
      status: 'active',
    };

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/functions/v1/kychon-api') {
        const envelope = envelopeFrom(init);
        if (envelope.operation === 'config.get') return capabilityResponse({ rows: freshConfig, count: freshConfig.length });
        if (envelope.operation === 'members.list' && envelope.input.user_id === 'google-user-id') {
          return capabilityResponse({ rows: [], count: 0 });
        }
        if (envelope.operation === 'members.list' && envelope.input.email === 'major.tal@gmail.com') {
          return capabilityResponse({ rows: [member], count: 1 });
        }
        if (envelope.operation === 'members.linkUser') {
          return capabilityResponse({
            result: { ...member, user_id: 'google-user-id' },
            changed: [],
            audit: null,
            verify: null,
          });
        }
      }
      return capabilityResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const { init } = await import('../../src/lib/config');

    await init();

    const session = JSON.parse(store.wl_session);
    expect(session.user.member).toMatchObject({ id: 2, role: 'admin', email: 'major.tal@gmail.com' });
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.test/functions/v1/kychon-api',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"operation":"members.linkUser"'),
        }),
      );
    });
  });

  it('bypasses stale member cache on admin pages before checking access', async () => {
    window.history.pushState(null, '', '/admin.html');
    const store = installLocalStorage();
    store.wl_session = JSON.stringify({
      access_token: 'token',
      user: {
        id: 'google-user-id',
        email: 'major.tal@gmail.com',
      },
    });
    store['wl_cache_member_google-user-id'] = JSON.stringify({
      data: {
        id: 9,
        user_id: 'google-user-id',
        email: 'major.tal@gmail.com',
        role: 'member',
        status: 'pending',
      },
      ts: Date.now(),
    });

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/functions/v1/kychon-api') {
        const envelope = envelopeFrom(init);
        if (envelope.operation === 'config.get') return capabilityResponse({ rows: freshConfig, count: freshConfig.length });
        if (envelope.operation === 'members.list' && envelope.input.user_id === 'google-user-id') {
          return capabilityResponse({ rows: [], count: 0 });
        }
        if (envelope.operation === 'members.list' && envelope.input.email === 'major.tal@gmail.com') {
          return capabilityResponse({
            rows: [
              {
                id: 2,
                user_id: 'invited-user-id',
                email: 'major.tal@gmail.com',
                role: 'admin',
                status: 'active',
              },
            ],
            count: 1,
          });
        }
        if (envelope.operation === 'members.linkUser') {
          return capabilityResponse({ result: {}, changed: [], audit: null, verify: null });
        }
      }
      return capabilityResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const { init } = await import('../../src/lib/config');

    await init();

    expect(JSON.parse(store.wl_session).user.member).toMatchObject({
      id: 2,
      role: 'admin',
      status: 'active',
    });
  });
});
