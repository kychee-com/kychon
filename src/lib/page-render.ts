// page-render.ts — Runtime hydration of header/main/footer zones.
//
// Flow on every page load (and astro:after-swap):
//   1. Read cached sections for this slug (instant if present).
//   2. Render header / main / footer zones from cache.
//   3. Fetch fresh from PostgREST.
//   4. If response differs from cache, re-render and update cache.
//   5. Hydrate dynamic blocks (announcements_feed, activity_feed, polls, etc.).
//   6. Bind admin editing handlers.
//
// Build-time bake produces the FIRST paint from src/seeds/{project}.ts;
// this module is responsible for everything after that.

import { get } from './api';
import { getSession, getRole } from './auth';
import { isFeatureEnabled, ready } from './config';
import { getLocale } from './i18n';
import { BLOCK_TYPES, renderBlock, type BlockRenderContext, type Section } from './blocks';

const CACHE_PREFIX = 'wl_cache_sections_';
const CACHE_TTL = 5 * 60 * 1000;

interface CachedSections {
  data: Section[];
  ts: number;
}

function readCache(slug: string): Section[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const parsed: CachedSections = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache(slug: string, data: Section[]): void {
  try {
    localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function cacheIsFresh(slug: string): boolean {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return typeof ts === 'number' && ts + CACHE_TTL > Date.now();
  } catch {
    return false;
  }
}

function getRenderContext(): BlockRenderContext {
  const session = getSession();
  const role = getRole();
  return {
    admin: role === 'admin',
    locale: getLocale(),
    authenticated: !!session,
    role: (role as BlockRenderContext['role']) ?? null,
    isFeatureEnabled,
    currentPath: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
    session,
  };
}

function renderZoneInto(
  zone: 'header' | 'main' | 'footer',
  sections: Section[],
  ctx: BlockRenderContext,
): { container: HTMLElement | null; rendered: HTMLElement[] } {
  const containerWrapper = document.getElementById(`zone-${zone}`);
  // Header/footer: the inner container holds the rendered HTML so we don't
  // clobber the .nav / .footer wrappers (and their transition:persist).
  const container =
    zone === 'main'
      ? (document.getElementById('main-content') as HTMLElement | null)
      : (containerWrapper?.querySelector('.container') as HTMLElement | null);
  if (!container) return { container: null, rendered: [] };

  const filtered = sections
    .filter((s) => s.zone === zone)
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.position - b.position);

  if (zone === 'main') {
    // Main is the page slot — only replace the existing #sections / page-section
    // children if the page wants schema-driven sections. We don't blow away
    // the entire <main> because pages own arbitrary content there.
    const sectionsHost = document.getElementById('sections') || container;
    if (sectionsHost === container) {
      // No #sections host — pages opting out of zone main rendering.
      return { container, rendered: [] };
    }
    const newHtml = filtered.map((s) => renderBlock(s, ctx)).join('');
    if (sectionsHost.innerHTML !== newHtml) {
      sectionsHost.innerHTML = newHtml;
    }
    const rendered: HTMLElement[] = [];
    sectionsHost.querySelectorAll('[data-sortable-id]').forEach((el) => rendered.push(el as HTMLElement));
    return { container: sectionsHost, rendered };
  }

  const newHtml = filtered.map((s) => renderBlock(s, ctx)).join('');
  if (container.innerHTML !== newHtml) {
    container.innerHTML = newHtml;
  }
  const rendered: HTMLElement[] = [];
  container.querySelectorAll('[data-block-hydrate]').forEach((el) => rendered.push(el as HTMLElement));
  return { container, rendered };
}

function findSectionForElement(el: HTMLElement, sections: Section[]): Section | null {
  const sortable = el.closest('[data-sortable-id]') as HTMLElement | null;
  if (sortable) {
    const id = sortable.dataset.sortableId?.split('.')[1];
    if (id != null) {
      const found = sections.find((s) => String(s.id) === id);
      if (found) return found;
    }
  }
  // Chrome blocks may not have a data-sortable-id (rendered without sid in bake).
  const hydrate = el.querySelector('[data-block-hydrate]') as HTMLElement | null;
  if (hydrate) {
    const blockType = hydrate.getAttribute('data-block-hydrate');
    if (blockType) {
      const found = sections.find((s) => s.section_type === blockType);
      if (found) return found;
    }
  }
  return null;
}

async function hydrateDynamic(sections: Section[], ctx: BlockRenderContext): Promise<void> {
  // Find every block container that has an outstanding hydrate hook and run it.
  const hosts = document.querySelectorAll<HTMLElement>('[data-block-hydrate]');
  for (const host of hosts) {
    const blockType = host.getAttribute('data-block-hydrate');
    if (!blockType) continue;
    const type = BLOCK_TYPES[blockType];
    if (!type || !type.hydrate) continue;
    const root = host.closest('[data-sortable-id], #zone-header, #zone-footer') as HTMLElement | null;
    const matching = root?.querySelector('[data-block-hydrate]') as HTMLElement | null;
    const wrapper = matching?.parentElement || root || host;
    const section = findSectionForElement(host, sections) || {
      page_slug: '*',
      zone: 'main',
      scope: 'global',
      section_type: blockType,
      config: {},
      position: 1,
    };
    try {
      await type.hydrate(wrapper as HTMLElement, section, ctx);
    } catch (e) {
      console.warn(`hydrate(${blockType}) failed:`, e);
    }
  }
}

async function rebindAdminEditing(): Promise<void> {
  // Inform the AdminEditor that the DOM has new editable / sortable nodes.
  // The MutationObserver inside AdminEditor reacts to the innerHTML change too,
  // but a custom event is a cleaner contract.
  document.dispatchEvent(new CustomEvent('wl-content-rendered'));
}

export async function hydratePage(slug: string): Promise<void> {
  await ready;
  const ctx = getRenderContext();

  // Cached pass — instant if we have data.
  const cached = readCache(slug);
  if (cached) {
    renderZoneInto('header', cached, ctx);
    renderZoneInto('footer', cached, ctx);
    renderZoneInto('main', cached, ctx);
    await hydrateDynamic(cached, ctx);
    rebindAdminEditing();
  }

  if (cached && cacheIsFresh(slug)) {
    // Background revalidate without blocking
    void fetchAndUpdate(slug, ctx, cached);
    return;
  }

  await fetchAndUpdate(slug, ctx, cached);
}

async function fetchAndUpdate(
  slug: string,
  ctx: BlockRenderContext,
  cached: Section[] | null,
): Promise<void> {
  let fresh: Section[] = [];
  try {
    const query =
      `sections?or=(and(page_slug.eq.${encodeURIComponent(slug)},scope.eq.page),scope.eq.global,page_slug.eq.*)` +
      `&visible=eq.true&order=zone.asc,position.asc`;
    fresh = await get(query);
  } catch (e) {
    console.warn('Failed to fetch sections:', e);
    return;
  }

  writeCache(slug, fresh);
  if (cached && JSON.stringify(cached) === JSON.stringify(fresh)) {
    // No diff — already rendered. Still ensure dynamic blocks hydrate at least once.
    await hydrateDynamic(fresh, ctx);
    rebindAdminEditing();
    return;
  }

  renderZoneInto('header', fresh, ctx);
  renderZoneInto('footer', fresh, ctx);
  renderZoneInto('main', fresh, ctx);
  await hydrateDynamic(fresh, ctx);
  rebindAdminEditing();
}

export function currentPageSlug(): string {
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') return 'index';
  if (path === '/page.html') {
    return new URLSearchParams(window.location.search).get('slug') || 'index';
  }
  // Strip trailing .html / leading slash for routes like /events.html etc.
  const m = path.match(/^\/(.+?)(?:\.html)?$/);
  return m ? m[1] : 'index';
}
