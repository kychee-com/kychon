/**
 * Manifest-aware image markup helpers.
 *
 * The @run402/astro@0.2 integration walks demo asset directories at build
 * time, uploads each image to the Run402 assets slice (v1.49 encoder runs:
 * 3-width WebP ladder + HEIC display_jpeg + blurhash + intrinsic dims),
 * and writes the result to `dist/_assets-manifest.json`. This module
 * provides the consumer-side wrappers Kychon's data-driven renderers use:
 *
 *   - `kychonImageHtml(url, alt, opts, manifest)` — returns an HTML string;
 *     used by string-template emitters in `blocks.ts` (the hero block,
 *     brand chrome, etc.).
 *   - `<KychonImage url alt manifest .../>` — JSX form for React helper
 *     modules that render through `renderToStaticMarkup` (PromoCardsBlock,
 *     SlideshowBlockView, ImageAccordionBlockView, PageBannerBlock).
 *
 * Both check the manifest for a hit; on hit they emit
 * `<picture><source type="image/webp" srcset="..."/><img/></picture>` with
 * the gateway-generated variant URLs, on miss they fall back to a single
 * `<img>` with the original URL (admin-uploaded photos, runtime CMS data,
 * dev/preview builds without an assetsDir).
 *
 * Closes the consumer side of kychee-com/run402-private#406. The renderer
 * intentionally stays a pure function — manifest is plumbed through render
 * context (`BlockRenderContext.manifest`) or via explicit option fields,
 * never as a module-scope global, so SSR and CSR realms share one source
 * of truth without import-order surprises.
 */
import { resolveVariants, type AssetManifest, type RenderPictureOptions } from '@run402/astro/manifest';
import type { AssetRef, AssetVariant } from '@run402/astro';
import * as React from 'react';

export type { AssetManifest, AssetRef, AssetVariant };
export { resolveVariants };

/**
 * Window key used to expose the manifest to client-mounted React block
 * hydrators (e.g. `src/lib/blocks/slideshow.ts:initSlideshow`). These
 * mount fresh React trees from `data-*-props` JSON attributes and don't
 * receive the server-side `BlockRenderContext.manifest`; reading the
 * manifest from `window` keeps per-block JSON payloads small.
 *
 * `page-render.ts:hydratePage` calls `setGlobalManifest` once on first
 * load (after fetching `/_assets-manifest.json`) before any block
 * hydrator runs.
 */
const GLOBAL_MANIFEST_KEY = '__KYCHON_ASSET_MANIFEST';

export function getGlobalManifest(): AssetManifest | null {
  if (typeof window === 'undefined') return null;
  const value = (window as unknown as Record<string, unknown>)[GLOBAL_MANIFEST_KEY];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as AssetManifest)
    : null;
}

export function setGlobalManifest(manifest: AssetManifest | null): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  if (manifest) {
    w[GLOBAL_MANIFEST_KEY] = manifest;
  } else {
    delete w[GLOBAL_MANIFEST_KEY];
  }
}

/** v1.49 native widths — used to pick a sensible single-URL when CSS can't host a `<picture>`. */
const PREFERRED_FIT_VARIANT: Array<keyof NonNullable<AssetRef['variants']>> = ['medium', 'large', 'thumb'];

function escAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripAssetsPrefix(url: string): string {
  return url.replace(/^\/assets\//, '');
}

/**
 * Look up a `/assets/X.jpg` URL in the manifest. Returns null when the
 * manifest is unset, the URL is empty, or there's no matching entry.
 */
export function lookupAssetRef(
  url: string | undefined | null,
  manifest: AssetManifest | null | undefined,
): AssetRef | null {
  if (!manifest || !url) return null;
  return resolveVariants(manifest, stripAssetsPrefix(url));
}

/**
 * Pick the single CDN URL to use when we can't emit a full `<picture>`
 * (e.g., CSS `background-image`). Prefers `medium` (800w) as the most
 * commonly-correct middle ground, falling back to `large`, `thumb`, then
 * the un-variant `display_url`/`cdn_url`.
 */
export function pickSingleVariantUrl(ref: AssetRef): string {
  const variants = ref.variants;
  if (variants) {
    for (const kind of PREFERRED_FIT_VARIANT) {
      const variant = variants[kind] as AssetVariant | undefined;
      if (variant?.cdn_url) return variant.cdn_url;
    }
    if (variants.display_jpeg?.cdn_url) return variants.display_jpeg.cdn_url;
  }
  return ref.display_url ?? ref.cdn_url;
}

/**
 * Pick the `<img>` fallback URL — same matrix as @run402/astro's
 * picture-builder: HEIC sources route through `display_jpeg`, everything
 * else uses `display_url` → `cdn_url`.
 */
function pickFallbackSrc(ref: AssetRef): string {
  if (ref.variants?.display_jpeg?.cdn_url) return ref.variants.display_jpeg.cdn_url;
  return ref.display_url ?? ref.cdn_url;
}

function hasVariantLadder(ref: AssetRef): boolean {
  const v = ref.variants;
  if (!v) return false;
  return Boolean(v.thumb || v.medium || v.large);
}

function buildSrcset(ref: AssetRef): string {
  const variants = ref.variants;
  if (!variants) return '';
  const entries: string[] = [];
  for (const kind of ['thumb', 'medium', 'large'] as const) {
    const variant = variants[kind];
    if (variant) entries.push(`${variant.cdn_url} ${variant.width_px}w`);
  }
  return entries.join(', ');
}

export interface KychonImageHtmlOptions extends Partial<RenderPictureOptions> {
  /** Extra attributes spliced into the `<img>` element (e.g. `decoding="async"`). */
  imgAttrs?: string;
  /**
   * Extra attributes spliced into the wrapping element. When the manifest
   * hits we emit `<picture>` and these go on it; on miss they are dropped
   * because the fallback is a plain `<img>` with no wrapper.
   *
   * Use sparingly. Right shape is a leading-space-prefixed attribute
   * string like ` data-hero-picture data-hero-aspect="16/9"`.
   */
  pictureAttrs?: string;
}

/**
 * Emit `<picture>` markup when the manifest carries variants, otherwise a
 * single `<img>`. Used by string-template emitters in `blocks.ts`.
 *
 * Why we build the markup here rather than calling @run402/astro's
 * `renderPicture`: the integration's renderer ignores extra wrapper
 * attributes (it can't take a `pictureAttrs` parameter), and Kychon needs
 * `data-hero-picture`/`data-hero-aspect` on the `<picture>` for the
 * existing CSS aspect-ratio rules to apply. Reimplementing the picture-
 * building here keeps the attribute splice surface clean and tracks the
 * same matrix (HEIC → display_jpeg, sub-320 → single `<img>`).
 */
export function kychonImageHtml(
  url: string | undefined | null,
  alt: string,
  opts: KychonImageHtmlOptions = {},
  manifest: AssetManifest | null | undefined = null,
): string {
  if (!url) return '';
  const ref = lookupAssetRef(url, manifest);
  const loadingAttr = opts.priority ? 'eager' : opts.loading ?? 'lazy';
  const sizesAttr = opts.sizes ?? '100vw';
  const classAttr = opts.class ? ` class="${escAttr(opts.class)}"` : '';
  const fetchPriorityAttr = opts.priority ? ' fetchpriority="high"' : '';
  const extraImg = opts.imgAttrs ?? '';
  const wrapAttrs = opts.pictureAttrs ?? '';
  const altAttr = escAttr(alt);

  // Build the inner content. With variants we emit `<source>` + `<img>`;
  // without (manifest miss or sub-320 source) we emit `<img>` alone.
  let inner: string;
  if (!ref || !hasVariantLadder(ref)) {
    const src = ref?.display_url ?? ref?.cdn_url ?? url;
    const dim = ref ? formatDimAttrs(opts.width ?? ref.width_px, opts.height ?? ref.height_px) : '';
    inner =
      `<img src="${escAttr(src)}" alt="${altAttr}"${dim} ` +
      `loading="${loadingAttr}"${fetchPriorityAttr}${classAttr}${extraImg} />`;
  } else {
    const fallbackSrc = pickFallbackSrc(ref);
    const srcsetAttr = buildSrcset(ref);
    const dim = formatDimAttrs(opts.width ?? ref.width_px, opts.height ?? ref.height_px);
    inner =
      `<source type="image/webp" srcset="${srcsetAttr}" sizes="${escAttr(sizesAttr)}" />` +
      `<img src="${escAttr(fallbackSrc)}" alt="${altAttr}"${dim} ` +
      `loading="${loadingAttr}"${fetchPriorityAttr}${classAttr}${extraImg} />`;
  }

  // Wrap when the caller asks for picture-level attributes (e.g.
  // `data-hero-picture` for CSS aspect-ratio targeting) OR when the inner
  // content contains a `<source>` (which is invalid outside `<picture>`).
  // Plain-`<img>` callers without pictureAttrs get the bare `<img>` back.
  if (wrapAttrs || inner.startsWith('<source')) {
    return `<picture${wrapAttrs}>${inner}</picture>`;
  }
  return inner;
}

function formatDimAttrs(width: number | undefined, height: number | undefined): string {
  let out = '';
  if (typeof width === 'number' && Number.isFinite(width)) out += ` width="${width}"`;
  if (typeof height === 'number' && Number.isFinite(height)) out += ` height="${height}"`;
  return out;
}

// -------------------------------------------------------------------------
// React JSX variant — used by helper modules that emit through
// renderToStaticMarkup (MarketingBlocksView, SlideshowBlockView, etc.).
// -------------------------------------------------------------------------

export interface KychonImageProps {
  /** Source URL — typically `/assets/X.jpg` from a JSONB section config. */
  url: string | undefined | null;
  /** Required alt text. */
  alt: string;
  /** Manifest emitted by @run402/astro at build time. Null at build-time
   *  chrome bake and during dev when no assetsDir is configured. */
  manifest: AssetManifest | null | undefined;
  /** Browser-side sizes attribute. Default: `"100vw"`. */
  sizes?: string;
  /** Above-the-fold opt-in. */
  priority?: boolean;
  /** Override default `lazy`. */
  loading?: 'lazy' | 'eager';
  /** Passthrough class. */
  className?: string;
  /** Passthrough inline style (e.g., `objectFit`/`objectPosition`). */
  style?: React.CSSProperties;
  /** Manual width override (rare — usually let `width_px` from the manifest drive). */
  width?: number;
  /** Manual height override. */
  height?: number;
  /** Optional decoding attr. */
  decoding?: 'sync' | 'async' | 'auto';
  /** Extra data-* attrs spliced onto the rendered `<img>` (e.g., `data-editable-image`). */
  imgDataAttrs?: Record<`data-${string}`, string | undefined>;
  /** When non-null, returned in place of an empty render. */
  fallback?: React.ReactNode;
}

/**
 * React variant of `kychonImageHtml`. Emits `<picture>` JSX when the
 * manifest hits, otherwise a single `<img>`. Pure JSX — no
 * `dangerouslySetInnerHTML`, no client-side dependencies.
 */
export function KychonImage(props: KychonImageProps): React.ReactNode {
  const { url, alt, manifest, sizes, priority, loading, className, style, width, height, decoding, imgDataAttrs, fallback = null } = props;
  if (!url) return fallback;
  const ref = lookupAssetRef(url, manifest);
  const loadingAttr = priority ? 'eager' : loading ?? 'lazy';
  const fetchPriority = priority ? ('high' as const) : undefined;
  const resolvedDecoding = decoding ?? undefined;
  const imgProps = {
    alt,
    loading: loadingAttr,
    fetchPriority,
    className,
    style,
    decoding: resolvedDecoding,
    ...(imgDataAttrs ?? {}),
  };

  if (!ref || !hasVariantLadder(ref)) {
    const src = ref?.display_url ?? ref?.cdn_url ?? url;
    const w = width ?? ref?.width_px;
    const h = height ?? ref?.height_px;
    return React.createElement('img', { ...imgProps, src, width: w, height: h });
  }

  const fallbackSrc = pickFallbackSrc(ref);
  const srcset = buildSrcset(ref);
  const sizesAttr = sizes ?? '100vw';
  const w = width ?? ref.width_px;
  const h = height ?? ref.height_px;

  return React.createElement(
    'picture',
    null,
    React.createElement('source', {
      type: 'image/webp',
      srcSet: srcset,
      sizes: sizesAttr,
    }),
    React.createElement('img', { ...imgProps, src: fallbackSrc, width: w, height: h }),
  );
}
