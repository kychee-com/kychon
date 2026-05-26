/**
 * Kychon-side `<Run402Image>` entry point.
 *
 * As of `@run402/astro@1.0.3` (kychee-com/run402#401), both friction
 * points this wrapper used to bridge are fixed upstream:
 *
 *   1. `Run402ImageProps.asset` is the structural-subset `Run402ImageAsset`
 *      shape, so the narrow `Run402AstroManifestAssetRef` (what
 *      `resolveVariants` / `lookupAssetRef` return) flows in directly.
 *   2. `Run402ImageProps.style` natively accepts `React.CSSProperties`
 *      alongside the legacy `string | Record<string, string | number>`.
 *
 * The wrapper is kept as a single-line re-export — every call site
 * (`EventsListIsland`, `EventsPageApp`, `EventDetailPageApp`,
 * `SlideshowBlockView`, `MarketingBlocksView`, `ImageAccordionBlockView`)
 * imports `Run402Image` from here, so this indirection preserves a
 * single update point if upstream ever needs another adapter.
 */
export { Run402Image, type Run402ImageProps as KychonRun402ImageProps } from '@run402/astro/react';
