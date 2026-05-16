import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BLOCK_TYPES, type BlockRenderContext, type Section } from '../../src/lib/blocks';
import { bodyFixture, clearBodyFixture, escapeHtml } from '../helpers/dom-fixture.js';

const section: Section = {
  id: 92,
  page_slug: 'index',
  zone: 'main',
  scope: 'page',
  section_type: 'announcements_feed',
  config: { heading: 'Announcements', limit: 5 },
  position: 1,
};

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  role: 'member',
  isFeatureEnabled: () => true,
};

const announcement = {
  id: 7,
  title: 'Route setting night',
  body: '<p>Bring shoes.</p><img src=x onerror=alert(1)><script>alert(2)</script>',
  is_pinned: true,
  author_id: null,
  created_at: '2026-05-15T10:00:00.000Z',
};

const poll = {
  id: 42,
  question: 'Which wall first?',
  description: null,
  poll_type: 'single',
  is_anonymous: false,
  results_visible: 'always',
  is_open: true,
  closes_at: null,
  attached_to: 'announcement',
  attached_id: 7,
  created_by: null,
  created_at: '2026-05-15T10:00:00.000Z',
};

const options = [
  { id: 1, poll_id: 42, label: 'Slab', position: 0 },
  { id: 2, poll_id: 42, label: 'Overhang', position: 1 },
];

const votes = [{ id: 1, poll_id: 42, option_id: 1, member_id: 10, created_at: '2026-05-15T10:10:00.000Z' }];

function mount(config = '{"heading":"Announcements","limit":5}'): HTMLElement {
  bodyFixture(`
    <section>
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container data-block-hydrate="announcements_feed" data-config='${escapeHtml(config)}'></div>
    </section>
  `);
  return document.querySelector('section') as HTMLElement;
}

function capabilityResponse(rows: unknown[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ ok: true, correlationId: 'test', data: { rows, count: rows.length } }),
  };
}

function responseForOperation(operation: string): unknown[] {
  if (operation === 'announcements.list') return [announcement];
  if (operation === 'polls.list') return [poll];
  if (operation === 'pollOptions.list') return options;
  if (operation === 'pollVotes.list') return votes;
  return [];
}

describe('announcements feed hydration', () => {
  beforeEach(() => {
    window.__KYCHON_API = 'https://api.test';
    window.__KYCHON_ANON_KEY = 'test_key';
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    clearBodyFixture();
  });

  it('renders announcements and attached polls through a shadcn island', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body || '{}'));
        return capabilityResponse(responseForOperation(body.operation));
      }),
    );

    const wrapper = mount();
    await BLOCK_TYPES.announcements_feed.hydrate?.(wrapper, section, ctx);

    await vi.waitFor(() =>
      expect(wrapper.querySelector('[data-announcements-feed]')?.textContent).toContain(announcement.title),
    );
    expect(wrapper.querySelector('[data-announcement-card="7"]')).toBeTruthy();
    expect(wrapper.querySelector('[data-section-poll="42"]')).toBeTruthy();
    expect(wrapper.querySelector('[data-editable-rich="announcements.7.body"]')?.innerHTML).toContain(
      '<p>Bring shoes.</p>',
    );
    expect(wrapper.querySelector('[data-editable-rich="announcements.7.body"]')?.innerHTML).not.toContain('onerror');
    expect(wrapper.querySelector('[data-editable-rich="announcements.7.body"]')?.innerHTML).not.toContain('<script');
    expect(wrapper.querySelector('.announcement')).toBeNull();
    expect(wrapper.querySelector('.card')).toBeNull();
    expect(wrapper.querySelector('.btn')).toBeNull();
  });

  it('renders an empty state when there are no announcements', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(capabilityResponse([])));

    const wrapper = mount();
    await BLOCK_TYPES.announcements_feed.hydrate?.(wrapper, section, ctx);

    await vi.waitFor(() =>
      expect(wrapper.querySelector('[data-announcements-empty]')?.textContent).toContain('No announcements yet'),
    );
  });

  it('renders the admin creation card without legacy form primitives', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(capabilityResponse([])));

    const wrapper = mount();
    await BLOCK_TYPES.announcements_feed.hydrate?.(wrapper, section, { ...ctx, admin: true, role: 'admin' });

    await vi.waitFor(() =>
      expect(wrapper.querySelector('[data-announcements-feed]')?.textContent).toContain('New Announcement'),
    );
    expect(wrapper.querySelector('.form-input')).toBeNull();
    expect(wrapper.querySelector('#ann-post')).toBeNull();
    expect(wrapper.querySelector('#ann-add-poll')).toBeNull();
  });
});
