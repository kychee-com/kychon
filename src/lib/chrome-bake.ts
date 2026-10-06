import { getBakeAssetManifest } from './bake-asset-manifest.js';
import { BLOCK_TYPES, dedupeSingletonSections, renderBlock, type BlockRenderContext, type Section } from './blocks.js';
import { resolveAssetUrl } from './kychon-image.js';
import { computeMainZoneSignature } from './main-zone-signature.js';
import { isSeoNoindex } from './seo.js';
import { buildFontVarValue, buildGoogleFontsUrl, renderFontHead } from './theme/fonts.js';
import type { ProjectSeed } from '../seeds/types.js';

export interface BakedChrome {
  headerHtml: string;
  /**
   * Full-bleed header blocks (page_banner) for the baked page, rendered into
   * the `[data-fullbleed-host][data-zone-fullbleed="header"]` sibling of the
   * nav shell — the same host `page-render.ts:renderZoneInto('header')` paints.
   * Empty for the slug-less (global-only) bake.
   */
  headerFullBleedHtml: string;
  /**
   * Global nav `presentation.header_position` (e.g. `static`), baked as
   * `--nav-header-position` on `[data-nav-shell]`, the element that reads it.
   * The nav block sets the var on its own links element, which is a
   * descendant of the shell, so without this the config never applied.
   */
  headerPosition: string | null;
  footerHtml: string;
  fontHead: string;
  /**
   * Google Fonts stylesheet URL for the theme fonts, or null for system-only
   * fonts. Portal.astro bakes this onto a stable `<link id="wl-font-stylesheet">`
   * so the runtime (config.ts:ensureFontStylesheet) can repoint it on a live
   * `theme.font_heading`/`font_body` edit with no rebuild. `fontHead` carries
   * the preconnect hints + size-adjust fallback faces (not the stylesheet link).
   */
  fontStylesheetUrl: string | null;
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
  /**
   * Color-scheme pin from `site_config.theme.color_scheme`. Copied sites
   * have one design baked into imagery and custom CSS, so honoring the
   * visitor's OS dark-mode preference flips the tokens out from under that
   * design (white-on-white text for dark-mode visitors). `'light'`/`'dark'`
   * pin the scheme; `'auto'` (default) keeps the OS/localStorage behavior
   * for token-driven native sites.
   */
  colorScheme: 'light' | 'dark' | 'auto';
  /** theme.motion: 'subtle' (default — scroll-reveal + stat count-up via
   *  src/lib/delight.ts) or 'none' to keep every page static. */
  motion: 'subtle' | 'none';
  /** site_config.seo_noindex: the whole portal is unlisted (kychon#189). */
  noindex: boolean;
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
    // Build-time AssetManifest: the @run402/astro integration's (demo builds)
    // or a port's staged `public/_assets-manifest.json`. Null in dev builds
    // without either and at SSR request time; emitters then fall through to
    // the literal URL and the runtime hydrate resolves it via the fetched
    // manifest. Chrome (brand icon/wordmark, favicon) and main-zone bakes both
    // resolve `/assets/<basename>` through it.
    manifest: getBakeAssetManifest(),
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

export interface HeaderZoneBake {
  /** Chrome blocks for the constrained `#zone-header` container. */
  html: string;
  /** Full-bleed blocks (page_banner) for the header full-bleed host. */
  fullBleedHtml: string;
}

// Bake the header zone for a specific page: global header sections plus the
// page's own scope='page' header sections (page_banner, page-specific
// brand_header, ...), in position order. Mirrors page-render.ts:renderZoneInto's
// header branch — same singleton dedupe, same chrome / full-bleed split — so the
// runtime hydrate repaints identical markup. Other pages' page-scoped sections
// never leak in (kychon#190).
export function renderHeaderZone(
  seed: ProjectSeed,
  pageSlug: string,
  ctx: BlockRenderContext = makeBakeContext(seed),
): HeaderZoneBake {
  const filtered = dedupeSingletonSections(
    (seed.sections as unknown as Section[])
      .filter(
        (s) =>
          s.zone === 'header' &&
          s.visible !== false &&
          (s.scope === 'global' || (s.scope === 'page' && s.page_slug === pageSlug)),
      )
      .sort((a, b) => a.position - b.position),
    pageSlug,
  );
  const chrome: string[] = [];
  const fullBleed: string[] = [];
  for (const s of filtered) {
    (BLOCK_TYPES[s.section_type]?.fullBleed ? fullBleed : chrome).push(renderBlock(s, ctx));
  }
  return { html: chrome.join(''), fullBleedHtml: fullBleed.join('') };
}

// Bake page-scoped main-zone sections for a specific slug. Mirrors
// page-render.ts:renderZoneInto's 'main' branch — admin live-edits are still
// applied by the runtime hydrate, so this only sets the first paint.
//
// Returns BOTH the rendered HTML AND a content signature of the (filtered
// sections, manifest.generated_at) tuple. The astro template stamps the
// signature on `<div id="sections" data-bake-signature="…">`; the client
// reads it in `page-render.ts:renderZoneInto` and skips the destructive
// re-render when the live data would produce the same signature.
//
// This preserves SSR-baked `<Run402Image>` content (variant ladder + v1.54
// pre-decoded blurhash placeholder) when the seed and DB are in sync —
// the common case for demo tenants after their reset cron AND production
// tenants in steady state. When they diverge (admin edits, new uploads),
// signatures differ → existing replace-innerHTML path fires unchanged.
export interface MainZoneBake {
  html: string;
  signature: string;
}

export function renderMainZone(
  seed: ProjectSeed,
  pageSlug: string,
  ctx: BlockRenderContext = makeBakeContext(seed),
): MainZoneBake {
  const filtered = (seed.sections as unknown as Section[])
    .filter(
      (s) =>
        s.zone === 'main' &&
        s.scope === 'page' &&
        s.page_slug === pageSlug &&
        s.visible !== false,
    )
    .sort((a, b) => a.position - b.position);
  const html = filtered.map((s) => renderBlock(s, ctx)).join('');
  const signature = computeMainZoneSignature({
    sections: filtered,
    manifestGeneratedAt: ctx.manifest?.generated_at ?? null,
  });
  return { html, signature };
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

export interface BakeChromeOptions {
  /**
   * Slug of the page being baked. When set, the header bake also includes that
   * page's scope='page' header sections (see `renderHeaderZone`); when omitted
   * the header is global-only.
   */
  pageSlug?: string;
  /**
   * Asset manifest to resolve baked image URLs against when the build-time
   * manifest is unavailable — SSR routes pass the site's request-time manifest
   * (`ssrAssetManifest`) so a page_banner's `/assets/<name>` resolves to its CDN URL.
   */
  manifest?: BlockRenderContext['manifest'];
}

export function bakeChrome(
  seed: ProjectSeed,
  pageTitle: string,
  options: BakeChromeOptions = {},
): BakedChrome {
  const bakeCtx = makeBakeContext(seed);
  if (!bakeCtx.manifest && options.manifest) bakeCtx.manifest = options.manifest;
  const header = options.pageSlug
    ? renderHeaderZone(seed, options.pageSlug, bakeCtx)
    : { html: renderGlobalZone(seed, 'header', bakeCtx), fullBleedHtml: '' };
  const theme = themeFromSeed(seed);
  // `/assets/<basename>` favicons resolve to their CDN URL; the SVG check reads
  // the source path's extension since the CDN URL need not carry one.
  const faviconSource =
    stringFromSeed(seed, 'favicon_url') ||
    stringFromSeed(seed, 'brand_icon_url') ||
    '/favicon.svg';
  const faviconUrl = resolveAssetUrl(faviconSource, bakeCtx.manifest);
  const headingVar = buildFontVarValue(theme.font_heading as string | undefined, 'serif');
  const bodyVar = buildFontVarValue(theme.font_body as string | undefined, 'sans-serif');
  const themeFontVarLines: string[] = [];
  if (headingVar) themeFontVarLines.push(`--font-heading: ${headingVar};`);
  if (bodyVar) themeFontVarLines.push(`--font-body: ${bodyVar};`);
  return {
    headerHtml: header.html,
    headerFullBleedHtml: header.fullBleedHtml,
    headerPosition: headerPositionFromSeed(seed),
    footerHtml: renderGlobalZone(seed, 'footer', bakeCtx),
    fontHead: renderFontHead(
      theme.font_heading as string | undefined,
      theme.font_body as string | undefined,
    ),
    fontStylesheetUrl: buildGoogleFontsUrl(
      theme.font_heading as string | undefined,
      theme.font_body as string | undefined,
    ),
    customCss: stringFromSeed(seed, 'custom_css'),
    faviconUrl,
    isSvgFavicon: isSvgFaviconUrl(faviconSource),
    title: getBrandedTitle(pageTitle, bakeCtx.siteName || bakeCtx.brandText || ''),
    cdnOrigin: cdnOriginFromManifest(bakeCtx.manifest),
    themeFontVarsCss: themeFontVarLines.join(' '),
    colorScheme: colorSchemeFromTheme(theme),
    motion: theme.motion === 'none' ? 'none' : 'subtle',
    noindex: isSeoNoindex(seedValue(seed, 'seo_noindex')),
    bakeCtx,
  };
}

const HEADER_POSITIONS = new Set(['static', 'sticky', 'relative']);

/** `presentation.header_position` of the global header-zone nav section, when valid. */
export function headerPositionFromSeed(seed: ProjectSeed): string | null {
  const nav = (seed.sections ?? []).find(
    (s) => s.section_type === 'nav' && s.zone === 'header' && s.visible !== false,
  );
  const value = (nav?.config as { presentation?: { header_position?: unknown } } | undefined)?.presentation?.header_position;
  return typeof value === 'string' && HEADER_POSITIONS.has(value) ? value : null;
}

function colorSchemeFromTheme(theme: Record<string, unknown>): 'light' | 'dark' | 'auto' {
  const value = theme.color_scheme;
  return value === 'light' || value === 'dark' ? value : 'auto';
}
