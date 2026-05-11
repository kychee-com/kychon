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
import { cacheHeroImage, currentBuildId, isFeatureEnabled, ready, siteConfig } from './config';
import { currentPageSlugFromLocation } from './clean-routes.js';
import { getLocale } from './i18n';
import { BLOCK_TYPES, renderBlock, type BlockRenderContext, type Section } from './blocks.js';

const CACHE_PREFIX = 'wl_cache_sections_';
const CACHE_TTL = 5 * 60 * 1000;

interface CachedSections {
  data: Section[];
  ts: number;
  buildId?: string;
}

function readCache(slug: string): Section[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const parsed: CachedSections = JSON.parse(raw);
    const buildId = currentBuildId();
    if (buildId && parsed?.buildId !== buildId) {
      localStorage.removeItem(CACHE_PREFIX + slug);
      return null;
    }
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache(slug: string, data: Section[]): void {
  try {
    const buildId = currentBuildId();
    localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify({ data, ts: Date.now(), ...(buildId ? { buildId } : {}) }));
  } catch {}
}

function cacheIsFresh(slug: string): boolean {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return false;
    const { ts, buildId } = JSON.parse(raw);
    const activeBuildId = currentBuildId();
    if (activeBuildId && buildId !== activeBuildId) return false;
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
    currentPath: typeof window !== 'undefined'
      ? window.location.pathname + window.location.search + window.location.hash
      : '/',
    session,
    siteName: siteConfig.site_name ? String(siteConfig.site_name) : undefined,
    // brand_header reads these via the picker rules.
    brandText: siteConfig.brand_text ? String(siteConfig.brand_text) : undefined,
    brandTextShort: siteConfig.brand_text_short ? String(siteConfig.brand_text_short) : undefined,
    brandIconUrl: siteConfig.brand_icon_url ? String(siteConfig.brand_icon_url) : undefined,
    brandWordmarkUrl: siteConfig.brand_wordmark_url ? String(siteConfig.brand_wordmark_url) : undefined,
  };
}

function renderZoneInto(
  zone: 'header' | 'main' | 'footer',
  sections: Section[],
  ctx: BlockRenderContext,
): { container: HTMLElement | null; rendered: HTMLElement[] } {
  const containerWrapper = document.getElementById(`zone-${zone}`);
  // Header/footer: the inner Kychon container holds the rendered HTML so we don't
  // clobber the .nav / .footer wrappers (and their transition:persist).
  const container =
    zone === 'main'
      ? (document.getElementById('main-content') as HTMLElement | null)
      : (containerWrapper?.querySelector('.ky-container') as HTMLElement | null);
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

  // Header / footer zones split into "chrome" blocks (rendered inside the
  // existing .ky-container — brand_header, nav, sign_in_bar, footer_address,
  // etc.) and "full-bleed" blocks (page_banner today; rendered outside the
  // constrained chrome container so they span the viewport).
  const chromeBlocks: Section[] = [];
  const fullBleedBlocks: Section[] = [];
  for (const s of filtered) {
    const def = BLOCK_TYPES[s.section_type];
    if (def?.fullBleed) fullBleedBlocks.push(s);
    else chromeBlocks.push(s);
  }
  const chromeHtml = chromeBlocks.map((s) => renderBlock(s, ctx)).join('');
  if (container.innerHTML !== chromeHtml) {
    container.innerHTML = chromeHtml;
  }

  // Full-bleed siblings live in a dedicated `[data-fullbleed-host]` container.
  // Header full-bleed blocks are inserted after the sticky `.nav`, not inside it;
  // otherwise a page banner would stay stuck to the viewport while scrolling.
  // Footer full-bleed blocks can remain inside the footer wrapper.
  if (containerWrapper) {
    const headerBleedSelector = '[data-fullbleed-host][data-zone-fullbleed="header"]';
    let bleedHost =
      zone === 'header'
        ? (document.querySelector(headerBleedSelector) as HTMLElement | null)
        : containerWrapper.querySelector<HTMLElement>('[data-fullbleed-host]');
    if (fullBleedBlocks.length > 0) {
      if (!bleedHost) {
        bleedHost = document.createElement('div');
        bleedHost.setAttribute('data-fullbleed-host', '');
        if (zone === 'header') {
          bleedHost.setAttribute('data-zone-fullbleed', 'header');
        }
        bleedHost.style.width = '100%';
      }
      if (zone === 'header' && bleedHost.previousElementSibling !== containerWrapper) {
        containerWrapper.insertAdjacentElement('afterend', bleedHost);
      } else if (zone !== 'header' && bleedHost.parentElement !== containerWrapper) {
        containerWrapper.appendChild(bleedHost);
      }
      const bleedHtml = fullBleedBlocks.map((s) => renderBlock(s, ctx)).join('');
      if (bleedHost.innerHTML !== bleedHtml) {
        bleedHost.innerHTML = bleedHtml;
      }
    } else if (bleedHost) {
      // No bleed blocks for this page — clear the host (don't remove it; keeps
      // DOM stable across SPA navigations).
      if (bleedHost.innerHTML !== '') bleedHost.innerHTML = '';
    }
  }

  const rendered: HTMLElement[] = [];
  containerWrapper?.querySelectorAll('[data-block-hydrate]').forEach((el) => rendered.push(el as HTMLElement));
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
  const hydrate = el.matches('[data-block-hydrate]')
    ? el
    : (el.querySelector('[data-block-hydrate]') as HTMLElement | null);
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

function warmHeroImageCache(sections: Section[]): void {
  // Cache the first visible hero section's image URL so the NEXT page load's
  // <link rel="preload" as="image"> fires before sections fetch completes.
  const hero = sections.find(
    (s) => s.section_type === 'hero' && s.zone === 'main' && s.visible !== false,
  );
  if (hero) cacheHeroImage(hero);
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
    warmHeroImageCache(cached);
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
  warmHeroImageCache(fresh);
  await hydrateDynamic(fresh, ctx);
  rebindAdminEditing();
}

export function currentPageSlug(): string {
  return currentPageSlugFromLocation(window.location.pathname, window.location.search);
}
