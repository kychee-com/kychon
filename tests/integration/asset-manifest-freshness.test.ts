/**
 * Asset manifest freshness for ports above the inline cap (SDJC, 2026-10-05).
 *
 * A port whose manifest is too large to inline relies on the runtime fetch of
 * `/_assets-manifest.json`. The global manifest is also seeded from a previous
 * visit's localStorage copy, and fetchManifest used to treat that seed as the
 * build's inline manifest, so it never revalidated. After a deploy added 1,151
 * gallery photos, returning visitors kept the old 187-entry list and every
 * slide rendered the unserved `/assets/<name>` path. Slideshows also read the
 * manifest only once, at mount.
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'wl_cache_assets_manifest';
const CDN = 'https://pr-test.run402.com/_blob/astro';
const ref = (name: string) => ({ url: `${CDN}/${name}`, cdn_url: `${CDN}/${name}`, display_url: `${CDN}/${name}` });
const stale = { version: 1, assets: { 'Logo.jpg': ref('Logo.jpg') } };
const fresh = { version: 1, assets: { 'Logo.jpg': ref('Logo.jpg'), 'Gallery_1.JPG': ref('Gallery_1.JPG') } };

function installLocalStorage(store: Record<string, string>, opts: { failWrites?: boolean } = {}) {
  const storage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new DOMException('quota', 'QuotaExceededError');
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
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const w = window as unknown as Record<string, unknown>;

beforeEach(() => {
  vi.resetModules();
  delete w.__KYCHON_ASSET_MANIFEST;
  delete w.__KYCHON_ASSET_MANIFEST_INLINED;
  clearBodyFixture();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('asset manifest load', () => {
  it('revalidates over the network when the global came from a stale localStorage seed', async () => {
    const store = { [KEY]: JSON.stringify(stale) };
    installLocalStorage(store);
    const fetchMock = stubFetch(fresh);
    const { loadAssetManifest } = await import('../../src/lib/page-render');
    const manifest = await loadAssetManifest();
    expect(fetchMock).toHaveBeenCalledWith('/_assets-manifest.json', { cache: 'no-cache' });
    expect(manifest?.assets['Gallery_1.JPG']).toBeDefined();
    expect((w.__KYCHON_ASSET_MANIFEST as typeof fresh).assets['Gallery_1.JPG']).toBeDefined();
    expect(JSON.parse(store[KEY]).assets['Gallery_1.JPG']).toBeDefined();
  });

  it('trusts a manifest the build inlined and skips the network', async () => {
    installLocalStorage({});
    w.__KYCHON_ASSET_MANIFEST = fresh;
    w.__KYCHON_ASSET_MANIFEST_INLINED = true;
    const fetchMock = stubFetch(stale);
    const { loadAssetManifest } = await import('../../src/lib/page-render');
    expect(await loadAssetManifest()).toBe(fresh);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops the stale seed when the fresh manifest does not fit in localStorage', async () => {
    const store = { [KEY]: JSON.stringify(stale) };
    installLocalStorage(store, { failWrites: true });
    stubFetch(fresh);
    const { loadAssetManifest } = await import('../../src/lib/page-render');
    await loadAssetManifest();
    expect(store[KEY]).toBeUndefined();
  });
});

describe('slideshow and late manifests', () => {
  it('upgrades /assets/<name> slides once the manifest arrives after mount', async () => {
    installLocalStorage({});
    const section: Section = {
      id: 9,
      page_slug: 'recent-events',
      zone: 'main',
      scope: 'page',
      section_type: 'slideshow',
      position: 1,
      config: { items: [{ src: '/assets/Gallery_1.JPG', alt: 'g' }], auto_rotate_seconds: 0 },
    };
    const ctx: BlockRenderContext = { admin: false, locale: 'en' };
    const wrapper = bodyFixture(renderBlock(section, ctx));
    const host = wrapper.querySelector('[data-block-hydrate="slideshow"]') as HTMLElement;
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    // @run402/astro's React Run402Image passes `class` (not `className`) on <picture>,
    // which React reports; tracked upstream in run402-private. Only that warning is allowed.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initSlideshow } = await import('../../src/lib/blocks/slideshow');
    const { setGlobalManifest } = await import('../../src/lib/kychon-image');
    await act(async () => {
      initSlideshow(host);
    });
    const srcs = () => [...host.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(srcs()).toContain('/assets/Gallery_1.JPG');
    await act(async () => {
      setGlobalManifest(fresh as never);
    });
    expect(srcs().some((src) => src?.startsWith(CDN))).toBe(true);
    expect(srcs()).not.toContain('/assets/Gallery_1.JPG');
    const unexpected = consoleError.mock.calls.filter((args) => !String(args[0]).includes('Invalid DOM property'));
    expect(unexpected).toEqual([]);
  });
});
