// @vitest-environment happy-dom
/**
 * Client half of kychee-com/kychon#186 / #169: when the runtime manifest is
 * not available at first render (ports whose manifest exceeds the inline cap
 * fetch `/_assets-manifest.json` after mount), event image islands must
 * re-render once `setGlobalManifest` lands it instead of keeping the
 * unserved `/assets/<name>` URL.
 */
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetManifest } from '../../src/lib/kychon-image';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

const event = {
  id: 7,
  title: 'Spring Gala',
  location: 'Hall',
  starts_at: '2099-05-01T18:00:00Z',
  image_url: '/assets/foo.jpg',
};

// The background refresh never settles: the island keeps the baked events.
vi.mock('../../src/lib/api', () => ({ get: vi.fn(() => new Promise(() => {})) }));

const { mountEventsListIsland } = await import('../../src/components/kychon/EventsListIsland');
const { setGlobalManifest } = await import('../../src/lib/kychon-image');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// `@run402/astro/react`'s <Run402Image> passes HTML `class` (not
// `className`) to createElement for byte-identity with its HTML renderer,
// which React's dev build reports. Upstream behavior, not under test here;
// silence only that message so any other console.error still surfaces.
const consoleError = console.error.bind(console);
vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('Invalid DOM property `%s`') && args[1] === 'class') return;
  consoleError(...args);
});

const CDN = 'https://pr-test.run402.com/_blob/astro/foo-1a2b3c4d.jpg';
const manifest = {
  version: 1,
  assets: { 'foo.jpg': { key: 'astro/foo-1a2b3c4d.jpg', url: CDN, cdnUrl: CDN, width_px: 600, height_px: 400 } },
} as unknown as AssetManifest;

afterEach(async () => {
  // Mounted islands subscribe to the manifest; clearing it re-renders them.
  await act(async () => {
    setGlobalManifest(null);
  });
  clearBodyFixture();
});

describe('events_list island (client)', () => {
  it('re-renders thumbnails against the manifest once it arrives', async () => {
    const host = bodyFixture('<div></div>').firstElementChild as HTMLElement;
    await act(async () => {
      mountEventsListIsland(host, {
        config: { layout: 'grid', show_image: true, count: 4, filter: 'upcoming' },
        initialEvents: [event],
      });
    });
    expect(host.innerHTML).toContain('src="/assets/foo.jpg"');
    await act(async () => {
      setGlobalManifest(manifest);
    });
    expect(host.innerHTML).toContain(CDN);
    expect(host.innerHTML).not.toContain('"/assets/foo.jpg"');
  });
});
