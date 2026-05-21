import { getBuildTimeManifest } from '@run402/astro/build-manifest';
import { renderBlock, type BlockRenderContext, type Section } from './blocks.js';
import { renderFontHead } from './theme/fonts.js';
import type { ProjectSeed } from '../seeds/types.js';

export interface BakedChrome {
  headerHtml: string;
  footerHtml: string;
  fontHead: string;
  customCss: string;
  faviconUrl: string;
  isSvgFavicon: boolean;
  title: string;
  bakeCtx: BlockRenderContext;
}

export function seedValue(seed: ProjectSeed, key: string): unknown {
  const raw = (seed.site_config as Record<string, unknown>)[key];
  if (raw === undefined) return undefined;
  if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
    return (raw as { value: unknown }).value;
  }
  return raw;
}

export function stringFromSeed(seed: ProjectSeed, key: string): string {
  const value = seedValue(seed, key);
  if (value === undefined || value === null) return '';
  return String(value);
}

export function featureFromSeed(seed: ProjectSeed, flag: string): boolean {
  const value = seedValue(seed, flag);
  if (value === undefined) return true;
  return value === true || value === 'true';
}

export function themeFromSeed(seed: ProjectSeed): Record<string, unknown> {
  const theme = seedValue(seed, 'theme');
  return theme && typeof theme === 'object' && !Array.isArray(theme)
    ? (theme as Record<string, unknown>)
    : {};
}

export function getBrandedTitle(title: string, siteName: string): string {
  const cleanSiteName = String(siteName || '').trim();
  if (!cleanSiteName) return String(title || '').trim();

  const cleanTitle = String(title || '').trim();
  if (!cleanTitle || cleanTitle === cleanSiteName) return cleanSiteName;

  const suffix = ` — ${cleanSiteName}`;
  let normalizedTitle = cleanTitle;
  while (normalizedTitle.endsWith(suffix)) {
    normalizedTitle = normalizedTitle.slice(0, -suffix.length).trimEnd();
  }

  return normalizedTitle ? `${normalizedTitle}${suffix}` : cleanSiteName;
}

export function isSvgFaviconUrl(url: string): boolean {
  return /\.svg($|\?)/i.test(url) || url.startsWith('data:image/svg+xml');
}

export function makeBakeContext(seed: ProjectSeed): BlockRenderContext {
  return {
    admin: false,
    locale: 'en',
    authenticated: false,
    role: null,
    isFeatureEnabled: (flag: string) => featureFromSeed(seed, flag),
    currentPath: '/',
    siteName: stringFromSeed(seed, 'site_name'),
    brandText: stringFromSeed(seed, 'brand_text') || stringFromSeed(seed, 'site_name'),
    brandTextShort: stringFromSeed(seed, 'brand_text_short'),
    brandIconUrl: stringFromSeed(seed, 'brand_icon_url'),
    brandWordmarkUrl: stringFromSeed(seed, 'brand_wordmark_url'),
    // Build-time AssetManifest from @run402/astro@0.2.4. Null when the
    // integration has no `assetsDir` configured (dev builds, non-demo builds);
    // emitters fall through to plain `<img>` in that case, identical to
    // pre-bake first-paint behavior. Chrome blocks don't consult the manifest
    // (sub-320 icons), but main-zone bakes do — see renderMainZone.
    manifest: getBuildTimeManifest(),
  };
}

export function renderGlobalZone(
  seed: ProjectSeed,
  zone: 'header' | 'footer',
  ctx: BlockRenderContext = makeBakeContext(seed),
): string {
  return (seed.sections as unknown as Section[])
    .filter((s) => s.zone === zone && s.scope === 'global' && s.visible !== false)
    .sort((a, b) => a.position - b.position)
    .map((s) => renderBlock(s, ctx))
    .join('');
}

// Bake page-scoped main-zone sections for a specific slug. Mirrors
// page-render.ts:renderZoneInto's 'main' branch — admin live-edits are still
// applied by the runtime hydrate, so this only sets the first paint.
export function renderMainZone(
  seed: ProjectSeed,
  pageSlug: string,
  ctx: BlockRenderContext = makeBakeContext(seed),
): string {
  return (seed.sections as unknown as Section[])
    .filter(
      (s) =>
        s.zone === 'main' &&
        s.scope === 'page' &&
        s.page_slug === pageSlug &&
        s.visible !== false,
    )
    .sort((a, b) => a.position - b.position)
    .map((s) => renderBlock(s, ctx))
    .join('');
}

export function bakeChrome(seed: ProjectSeed, pageTitle: string): BakedChrome {
  const bakeCtx = makeBakeContext(seed);
  const theme = themeFromSeed(seed);
  const faviconUrl =
    stringFromSeed(seed, 'favicon_url') ||
    stringFromSeed(seed, 'brand_icon_url') ||
    '/favicon.svg';
  return {
    headerHtml: renderGlobalZone(seed, 'header', bakeCtx),
    footerHtml: renderGlobalZone(seed, 'footer', bakeCtx),
    fontHead: renderFontHead(
      theme.font_heading as string | undefined,
      theme.font_body as string | undefined,
    ),
    customCss: stringFromSeed(seed, 'custom_css'),
    faviconUrl,
    isSvgFavicon: isSvgFaviconUrl(faviconUrl),
    title: getBrandedTitle(pageTitle, bakeCtx.siteName || bakeCtx.brandText || ''),
    bakeCtx,
  };
}
