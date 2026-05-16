import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BlockRenderContext, Section } from '../../src/lib/blocks';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

const section: Section = {
  id: 7,
  page_slug: 'index',
  zone: 'main',
  scope: 'page',
  section_type: 'activity_feed',
  config: { heading: 'Recent Activity', limit: 3 },
  position: 1,
  visible: true,
};

function installLocalStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
  vi.stubGlobal('localStorage', storage);
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  return store;
}

function envelopeFrom(init?: RequestInit) {
  return JSON.parse(String(init?.body || '{}'));
}

function capabilityResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true, correlationId: 'test', data }),
  };
}

function mountActivityHost(): HTMLElement {
  bodyFixture(`
    <section>
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container data-block-hydrate="activity_feed">
        <h2>Recent Activity</h2>
      </div>
    </section>
  `);
  return document.body;
}

function context(role: BlockRenderContext['role'] = null): BlockRenderContext {
  return {
    admin: false,
    locale: 'en',
    role,
    isFeatureEnabled: () => true,
  };
}

describe('activity_feed hydration', () => {
  beforeEach(() => {
    const testWindow = window as Window & { __KYCHON_API: string; __KYCHON_ANON_KEY: string };
    testWindow.__KYCHON_API = 'https://api.test';
    testWindow.__KYCHON_ANON_KEY = 'test_key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    clearBodyFixture();
  });

  it('renders member-only state without string-built legacy activity markup', async () => {
    installLocalStorage();
    const host = mountActivityHost();
    const { hydrateActivityFeed } = await import('../../src/lib/block-hydrators');

    await hydrateActivityFeed(host, section, context());

    await vi.waitFor(() => {
      expect(document.querySelector('[data-activity-feed]')?.textContent).toContain(
        'Sign in as a member to see recent activity.',
      );
    });
    expect(document.querySelector('.activity-entry')).toBeNull();
    expect(document.querySelector('.activity-avatar')).toBeNull();
  });

  it('loads activity entries through the shadcn React island', async () => {
    const store = installLocalStorage();
    store.wl_session = JSON.stringify({
      access_token: 'token',
      user: { member: { id: 1, status: 'active' } },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const envelope = envelopeFrom(init);
        if (envelope.operation === 'activity.list') {
          return capabilityResponse({
            rows: [
              {
                id: 2,
                member_id: 5,
                action: 'announcement',
                metadata: { title: 'Welcome!' },
                created_at: new Date().toISOString(),
              },
            ],
            count: 1,
          });
        }
        if (envelope.operation === 'members.list') {
          return capabilityResponse({
            rows: [{ id: 5, display_name: 'Alice Admin', avatar_url: null }],
            count: 1,
          });
        }
        return capabilityResponse({ rows: [], count: 0 });
      }),
    );

    const host = mountActivityHost();
    const { hydrateActivityFeed } = await import('../../src/lib/block-hydrators');

    await hydrateActivityFeed(host, section, context('member'));

    await vi.waitFor(() => {
      expect(document.querySelector('[data-activity-feed]')?.textContent).toContain(
        'Alice Admin posted an announcement: Welcome!',
      );
    });
    expect(document.querySelector('.activity-entry')).toBeNull();
    expect(document.querySelector('.card')).toBeNull();
  });
});
