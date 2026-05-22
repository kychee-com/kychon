// page-render.ts — Runtime hydration of header/main/footer zones.
//
// Flow on every page load (and astro:after-swap):
//   1. Read cached sections for this slug (instant if present).
//   2. Render header / main / footer zones from cache.
//   3. Fetch fresh through the capability API facade.
//   4. If response differs from cache, re-render and update cache.
//   5. Hydrate dynamic blocks (announcements_feed, activity_feed, polls, etc.).
//   6. Bind admin editing handlers.
//
// Build-time bake produces the FIRST paint from src/seeds/{project}.ts;
// this module is responsible for everything after that.

import { get } from './api';
import { getSession, getRole } from './auth';
import { cacheHeroImage, isFeatureEnabled, ready, siteConfig } from './config';
import { currentPageSlugFromLocation } from './clean-routes.js';
import { getLocale } from './i18n';
import { BLOCK_TYPES, renderBlock, type BlockRenderContext, type Section } from './blocks.js';
import { renderReactHtmlChildren } from './react-html-children';
import {
  collectDescendantElements,
  findDescendantElement,
  findDirectElementChild,
  nearestElementWithAttribute,
} from './dom-structure';
import { type AssetManifest, setGlobalManifest } from './kychon-image';

const CACHE_PREFIX = 'wl_cache_sections_';
const CACHE_TTL = 5 * 60 * 1000;
const ASSET_MANIFEST_URL = '/_assets-manifest.json';
const ASSET_MANIFEST_CACHE_KEY = 'wl_cache_assets_manifest';

// Module-scope manifest cache. Two layers:
//   1. localStorage seed read on module load — synchronous, available BEFORE
//      the first `renderZoneInto` call. This is what kills the flicker that
//      otherwise hits on every cached-pass refresh: without it the cached
//      pass paints `<img src="/assets/X.jpg">`, then `fetchAndUpdate` resolves
//      the network manifest and re-paints `<picture>`, producing a visible
//      swap. With the localStorage seed the first paint is already
//      `<picture>` and the network refresh is a no-op when the manifest's
//      `generated_at` hasn't moved.
//   2. Network fetch in fetchManifest() — always runs, refreshes the
//      localStorage seed for the next reload. Variant URLs are immutable
//      (content-hashed), so a stale seed only misses brand-new assets; it
//      never serves wrong bytes.
// 404s and JSON parse failures resolve to null — emitters fall back to plain
// `<img>` for everything, same behavior as a build without `assetsDir`.
let manifestPromise: Promise<AssetManifest | null> | null = null;
let cachedManifest: AssetManifest | null = readManifestFromLocalStorage();

if (cachedManifest) {
  // Populate the global accessor immediately so client-mounted React
  // hydrators (e.g. SlideshowCarousel) see the manifest on first mount,
  // not only after the network fetch resolves.
  setGlobalManifest(cachedManifest);
}

function readManifestFromLocalStorage(): AssetManifest | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ASSET_MANIFEST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) return null;
    return parsed as AssetManifest;
  } catch {
    return null;
  }
}

function writeManifestToLocalStorage(manifest: AssetManifest): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ASSET_MANIFEST_CACHE_KEY, JSON.stringify(manifest));
  } catch {
    // Likely QuotaExceededError — manifest with 200+ image entries can push
    // tens of KB. Drop the seed; next reload will re-paint via the network
    // fetch path, which is the pre-cache-seed behavior.
  }
}

function fetchManifest(): Promise<AssetManifest | null> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const res = await fetch(ASSET_MANIFEST_URL, { cache: 'force-cache' });
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== 1) return null;
      const manifest = data as AssetManifest;
      cachedManifest = manifest;
      writeManifestToLocalStorage(manifest);
      setGlobalManifest(manifest);
      return manifest;
    } catch {
      return null;
    }
  })();
  return manifestPromise;
}

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
    // Populated by `fetchManifest()` once on first hydrate; null until then
    // (image emitters fall through to plain `<img>` for the very first render
    // pass). After the fetch resolves, every subsequent renderBlock call sees
    // the manifest and emits `<picture>` with v1.49 variants.
    manifest: cachedManifest,
  };
}

function findHeaderFullBleedHost(zoneRoot: HTMLElement): HTMLElement | null {
  const next = zoneRoot.nextElementSibling;
  if (
    next instanceof HTMLElement &&
    next.hasAttribute('data-fullbleed-host') &&
    next.dataset.zoneFullbleed === 'header'
  ) {
    return next;
  }
  return findDirectElementChild(
    zoneRoot.parentElement,
    (child) => child.hasAttribute('data-fullbleed-host') && child.dataset.zoneFullbleed === 'header',
  );
}

function hydrateHosts(): HTMLElement[] {
  const body = document.body;
  if (!body) return [];
  const hosts: HTMLElement[] = [];
  collectDescendantElements(body, (el) => el.hasAttribute('data-block-hydrate'), hosts);
  return hosts;
}

function renderZoneInto(
  zone: 'header' | 'main' | 'footer',
  sections: Section[],
  ctx: BlockRenderContext,
): void {
  const body = document.body;
  const containerWrapper = findDescendantElement(body, (child) => child.id === `zone-${zone}`);
  // Header/footer: the inner Kychon container holds the rendered HTML so we don't
  // clobber the persisted shell wrappers.
  const container =
    zone === 'main'
      ? findDescendantElement(body, (child) => child.id === 'main-content')
      : findDirectElementChild(containerWrapper, (child) => child.hasAttribute('data-layout-container'));
  if (!container) return;

  const filtered = sections
    .filter((s) => s.zone === zone)
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.position - b.position);

  if (zone === 'main') {
    // Main is the page slot — only replace the existing #sections / page-section
    // children if the page wants schema-driven sections. We don't blow away
    // the entire <main> because pages own arbitrary content there.
    const sectionsHost = findDescendantElement(container, (child) => child.id === 'sections');
    if (!sectionsHost) {
      // No #sections host — pages opting out of zone main rendering.
      return;
    }
    const newHtml = filtered.map((s) => renderBlock(s, ctx)).join('');
    renderReactHtmlChildren(sectionsHost, newHtml);
    return;
  }

  // Header / footer zones split into "chrome" blocks (rendered inside the
  // existing constrained container — brand_header, nav, sign_in_bar, footer_address,
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
  renderReactHtmlChildren(container, chromeHtml);

  // Full-bleed siblings live in a dedicated `[data-fullbleed-host]` container.
  // Header full-bleed blocks are inserted after the sticky nav shell, not inside it;
  // otherwise a page banner would stay stuck to the viewport while scrolling.
  // Footer full-bleed blocks can remain inside the footer wrapper.
  if (containerWrapper) {
    const bleedHost =
      zone === 'header'
        ? findHeaderFullBleedHost(containerWrapper)
        : findDirectElementChild(containerWrapper, (child) => child.hasAttribute('data-fullbleed-host'));
    if (fullBleedBlocks.length > 0) {
      if (bleedHost) {
        const bleedHtml = fullBleedBlocks.map((s) => renderBlock(s, ctx)).join('');
        renderReactHtmlChildren(bleedHost, bleedHtml);
      }
    } else if (bleedHost) {
      // No bleed blocks for this page — clear the host (don't remove it; keeps
      // DOM stable across SPA navigations).
      renderReactHtmlChildren(bleedHost, '');
    }
  }

  return;
}

function findSectionForElement(el: HTMLElement, sections: Section[]): Section | null {
  const sortable = nearestElementWithAttribute(el, 'data-sortable-id');
  if (sortable) {
    const id = sortable.dataset.sortableId?.split('.')[1];
    if (id != null) {
      const found = sections.find((s) => String(s.id) === id);
      if (found) return found;
    }
  }
  // Chrome blocks may not have a data-sortable-id (rendered without sid in bake).
  const blockType = el.getAttribute('data-block-hydrate');
  if (blockType) {
    const found = sections.find((s) => s.section_type === blockType);
    if (found) return found;
  }
  return null;
}

async function hydrateDynamic(sections: Section[], ctx: BlockRenderContext): Promise<void> {
  // Find every block container that has an outstanding hydrate hook and run it.
  for (const host of hydrateHosts()) {
    const blockType = host.getAttribute('data-block-hydrate');
    if (!blockType) continue;
    const type = BLOCK_TYPES[blockType];
    if (!type || !type.hydrate) continue;
    const section = findSectionForElement(host, sections) || {
      page_slug: '*',
      zone: 'main',
      scope: 'global',
      section_type: blockType,
      config: {},
      position: 1,
    };
    try {
      await type.hydrate(host, section, ctx);
    } catch (e) {
      console.warn(`hydrate(${blockType}) failed:`, e);
    }
  }
}

async function rebindAdminEditing(): Promise<void> {
  // Inform the AdminEditor that the DOM has new editable / sortable nodes.
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

export function sectionAppliesToPageSlug(section: Section, slug: string): boolean {
  return section.scope === 'global' || section.page_slug === '*' || section.page_slug === slug;
}

export function filterSectionsForPageSlug(sections: Section[], slug: string): Section[] {
  return sections.filter((section) => sectionAppliesToPageSlug(section, slug));
}

// =============================================================================
// admin-content-management: section_translations merge (Decision 9)
//
// When ctx.locale != ctx.defaultLocale AND the locale is in
// `site_config.languages_enabled` (kitchen-sink pool), fetch
// section_translations for the active locale and deep-merge each translated
// row's partial config over the base section's config. Array fields merge
// by index (translation.items[i] spreads over base.items[i]); missing items
// fall back to the base config.
//
// On the client (static SPA build) `ctx.locale` is `getLocale()` which reads
// localStorage; the gateway-resolved locale lives in `x-run402-locale` for
// future routed-render paths. Behavior is identical for both today because
// the cookie + localStorage are kept in sync by `setLanguage()`.
// =============================================================================

interface SectionTranslationRow {
  section_id: number;
  language: string;
  config: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge `override` onto `base`. Plain-object values merge recursively;
 * arrays merge by index (untranslated items keep base values); scalars and
 * non-object override values replace base. Returns a new object — neither
 * input is mutated.
 */
export function deepMergeTranslation(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = base?.[key];
    if (Array.isArray(value) && Array.isArray(baseValue)) {
      const merged: unknown[] = [];
      const len = Math.max(baseValue.length, value.length);
      for (let i = 0; i < len; i++) {
        const baseItem = baseValue[i];
        const overrideItem = value[i];
        if (overrideItem === undefined) {
          merged.push(baseItem);
        } else if (isPlainObject(baseItem) && isPlainObject(overrideItem)) {
          merged.push(deepMergeTranslation(baseItem, overrideItem));
        } else {
          merged.push(overrideItem);
        }
      }
      out[key] = merged;
    } else if (isPlainObject(value) && isPlainObject(baseValue)) {
      out[key] = deepMergeTranslation(baseValue, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function activeLocaleForTranslation(): string | null {
  // Both checks: (1) non-default locale, (2) locale is enabled in the portal.
  const locale = getLocale();
  const defaultLocale = (siteConfig.default_language as string | undefined) || 'en';
  if (!locale || locale === defaultLocale) return null;
  const enabledRaw = siteConfig.languages_enabled ?? siteConfig.languages;
  const enabled = Array.isArray(enabledRaw) ? enabledRaw : null;
  if (enabled && !enabled.includes(locale)) return null;
  return locale;
}

async function fetchSectionTranslationsForActiveLocale(): Promise<SectionTranslationRow[]> {
  const locale = activeLocaleForTranslation();
  if (!locale) return [];
  try {
    const rows = (await get(
      `section_translations?language=eq.${encodeURIComponent(locale)}`,
    )) as SectionTranslationRow[];
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.warn('Failed to fetch section translations:', e);
    return [];
  }
}

function applySectionTranslations(
  sections: Section[],
  translations: SectionTranslationRow[],
): Section[] {
  if (translations.length === 0) return sections;
  const byId = new Map<number, SectionTranslationRow>();
  for (const t of translations) {
    if (t && typeof t.section_id === 'number') byId.set(t.section_id, t);
  }
  return sections.map((s) => {
    const id = (s as Section & { id?: number }).id;
    if (typeof id !== 'number') return s;
    const t = byId.get(id);
    if (!t || !isPlainObject(t.config)) return s;
    return {
      ...s,
      config: deepMergeTranslation(s.config || {}, t.config),
    };
  });
}

export async function hydratePage(slug: string): Promise<void> {
  await ready;
  // Kick off the manifest fetch as early as possible. The cached-pass render
  // below may run with `ctx.manifest === null` if the fetch hasn't resolved
  // (first paint without variants — acceptable degradation, the network race
  // is between the manifest JSON fetch and localStorage cache hydrate). The
  // subsequent `fetchAndUpdate` always sees the resolved manifest because we
  // await it before re-rendering zones.
  void fetchManifest();
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
    void fetchAndUpdate(slug, cached);
    return;
  }

  await fetchAndUpdate(slug, cached);
}

async function fetchAndUpdate(
  slug: string,
  cached: Section[] | null,
): Promise<void> {
  // Await the manifest before issuing fresh renders. Both fetches run in
  // parallel (fetchManifest() was kicked off at hydratePage's entry), so
  // the practical wait is the slower of the two — typically the sections
  // PostgREST query dominates.
  const [_, freshRaw, translations] = await Promise.all([
    fetchManifest(),
    (async () => {
      try {
        const query = 'sections?visible=eq.true&order=zone.asc,position.asc';
        return filterSectionsForPageSlug(await get(query), slug);
      } catch (e) {
        console.warn('Failed to fetch sections:', e);
        return null;
      }
    })(),
    fetchSectionTranslationsForActiveLocale(),
  ]);
  if (!freshRaw) return;
  const fresh = applySectionTranslations(freshRaw, translations);

  // Refresh the ctx so it picks up the just-fetched manifest. Sections
  // changes (admin uploads, role changes) are picked up too.
  const refreshedCtx = getRenderContext();

  writeCache(slug, fresh);
  if (cached && JSON.stringify(cached) === JSON.stringify(fresh)) {
    // No section diff — re-render anyway because the manifest may have
    // landed since the cached pass painted `<img>` instead of `<picture>`.
    // Skipping this here means first-hydrate users without variants until
    // they navigate away and back.
    renderZoneInto('header', fresh, refreshedCtx);
    renderZoneInto('footer', fresh, refreshedCtx);
    renderZoneInto('main', fresh, refreshedCtx);
    warmHeroImageCache(fresh);
    await hydrateDynamic(fresh, refreshedCtx);
    rebindAdminEditing();
    return;
  }

  renderZoneInto('header', fresh, refreshedCtx);
  renderZoneInto('footer', fresh, refreshedCtx);
  renderZoneInto('main', fresh, refreshedCtx);
  warmHeroImageCache(fresh);
  await hydrateDynamic(fresh, refreshedCtx);
  rebindAdminEditing();
}

export function currentPageSlug(): string {
  return currentPageSlugFromLocation(window.location.pathname, window.location.search);
}
