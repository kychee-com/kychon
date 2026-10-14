// @vitest-environment happy-dom
/**
 * Same contract as event-image-manifest-client.test.ts (kychee-com/kychon#186
 * / #169), for authored HTML on custom pages: on a cold visit the manifest
 * arrives after the page content has rendered (ports above the inline cap
 * fetch `/_assets-manifest.json` after mount), and the content's
 * `/assets/<name>` images must re-resolve then instead of staying on the
 * unserved path (every image on a copied site's /links page 404ed).
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetManifest } from '../../src/lib/kychon-image';
import type { Page } from '../../src/schemas/content';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

// The background refresh never settles: the island keeps the baked page.
vi.mock('../../src/lib/config', () => ({ ready: new Promise(() => {}), translateItems: vi.fn() }));
vi.mock('../../src/lib/api', () => ({ get: vi.fn(() => new Promise(() => {})) }));

const { default: CustomPageApp } = await import('../../src/components/kychon/CustomPageApp');
const { setGlobalManifest } = await import('../../src/lib/kychon-image');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CDN = 'https://pr-test.run402.com/_blob/astro/logo-1a2b3c4d.jpg';
const manifest = {
  version: 1,
  assets: { 'logo.jpg': { key: 'astro/logo-1a2b3c4d.jpg', url: CDN, cdn_url: CDN, width_px: 200, height_px: 200 } },
} as unknown as AssetManifest;

const page = {
  id: 3,
  slug: 'links',
  title: 'Links',
  content: '<p><a href="https://example.com"><img src="/assets/logo.jpg" alt="Sponsor"></a></p>',
  published: true,
  requires_auth: false,
} as unknown as Page;

let root: Root | null = null;

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    setGlobalManifest(null);
  });
  root = null;
  clearBodyFixture();
});

describe('custom page island (client)', () => {
  it('re-resolves content images once the manifest arrives', async () => {
    const host = bodyFixture('<div></div>').firstElementChild as HTMLElement;
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(CustomPageApp, { initialPage: page }));
    });
    expect(host.innerHTML).toContain('src="/assets/logo.jpg"');
    await act(async () => {
      setGlobalManifest(manifest);
    });
    expect(host.innerHTML).toContain(CDN);
    expect(host.innerHTML).not.toContain('"/assets/logo.jpg"');
  });
});
