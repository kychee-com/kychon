import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BLOCK_TYPES, type BlockRenderContext, type Section } from '../../src/lib/blocks';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

const section: Section = {
  id: 88,
  page_slug: 'index',
  zone: 'main',
  scope: 'page',
  section_type: 'event_countdown',
  config: { heading: 'Next Event' },
  position: 1,
};

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  isFeatureEnabled: () => true,
};

function mount(): HTMLElement {
  bodyFixture(`
    <section>
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container data-block-hydrate="event_countdown" data-config='{"heading":"Next Event"}'></div>
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

function envelope(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe('event_countdown hydration', () => {
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

  it('fetches the next event and renders a shadcn countdown', async () => {
    const future = new Date(Date.now() + 3 * 86400000 + 2 * 3600000).toISOString();
    const fetchMock = vi.fn().mockResolvedValue(capabilityResponse([{ id: 7, title: 'Picnic', starts_at: future }]));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount();
    await BLOCK_TYPES.event_countdown.hydrate?.(wrapper, section, ctx);

    await vi.waitFor(() => expect(wrapper.querySelector('[data-event-countdown]')?.textContent).toContain('Picnic'));
    expect(envelope(fetchMock)).toMatchObject({
      operation: 'events.list',
      phase: 'query',
      input: { limit: 1 },
    });
    expect(wrapper.querySelector('[data-event-countdown-digits]')).toBeTruthy();
    expect(wrapper.querySelector('.card')).toBeNull();
    expect(wrapper.querySelector('[data-countdown]')).toBeNull();
  });

  it('renders an empty state when no upcoming event exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(capabilityResponse([])));

    const wrapper = mount();
    await BLOCK_TYPES.event_countdown.hydrate?.(wrapper, section, ctx);

    await vi.waitFor(() => {
      expect(wrapper.querySelector('[data-event-countdown-empty]')?.textContent).toContain('No upcoming events');
    });
  });

  it('hides the block when events are disabled', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const wrapper = mount();
    await BLOCK_TYPES.event_countdown.hydrate?.(wrapper, section, {
      ...ctx,
      isFeatureEnabled: (flag) => flag !== 'feature_events',
    });

    expect(wrapper.hidden).toBe(true);
  });
});
