// nav-dropdown.ts - React mount shim for the `nav` block.

import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import { NavBlockContent, type NavBlockItem, type NavBlockProps, type NavBlockStyle } from '@/components/kychon/NavBlockView';

interface MountedNav {
  onSwap: () => void;
  root: Root;
}

const MOUNTED_NAVS = new WeakMap<HTMLElement, MountedNav>();
const MOUNTED_NAV_HOSTS = new Set<HTMLElement>();

function cleanupDisconnectedNavs(): void {
  for (const host of Array.from(MOUNTED_NAV_HOSTS)) {
    if (!host.isConnected) destroyNavDropdowns(host);
  }
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function readNavItems(value: unknown): NavBlockItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): NavBlockItem => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      active: booleanOr(record.active, false),
      children: readNavItems(record.children),
      hasHref: booleanOr(record.hasHref, false),
      href: stringOr(record.href, ''),
      label: stringOr(record.label, ''),
      menuId: typeof record.menuId === 'string' ? record.menuId : undefined,
    };
  });
}

function readNavStyle(value: unknown): NavBlockStyle | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [`--${string}`, string] => entry[0].startsWith('--') && typeof entry[1] === 'string');
  return entries.length ? Object.fromEntries(entries) as NavBlockStyle : undefined;
}

function readNavProps(host: HTMLElement): NavBlockProps | null {
  const raw = host.getAttribute('data-nav-props');
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw);
    parsed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return null;
  }
  const items = readNavItems(parsed.items);
  return {
    blockId: typeof parsed.blockId === 'string' || typeof parsed.blockId === 'number' ? parsed.blockId : null,
    desktopOpen: typeof parsed.desktopOpen === 'string' ? parsed.desktopOpen : undefined,
    items,
    mobileBreakpoint: numberOrNull(parsed.mobileBreakpoint),
    mobileClosedLayout: typeof parsed.mobileClosedLayout === 'string' ? parsed.mobileClosedLayout : undefined,
    mobileOpenLayout: typeof parsed.mobileOpenLayout === 'string' ? parsed.mobileOpenLayout : undefined,
    presentationStyle: readNavStyle(parsed.presentationStyle),
    useFullRow: booleanOr(parsed.useFullRow, false),
  };
}

function navHostFrom(target?: HTMLElement | null): HTMLElement | null {
  if (target?.matches('[data-block-hydrate="nav"]')) return target;
  return target?.closest('[data-block-hydrate="nav"]') ?? document.querySelector<HTMLElement>('[data-block-hydrate="nav"]');
}

export function bindNavDropdowns(navRoot?: HTMLElement | null): void {
  cleanupDisconnectedNavs();
  const host = navHostFrom(navRoot);
  if (!host || host.dataset.hydrated === 'true') return;
  const props = readNavProps(host);
  if (!props) return;
  const root = createRoot(host);
  const onSwap = () => destroyNavDropdowns(host);
  MOUNTED_NAVS.set(host, { onSwap, root });
  MOUNTED_NAV_HOSTS.add(host);
  document.addEventListener('astro:before-swap', onSwap, { once: true });
  flushSync(() => {
    root.render(createElement(NavBlockContent, props));
  });
  host.dataset.hydrated = 'true';
}

export function destroyNavDropdowns(host: HTMLElement): void {
  const mounted = MOUNTED_NAVS.get(host);
  if (!mounted) return;
  document.removeEventListener('astro:before-swap', mounted.onSwap);
  flushSync(() => mounted.root.unmount());
  MOUNTED_NAVS.delete(host);
  MOUNTED_NAV_HOSTS.delete(host);
  delete host.dataset.hydrated;
}

export function rebindNavDropdowns(): void {
  bindNavDropdowns();
}
