import { beforeEach, describe, expect, it, vi } from 'vitest';

const ssrPageHeaderSections = vi.fn();
const ssrAssetManifest = vi.fn();
const getBakeAssetManifest = vi.fn();
const resolveActiveProjectSeed = vi.fn();

vi.mock('../../src/lib/ssr-api', () => ({
  ssrPageHeaderSections,
  ssrAssetManifest,
  ssrRequestOrigin: (_url: URL, host: string) => `https://${host}`,
}));
vi.mock('../../src/lib/bake-asset-manifest', () => ({ getBakeAssetManifest }));
vi.mock('../../src/seeds', () => ({ resolveActiveProjectSeed }));

const { prefetchSsrChrome, prefetchedHeaderSections } = await import('../../src/lib/ssr-chrome-prefetch');

const portSeed = {
  site_config: { brand_icon_url: '/assets/tree.svg' },
  sections: [],
};
const plainSeed = { site_config: {}, sections: [] };

function astro() {
  return {
    request: new Request('https://club.run402.com/calendar', { headers: { host: 'club.run402.com' } }),
    url: new URL('https://club.run402.com/calendar'),
    locals: {} as App.Locals,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('prefetchSsrChrome', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ssrPageHeaderSections.mockResolvedValue([]);
    ssrAssetManifest.mockResolvedValue(null);
    getBakeAssetManifest.mockReturnValue(null);
  });

  it('starts the header read and hands Portal the same promise for that slug only', async () => {
    resolveActiveProjectSeed.mockResolvedValue({ seed: plainSeed });
    const target = astro();
    prefetchSsrChrome(target, 'calendar');

    expect(ssrPageHeaderSections).toHaveBeenCalledWith({ slug: 'calendar', host: 'club.run402.com' });
    expect(prefetchedHeaderSections(target.locals, 'calendar')).toBe(target.locals.ssrChrome?.headerSections);
    expect(prefetchedHeaderSections(target.locals, 'event')).toBeUndefined();
    await flush();
    expect(ssrAssetManifest).not.toHaveBeenCalled();
  });

  it("warms the site manifest when a port's chrome names /assets/ images", async () => {
    resolveActiveProjectSeed.mockResolvedValue({ seed: portSeed });
    prefetchSsrChrome(astro(), 'calendar');
    await flush();
    expect(ssrAssetManifest).toHaveBeenCalledWith('https://club.run402.com');
  });

  it('warms it for a page banner too', async () => {
    resolveActiveProjectSeed.mockResolvedValue({ seed: plainSeed });
    ssrPageHeaderSections.mockResolvedValue([{ section_type: 'page_banner' }]);
    prefetchSsrChrome(astro(), 'calendar');
    await flush();
    expect(ssrAssetManifest).toHaveBeenCalledOnce();
  });

  it('skips the manifest when the build bundled one (demos)', async () => {
    resolveActiveProjectSeed.mockResolvedValue({ seed: portSeed });
    getBakeAssetManifest.mockReturnValue({ assets: {} });
    prefetchSsrChrome(astro(), 'calendar');
    await flush();
    expect(resolveActiveProjectSeed).not.toHaveBeenCalled();
    expect(ssrAssetManifest).not.toHaveBeenCalled();
  });
});
