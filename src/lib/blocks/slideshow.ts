// slideshow.ts - React owner for the `slideshow` block runtime.

import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import {
  SlideshowCarousel,
  type SlideshowCarouselProps,
  type SlideshowRenderItem,
} from '@/components/kychon/SlideshowBlockView';
import { collectDescendantElements } from '../dom-structure.js';
import { getGlobalManifest } from '../kychon-image.js';

interface MountedSlideshow {
  onSwap: () => void;
  root: Root;
}

const MOUNTED_SLIDESHOWS = new WeakMap<HTMLElement, MountedSlideshow>();

function isSlideshowHost(host: HTMLElement): boolean {
  return host.getAttribute('data-block-hydrate') === 'slideshow';
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readItems(value: unknown): SlideshowRenderItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): SlideshowRenderItem => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      alt: stringOr(record.alt, ''),
      avifSrc: typeof record.avifSrc === 'string' ? record.avifSrc : undefined,
      caption: typeof record.caption === 'string' ? record.caption : undefined,
      fetchPriority: record.fetchPriority === 'high' || record.fetchPriority === 'low' || record.fetchPriority === 'auto'
        ? record.fetchPriority
        : undefined,
      fit: record.fit === 'contain' ? 'contain' : 'cover',
      href: typeof record.href === 'string' ? record.href : undefined,
      loading: record.loading === 'lazy' ? 'lazy' : 'eager',
      objectPosition: stringOr(record.objectPosition, 'center'),
      src: stringOr(record.src, ''),
      webpSrc: typeof record.webpSrc === 'string' ? record.webpSrc : undefined,
    };
  });
}

function readRootStyle(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function readSlideshowProps(host: HTMLElement): SlideshowCarouselProps | null {
  const raw = host.getAttribute('data-slideshow-props');
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw);
    parsed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return null;
  }
  const items = readItems(parsed.items);
  if (!items.length) return null;
  return {
    ariaLabel: stringOr(parsed.ariaLabel, 'Slideshow'),
    autoMs: Math.max(0, numberOr(parsed.autoMs, 0)),
    fit: parsed.fit === 'contain' ? 'contain' : 'cover',
    items,
    // Pulled from window.__KYCHON_ASSET_MANIFEST (populated by page-render.ts
    // before any block hydrators run). Not serialized in data-slideshow-props
    // to keep the per-instance JSON payload small — one global manifest
    // shared by every block on the page.
    manifest: getGlobalManifest(),
    manualPause: booleanOr(parsed.manualPause, false),
    pauseFocus: booleanOr(parsed.pauseFocus, true),
    pauseHover: booleanOr(parsed.pauseHover, true),
    rootStyle: readRootStyle(parsed.rootStyle),
    showArrows: booleanOr(parsed.showArrows, true),
    showDots: booleanOr(parsed.showDots, true),
    transition: parsed.transition === 'slide' ? 'slide' : 'fade',
  };
}

export function initSlideshow(host: HTMLElement): void {
  if (host.dataset.hydrated === 'true') return;
  const props = readSlideshowProps(host);
  if (!props) return;

  const reactRoot = createRoot(host);
  const onSwap = () => destroySlideshow(host);
  MOUNTED_SLIDESHOWS.set(host, { onSwap, root: reactRoot });
  document.addEventListener('astro:before-swap', onSwap, { once: true });
  flushSync(() => {
    reactRoot.render(createElement(SlideshowCarousel, props));
  });
  host.dataset.hydrated = 'true';
}

export function initSlideshows(root: HTMLElement = document.body): void {
  for (const host of collectDescendantElements(root, isSlideshowHost)) initSlideshow(host);
}

export function destroySlideshow(host: HTMLElement): void {
  const mounted = MOUNTED_SLIDESHOWS.get(host);
  if (!mounted) return;
  document.removeEventListener('astro:before-swap', mounted.onSwap);
  flushSync(() => {
    mounted.root.unmount();
  });
  MOUNTED_SLIDESHOWS.delete(host);
  delete host.dataset.hydrated;
}
