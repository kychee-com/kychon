// seo.ts — Site-wide indexing switch (`site_config.seo_noindex`, kychon#189).
//
// An unlisted portal (a copied-site demo sent to a prospect, a preview) sets
// `seo_noindex: true`. Every surface reads the decision through this module:
//   - Portal.astro bakes `<meta name="robots" content="noindex,nofollow">`
//     (via chrome-bake.ts) and it overrides any per-page `robots` prop;
//   - config.ts:applyRobots reconciles the meta live after an admin toggle;
//   - /robots.txt answers `Disallow: /`;
//   - /llms.txt stops advertising the portal (404).
//
// Dependency-free and isomorphic (build, SSR Lambda, browser).

export const SEO_NOINDEX_KEY = 'seo_noindex';

/** id of the robots meta Portal.astro bakes and config.ts:applyRobots updates. */
export const ROBOTS_META_ID = 'wl-robots';

/** Robots directive every page carries while the site is unlisted. */
export const SITE_NOINDEX_ROBOTS = 'noindex,nofollow';

/** `site_config.seo_noindex` is a JSONB boolean; accept its string form too. */
export function isSeoNoindex(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Directive for a page with no restriction of its own (the crawler default). */
export const DEFAULT_ROBOTS = 'all';

/** The page's robots directive: the site-wide noindex wins over the page's own. */
export function effectiveRobots(pageRobots: string | undefined, siteNoindex: boolean): string {
  if (siteNoindex) return SITE_NOINDEX_ROBOTS;
  return pageRobots || DEFAULT_ROBOTS;
}

export function buildRobotsTxt(siteNoindex: boolean): string {
  return siteNoindex ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nDisallow:\n';
}

/** /llms.txt for an unlisted portal: no portal URL, API, or connector links. */
export const UNLISTED_LLMS_TXT = '# Unlisted\n\nThis site is not listed and is not offered for indexing.\n';
