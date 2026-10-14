// @vitest-environment happy-dom
/**
 * Same contract as event-image-manifest-client.test.ts (kychee-com/kychon#186
 * / #169), for authored HTML on custom pages: on a cold visit the manifest
 * can arrive after the page content has rendered (ports above the inline cap
 * fetch it after mount), and the content's `/assets/<name>` images must
 * re-resolve then instead of staying on the unserved path (every image on a
 * copied site's /links page 404ed).
 *
 * kychon#238: the background refresh used to replace the baked (resolved)
 * body with the raw row while the manifest was still in flight, so every
 * image flashed broken for seconds. The baked body now stays until the
 * refreshed one can resolve.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetManifest } from '../../src/lib/kychon-image';
import type { Page } from '../../src/schemas/content';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

const mocks = vi.hoisted(() => ({
  ready: { current: new Promise<void>(() => {}) as Promise<void> },
  get: vi.fn(),
}));

vi.mock('../../src/lib/config', () => ({
  get ready() {
    return mocks.ready.current;
  },
  translateItems: vi.fn(async (_type: string, rows: unknown[]) => rows),
}));
vi.mock('../../src/lib/api', () => ({ get: mocks.get }));
vi.mock('../../src/lib/clean-routes', () => ({ resolveCustomPageSlugFromLocation: () => 'links' }));

const { default: CustomPageApp } = await import('../../src/components/kychon/CustomPageApp');
const { setGlobalManifest } = await import('../../src/lib/kychon-image');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CDN = 'https://pr-test.run402.com/_blob/astro/logo-1a2b3c4d.jpg';
const NEW_CDN = 'https://pr-test.run402.com/_blob/astro/new-sponsor-5e6f7a8b.jpg';
const manifest = {
  version: 1,
  assets: {
    'logo.jpg': { key: 'astro/logo-1a2b3c4d.jpg', url: CDN, cdn_url: CDN, width_px: 200, height_px: 100 },
    'new-sponsor.jpg': { key: 'astro/new-sponsor.jpg', url: NEW_CDN, cdn_url: NEW_CDN, width_px: 300, height_px: 150 },
  },
} as unknown as AssetManifest;

const rawContent = '<p><a href="https://example.com"><img src="/assets/logo.jpg" alt="Sponsor"></a></p>';
const page = {
  id: 3,
  slug: 'links',
  title: 'Links',
  content: rawContent,
  published: true,
  requires_auth: false,
} as unknown as Page;
/** What `[customPage].astro` bakes: the same row, `/assets/` already resolved. */
const bakedPage = {
  ...page,
  content: `<p><a href="https://example.com"><img src="${CDN}" alt="Sponsor" width="200" height="100"></a></p>`,
} as unknown as Page;

let root: Root | null = null;
let srcHistory: string[] = [];
let observer: MutationObserver | null = null;

/** Every `<img src>` the island ever puts in the DOM, so a transient broken frame is caught too. */
function recordImageSources(host: HTMLElement): void {
  const record = () => {
    for (const img of host.querySelectorAll('img')) srcHistory.push(img.getAttribute('src') ?? '');
  };
  observer = new MutationObserver(record);
  observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}

beforeEach(() => {
  mocks.ready.current = new Promise<void>(() => {});
  mocks.get.mockReset();
  mocks.get.mockImplementation(() => new Promise(() => {}));
  srcHistory = [];
});

afterEach(async () => {
  observer?.disconnect();
  observer = null;
  await act(async () => {
    root?.unmount();
    setGlobalManifest(null);
  });
  root = null;
  clearBodyFixture();
});

async function mount(initialPage: Page): Promise<HTMLElement> {
  const host = bodyFixture('<div></div>').firstElementChild as HTMLElement;
  recordImageSources(host);
  await act(async () => {
    root = createRoot(host);
    root.render(createElement(CustomPageApp, { initialPage }));
  });
  return host;
}

describe('custom page island (client)', () => {
  it('re-resolves content images once the manifest arrives', async () => {
    const host = await mount(page);
    expect(host.innerHTML).toContain('src="/assets/logo.jpg"');
    await act(async () => {
      setGlobalManifest(manifest);
    });
    expect(host.innerHTML).toContain(CDN);
    expect(host.innerHTML).not.toContain('"/assets/logo.jpg"');
  });

  it('refresh lands before the manifest: no /assets/ src ever appears', async () => {
    mocks.ready.current = Promise.resolve();
    // An edit after the deploy: the live row has a second sponsor.
    const live = { ...page, content: `${rawContent}<p><img src="/assets/new-sponsor.jpg" alt="New"></p>` };
    mocks.get.mockResolvedValue([live]);

    const host = await mount(bakedPage);
    expect(mocks.get).toHaveBeenCalledOnce();
    // The refresh has landed; the baked body stays because the live one cannot resolve yet.
    expect(host.innerHTML).toContain(CDN);
    expect(host.innerHTML).not.toContain('/assets/');

    await act(async () => {
      setGlobalManifest(manifest);
    });
    expect(host.innerHTML).toContain(NEW_CDN);
    expect(host.innerHTML).toContain(CDN);
    expect(srcHistory.length).toBeGreaterThan(0);
    expect(srcHistory.filter((src) => src.startsWith('/assets/'))).toEqual([]);
  });

  it('shows a refreshed body at once when it has nothing left to resolve', async () => {
    mocks.ready.current = Promise.resolve();
    mocks.get.mockResolvedValue([{ ...page, content: '<p>Sponsors coming soon.</p>' }]);
    const host = await mount(bakedPage);
    expect(host.innerHTML).toContain('Sponsors coming soon.');
    expect(host.innerHTML).not.toContain(CDN);
  });
});
