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
import { decodeBlurhashToDataUri } from '@run402/astro/blurhash';
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

// LQIP cache — keyed by blurhash string so repeated emissions (slideshow
// frames, repeated hero references) share the ~600μs DCT decode. Cache is
// process-scoped: keeps the bake hot, and runtime emits don't re-decode for
// images already painted in this session.
const LQIP_CACHE = new Map<string, string>();

function lqipDataUri(ref: AssetRef | null | undefined): string {
  const hash = ref?.blurhash;
  if (!hash) return '';
  let dataUri = LQIP_CACHE.get(hash);
  if (dataUri === undefined) {
    try {
      dataUri = decodeBlurhashToDataUri(hash);
    } catch {
      dataUri = '';
    }
    LQIP_CACHE.set(hash, dataUri);
  }
  return dataUri;
}

function lqipStyleString(ref: AssetRef | null | undefined): string {
  // Emits the same `background-image:url(data:…)` style the integration's
  // own `<Image>` component produces — paints a 32×32 blurhash preview
  // synchronously on parse, so the layout box reserved by aspect-ratio
  // shows the blurred image instead of gray for the ~100-500ms it takes
  // the WebP variant to arrive over the network.
  const dataUri = lqipDataUri(ref);
  if (!dataUri) return '';
  return `background-image:url(${dataUri});background-size:cover;background-repeat:no-repeat;`;
}

/**
 * Splice helper for `<img>` tags in chrome blocks (brand_header, etc.) that
 * don't go through `kychonImageHtml`. Returns a leading-space-prefixed
 * `width="..." height="..."` attribute string when the manifest carries
 * intrinsic dimensions, or '' on miss. Use exactly once per `<img>`:
 *
 *   `<img data-brand-icon src="..."${kychonChromeImgAttrs('/assets/logo.png', ctx.manifest)} alt="...">`
 *
 * We deliberately DON'T emit a blurhash LQIP here. Chrome images are
 * predominantly logos (`brand_icon_url`, `brand_wordmark_url`) which are
 * almost always PNGs with transparent backgrounds — the integration's
 * blurhash decoder encodes transparency against an opaque (often black)
 * backdrop, so the LQIP renders as a black square that flashes before
 * the real logo paints. The width/height attrs alone close the CLS gap
 * (the nav row reserves the right box at first paint); for the brief
 * load window the user sees the page background, which is far less
 * jarring than a black flash.
 */
export function kychonChromeImgAttrs(
  url: string | undefined | null,
  manifest: AssetManifest | null | undefined,
): string {
  const ref = lookupAssetRef(url, manifest);
  if (!ref) return '';
  const w = ref.width_px;
  const h = ref.height_px;
  const widthAttr = typeof w === 'number' && Number.isFinite(w) ? ` width="${w}"` : '';
  const heightAttr = typeof h === 'number' && Number.isFinite(h) ? ` height="${h}"` : '';
  return `${widthAttr}${heightAttr}`;
}

// `Omit<…, 'pictureAttrs'>` shadows v0.2.5's `Record<string,string>` form
// because our HTML emitter still takes a pre-built leading-space-prefixed
// attribute string for splice into the wrapping tag — different shape, same
// purpose. If we ever migrate to `renderPicture(ref, opts)` we can drop the
// Omit and pass `pictureAttrs: { 'data-hero-picture': '', ... }` directly.
export interface KychonImageHtmlOptions extends Omit<Partial<RenderPictureOptions>, 'pictureAttrs'> {
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

  // Blurhash LQIP — when the manifest carries `blurhash`, emit a base64
  // data URI as `background-image`. Placement matters: when we wrap in
  // `<picture>`, the LQIP MUST go on the wrapper, not the `<img>`. The
  // hero CSS animates `<img>` from `opacity:0 → 1`; if the LQIP were on
  // the same `<img>`, opacity:0 would hide the LQIP too, and the user
  // would see gray during the fade. With LQIP on `<picture>` the fade
  // reveals the blurred preview underneath, giving the smooth
  // blurhash→WebP transition. For the single-`<img>` fallback path
  // (manifest miss, sub-320 source) the LQIP rides on the `<img>` since
  // there's no wrapper.
  const lqipDecls = lqipStyleString(ref);
  const pictureStyleAttr = lqipDecls ? ` style="${lqipDecls}"` : '';

  // Build the inner content. With variants we emit `<source>` + `<img>`;
  // without (manifest miss or sub-320 source) we emit `<img>` alone.
  let inner: string;
  let willWrap: boolean;
  if (!ref || !hasVariantLadder(ref)) {
    const src = ref?.display_url ?? ref?.cdn_url ?? url;
    const dim = ref ? formatDimAttrs(opts.width ?? ref.width_px, opts.height ?? ref.height_px) : '';
    willWrap = Boolean(wrapAttrs);
    // LQIP on `<img>` only when there's no wrapper to host it.
    const imgStyleAttr = !willWrap ? pictureStyleAttr : '';
    inner =
      `<img src="${escAttr(src)}" alt="${altAttr}"${dim} ` +
      `loading="${loadingAttr}"${fetchPriorityAttr}${classAttr}${imgStyleAttr}${extraImg} />`;
  } else {
    willWrap = true; // `<source>` requires `<picture>`.
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
  if (willWrap) {
    return `<picture${wrapAttrs}${pictureStyleAttr}>${inner}</picture>`;
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
  // Blurhash LQIP — matches the HTML emitter above. Goes on the
  // wrapping `<picture>` when present, NOT the `<img>`, so an `<img>`
  // opacity fade animation reveals the LQIP underneath rather than
  // hiding it. For the single-`<img>` fallback path we put it on the
  // `<img>` directly since there's no wrapper.
  const lqip = lqipDataUri(ref);
  const lqipStyle: React.CSSProperties | null = lqip
    ? {
        backgroundImage: `url(${lqip})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }
    : null;
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
    // Single `<img>` path: LQIP rides on the img because there's no
    // wrapper. Caller-supplied `style` wins over LQIP background-* keys
    // (callers don't reach for those in practice).
    const imgStyle = lqipStyle ? { ...lqipStyle, ...(style ?? {}) } : style;
    return React.createElement('img', { ...imgProps, style: imgStyle, src, width: w, height: h });
  }

  const fallbackSrc = pickFallbackSrc(ref);
  const srcset = buildSrcset(ref);
  const sizesAttr = sizes ?? '100vw';
  const w = width ?? ref.width_px;
  const h = height ?? ref.height_px;

  return React.createElement(
    'picture',
    lqipStyle ? { style: lqipStyle } : null,
    React.createElement('source', {
      type: 'image/webp',
      srcSet: srcset,
      sizes: sizesAttr,
    }),
    React.createElement('img', { ...imgProps, src: fallbackSrc, width: w, height: h }),
  );
}
