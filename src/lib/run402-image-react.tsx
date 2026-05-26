/**
 * Typed React wrapper around `@run402/astro@1.0.2`'s `Run402Image`.
 *
 * Two friction points from upstream that this wrapper still isolates
 * (down from three pre-1.0.1 — see history below):
 *
 * 1. **AssetRef shape mismatch between `@run402/astro` and
 *    `@run402/functions`.** `Run402ImageProps.asset: AssetRef` (upstream)
 *    is imported from `@run402/functions@2.7.0`. That type has fields
 *    like `visibility`, `immutable`, `content_digest`, `cdnUrl` (camelCase
 *    mirror), etc. — fields NOT present in `@run402/astro`'s manifest-
 *    pipeline AssetRef (the type Kychon's `lookupAssetRef` returns). The
 *    runtime values are structurally compatible at the field set
 *    `<Run402Image>` actually reads (cdn_url + variants + width_px +
 *    height_px + blurhash_data_url + asset_schema), but the static types
 *    don't align. Bridge at the boundary.
 *
 * 2. **`style` accepts only `string | Record<string, string | number>`
 *    upstream** — React's `CSSProperties` (with strongly-typed keys like
 *    `objectFit: "cover" | "contain"`) is narrower-but-not-assignable
 *    to that signature, so Kychon's `<Run402Image style={objectStyle}>`
 *    needs the widening. Cast inside the wrapper rather than at every
 *    call site.
 *
 * **Fixed in 1.0.1+ (no longer wrapper concerns):**
 *   - JSX compatibility: `ReactComponent<P>` now returns `ReactElement |
 *     null`, not `unknown`. The wrapper's `React.FC<...>` cast is no
 *     longer strictly required for JSX-acceptance — it remains because
 *     it co-bundles with the AssetRef widening above.
 *   - `Run402ImageProps` is now re-exported from `@run402/astro/react`
 *     (alongside `AssetRef` from `@run402/functions`, `DataAttributes`,
 *     `ImageDefaults`, etc.) — consumers could compose typed wrappers
 *     against the upstream interface directly.
 *
 * When `@run402/astro` re-exports `@run402/functions`'s AssetRef from
 * its `main` entry too (currently only on `/react`), AND widens `style`
 * to accept React's `CSSProperties` natively, this wrapper can collapse
 * to a single-line re-export.
 */
import { Run402Image as Run402ImageBrand } from '@run402/astro/react';
import type * as React from 'react';
import type { AssetRef as KychonAssetRef } from '@run402/astro';

/**
 * Mapped type allowing arbitrary `data-*` attributes (matches the upstream
 * `DataAttributes` exhaustive-no-escape-hatch posture). The `data-run402-image`
 * key is RESERVED — the component sets it itself for the rendered marker.
 */
type KychonDataAttrs = {
  [K in Exclude<`data-${string}`, 'data-run402-image'>]?: string | number | boolean | undefined;
};

/**
 * Kychon-side prop interface for `<Run402Image>`. Mirrors the upstream
 * Run402ImageProps with two boundary widenings:
 *
 * - `asset` typed as the local `@run402/astro` AssetRef (the shape
 *   `lookupAssetRef` produces); cast inside the wrapper to satisfy the
 *   upstream `@run402/functions` AssetRef static type
 * - `style` accepts React's `CSSProperties` (with strongly-typed keys like
 *   `objectFit: 'cover' | 'contain'`) in addition to the upstream
 *   `string | Record<string, string | number>` form
 */
export interface KychonRun402ImageProps extends KychonDataAttrs {
  asset: KychonAssetRef;
  alt: string;
  sizes?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'sync' | 'async' | 'auto';
  width?: number;
  height?: number;
  placeholder?: 'auto' | 'blurhash' | 'none';
  fetchpriority?: 'high' | 'low' | 'auto';
  strict?: boolean | { onSchema: '>=v1.49' | '>=v1.50' | '>=v1.54' | 'any' };
  class?: string;
  className?: string;
  style?: React.CSSProperties | string | Record<string, string | number>;
  id?: string;
  crossorigin?: 'anonymous' | 'use-credentials';
  referrerpolicy?: string;
}

/**
 * Kychon's typed `<Run402Image>`. Use this at call sites instead of
 * importing directly from `@run402/astro/react`.
 *
 *   import { Run402Image } from '@/lib/run402-image-react';
 *   <Run402Image asset={ref} alt="..." sizes="100vw" />
 */
export const Run402Image = Run402ImageBrand as unknown as React.FC<KychonRun402ImageProps>;
