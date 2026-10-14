/**
 * Start an SSR page's chrome reads before its own data reads.
 *
 * Portal.astro bakes the chrome after the page's frontmatter has finished, so
 * on `/calendar`, `/event` and `/search` its reads (the page's header rows,
 * then the site asset manifest) used to run only after the page's own API
 * call. On a cold container each of those waits included the API's own cold
 * path, and they added up (kychon#226 follow-up: cold /calendar). A page calls
 * `prefetchSsrChrome` first thing; the reads run alongside its own, Portal
 * awaits the same header promise via `Astro.locals`, and the manifest lands in
 * `ssrAssetManifest`'s per-origin cache, which holds the in-flight promise.
 */

import { getBakeAssetManifest } from './bake-asset-manifest';
import type { Section } from './blocks';
import { chromeNeedsAssetManifest } from './chrome-bake';
import { ssrAssetManifest, ssrPageHeaderSections, ssrRequestOrigin } from './ssr-api';
import { resolveActiveProjectSeed } from '../seeds';

export interface SsrChromePrefetch {
  slug: string;
  headerSections: Promise<Section[]>;
}

interface PrefetchTarget {
  request: Request;
  url: URL;
  locals: App.Locals;
}

export function prefetchSsrChrome(astro: PrefetchTarget, slug: string): void {
  const host = astro.request.headers.get('host') ?? astro.url.host;
  const origin = ssrRequestOrigin(astro.url, host);
  const headerSections = ssrPageHeaderSections({ slug, host });
  astro.locals.ssrChrome = { slug, headerSections };
  // A bundled build-time manifest (demos) already resolves the chrome.
  if (getBakeAssetManifest()) return;
  void (async () => {
    const { seed } = await resolveActiveProjectSeed();
    if (chromeNeedsAssetManifest(seed) || (await headerSections).length > 0) await ssrAssetManifest(origin);
  })().catch(() => undefined);
}

/** The page's prefetched header rows, when it prefetched this slug. */
export function prefetchedHeaderSections(locals: App.Locals, slug: string): Promise<Section[]> | undefined {
  const prefetch = locals.ssrChrome;
  return prefetch && prefetch.slug === slug ? prefetch.headerSections : undefined;
}
