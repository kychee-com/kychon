import { getBuildTimeManifest } from '@run402/astro/build-manifest';
import { renderBlock, type BlockRenderContext, type Section } from './blocks.js';
import { buildFontVarValue, renderFontHead } from './theme/fonts.js';
import type { ProjectSeed } from '../seeds/types.js';

export interface BakedChrome {
  headerHtml: string;
  footerHtml: string;
  fontHead: string;
  customCss: string;
  faviconUrl: string;
  isSvgFavicon: boolean;
  title: string;
  /**
   * Origin (e.g. `https://pr-256e20.run402.com`) of the image CDN serving
   * the manifest's variants. Null when there's no manifest. Portal.astro
   * emits a `<link rel="preconnect">` so TCP+TLS to the CDN happens in
   * parallel with the rest of the HTML download, saving ~50-100ms on the
   * critical path for first-image bytes.
   */
  cdnOrigin: string | null;
  /**
   * CSS declarations baked from the theme's font choices, ready for splice
   * into `<style id="wl-theme-vars">:root { ... }`. Includes the
   * `--font-heading`/`--font-body` vars with the project's design font +
   * size-adjust fallback family + generic. Without this, the runtime
   * `applyTheme()` is the only path that sets them — so first paint uses
   * theme.css's default font (e.g. Inter) and the page repaints in the
   * design font AFTER JS runs, producing a visible serif↔sans jump.
   */
  themeFontVarsCss: string;
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

// Build the `<link rel="preload" as="image" imagesrcset=... fetchpriority="high">`
// hint for the first foreground hero on a given page. Lets the browser start
// the WebP download in parallel with HTML parsing, *before* the `<source
// srcset>` is encountered in document order. Returns '' when there's no
// manifest hit (no integration, admin-uploaded image not in the bake, or no
// hero section on the page).
export function renderHeroPreloadLink(
  seed: ProjectSeed,
  pageSlug: string,
  manifest: BlockRenderContext['manifest'],
): string {
  if (!manifest) return '';
  // Find the first visible foreground hero on this slug whose image lives
  // in the asset manifest. Background-mode heroes use CSS background-image
  // and don't benefit from `as="image"` preload the same way.
  const sections = seed.sections as unknown as Section[];
  const hero = sections
    .filter(
      (s) =>
        s.zone === 'main' &&
        s.scope === 'page' &&
        s.page_slug === pageSlug &&
        s.section_type === 'hero' &&
        s.visible !== false,
    )
    .sort((a, b) => a.position - b.position)
    .find((s) => {
      const cfg = (s.config ?? {}) as Record<string, unknown>;
      return cfg.mode === 'foreground' && typeof cfg.image_url === 'string';
    });
  if (!hero) return '';
  const cfg = hero.config as Record<string, unknown>;
  const url = String(cfg.image_url);
  // Strip the `/assets/` prefix the integration walks against assetsDir.
  const key = url.replace(/^\/assets\//, '');
  const ref = manifest.assets?.[key];
  if (!ref) return '';
  // Build imagesrcset across the v1.49 ladder; href as fallback for browsers
  // without imagesrcset support (Safari ≤14 etc.).
  const variants = ref.variants;
  const entries: string[] = [];
  if (variants?.thumb) entries.push(`${variants.thumb.cdn_url} ${variants.thumb.width_px}w`);
  if (variants?.medium) entries.push(`${variants.medium.cdn_url} ${variants.medium.width_px}w`);
  if (variants?.large) entries.push(`${variants.large.cdn_url} ${variants.large.width_px}w`);
  const fallbackHref =
    variants?.large?.cdn_url ??
    variants?.medium?.cdn_url ??
    variants?.thumb?.cdn_url ??
    ref.cdn_url ??
    '';
  if (!fallbackHref) return '';
  const srcsetAttr = entries.length > 0 ? ` imagesrcset="${entries.join(', ')}" imagesizes="100vw"` : '';
  const mimeAttr = entries.length > 0 ? ' type="image/webp"' : '';
  return (
    `<link rel="preload" as="image"${mimeAttr}` +
    ` href="${fallbackHref}"${srcsetAttr} fetchpriority="high" />`
  );
}

// Extract the origin of the first variant CDN URL found in the manifest.
// Returns null for non-integration builds (no manifest) or empty manifests.
export function cdnOriginFromManifest(
  manifest: BlockRenderContext['manifest'],
): string | null {
  if (!manifest || !manifest.assets) return null;
  for (const asset of Object.values(manifest.assets)) {
    const url =
      asset?.variants?.medium?.cdn_url ??
      asset?.variants?.large?.cdn_url ??
      asset?.variants?.thumb?.cdn_url ??
      asset?.cdn_url;
    if (!url) continue;
    const match = url.match(/^(https?:\/\/[^/]+)/);
    if (match) return match[1];
  }
  return null;
}

export function bakeChrome(seed: ProjectSeed, pageTitle: string): BakedChrome {
  const bakeCtx = makeBakeContext(seed);
  const theme = themeFromSeed(seed);
  const faviconUrl =
    stringFromSeed(seed, 'favicon_url') ||
    stringFromSeed(seed, 'brand_icon_url') ||
    '/favicon.svg';
  const headingVar = buildFontVarValue(theme.font_heading as string | undefined, 'serif');
  const bodyVar = buildFontVarValue(theme.font_body as string | undefined, 'sans-serif');
  const themeFontVarLines: string[] = [];
  if (headingVar) themeFontVarLines.push(`--font-heading: ${headingVar};`);
  if (bodyVar) themeFontVarLines.push(`--font-body: ${bodyVar};`);
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
    cdnOrigin: cdnOriginFromManifest(bakeCtx.manifest),
    themeFontVarsCss: themeFontVarLines.join(' '),
    bakeCtx,
  };
}
