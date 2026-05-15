import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BLOCK_TYPES, type BlockRenderContext, type Section } from '../../src/lib/blocks';

const section: Section = {
  id: 91,
  page_slug: 'index',
  zone: 'main',
  scope: 'page',
  section_type: 'polls',
  config: { heading: 'Member Poll', poll_ids: [42] },
  position: 1,
};

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  isFeatureEnabled: () => true,
};

const poll = {
  id: 42,
  question: 'Which route should we set next?',
  description: 'Pick one.',
  poll_type: 'single',
  is_anonymous: false,
  results_visible: 'always',
  is_open: true,
  closes_at: null,
  attached_to: null,
  attached_id: null,
  created_by: null,
  created_at: '2026-05-15T10:00:00.000Z',
};

const options = [
  { id: 1, poll_id: 42, label: 'Slab', position: 0 },
  { id: 2, poll_id: 42, label: 'Overhang', position: 1 },
];

const votes = [
  { id: 1, poll_id: 42, option_id: 1, member_id: 10, created_at: '2026-05-15T10:10:00.000Z' },
  { id: 2, poll_id: 42, option_id: 1, member_id: 11, created_at: '2026-05-15T10:20:00.000Z' },
];

function mount(config = '{"heading":"Member Poll","poll_ids":[42]}'): HTMLElement {
  document.body.innerHTML = `
    <section>
      <div class="ky-container" data-block-hydrate="polls" data-config='${config}'></div>
    </section>
  `;
  return document.querySelector('section') as HTMLElement;
}

function capabilityResponse(rows: unknown[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ ok: true, correlationId: 'test', data: { rows, count: rows.length } }),
  };
}

describe('polls block hydration', () => {
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
    document.body.innerHTML = '';
  });

  it('renders configured polls through a shadcn React island', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(capabilityResponse([poll]))
        .mockResolvedValueOnce(capabilityResponse(options))
        .mockResolvedValueOnce(capabilityResponse(votes)),
    );

    const wrapper = mount();
    await BLOCK_TYPES.polls.hydrate?.(wrapper, section, ctx);

    await vi.waitFor(() => expect(wrapper.querySelector('[data-polls-block]')?.textContent).toContain(poll.question));
    expect(wrapper.querySelector('[data-section-poll="42"]')).toBeTruthy();
    expect(wrapper.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(wrapper.querySelector('.poll-widget')).toBeNull();
    expect(wrapper.querySelector('.polls-skeleton')).toBeNull();
    expect(wrapper.querySelector('.card')).toBeNull();
  });

  it('renders an empty state when no poll IDs are configured', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const emptySection = { ...section, config: { heading: 'Member Poll', poll_ids: [] } };
    const wrapper = mount('{"heading":"Member Poll","poll_ids":[]}');
    await BLOCK_TYPES.polls.hydrate?.(wrapper, emptySection, ctx);

    await vi.waitFor(() =>
      expect(wrapper.querySelector('[data-polls-empty]')?.textContent).toContain('No polls to display'),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('hides the block when polls are disabled', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const wrapper = mount();
    await BLOCK_TYPES.polls.hydrate?.(wrapper, section, {
      ...ctx,
      isFeatureEnabled: (flag) => flag !== 'feature_polls',
    });

    expect(wrapper.hidden).toBe(true);
  });
});
