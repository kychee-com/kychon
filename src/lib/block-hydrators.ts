// block-hydrators.ts — Browser-only hydration logic for dynamic blocks.
// Kept separate from blocks.ts so the registry stays import-safe at build time
// (Astro frontmatter runs in Node and shouldn't pull in localStorage/auth).

import type { Section, BlockRenderContext } from './blocks.js';
import { sectionShellFor } from './dom-structure.js';

function isHydrateHost(el: HTMLElement, blockType: string): boolean {
  return el.getAttribute('data-block-hydrate') === blockType;
}

function hydrationShell(host: HTMLElement): HTMLElement {
  return sectionShellFor(host);
}

export async function hydrateAnnouncementsFeed(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  if (!isHydrateHost(el, 'announcements_feed')) return;
  let cfg: Record<string, unknown> = section.config || {};
  try {
    cfg = { ...cfg, ...JSON.parse(el.getAttribute('data-config') || '{}') };
  } catch {}
  const { mountAnnouncementsFeedIsland } = await import('@/components/kychon/AnnouncementsFeedIsland');
  mountAnnouncementsFeedIsland(el, {
    config: cfg,
    role: ctx.role || null,
    pollsEnabled: ctx.isFeatureEnabled?.('feature_polls') !== false,
    headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
  });
  el.dataset.hydrated = 'true';
}

export async function hydrateActivityFeed(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  if (!isHydrateHost(el, 'activity_feed')) return;
  const { mountActivityFeedIsland } = await import('@/components/kychon/ActivityFeedIsland');
  mountActivityFeedIsland(el, {
    limit: Number(section.config?.limit || 15),
    role: ctx.role || null,
  });
}

export async function hydrateSiteSearch(
  el: HTMLElement,
  section: Section,
  _ctx: BlockRenderContext,
): Promise<void> {
  if (!isHydrateHost(el, 'site_search') || el.dataset.hydrated === 'true') return;
  let cfg: any = section.config || {};
  try {
    cfg = { ...cfg, ...JSON.parse(el.getAttribute('data-config') || '{}') };
  } catch {}

  const { mountSiteSearchIsland } = await import('@/components/kychon/SiteSearchIsland');
  mountSiteSearchIsland(el, {
    config: cfg,
    sectionId: String(section.id ?? `pos-${section.position}`),
    zone: section.zone,
  });
  el.dataset.hydrated = 'true';
}

export async function hydrateLinkListResources(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  if (!isHydrateHost(el, 'link_list') || el.dataset.hydrated === 'true') return;
  let cfg: any = {};
  try {
    cfg = JSON.parse(el.getAttribute('data-config') || '{}');
  } catch {
    cfg = {};
  }
  const { mountLinkListIsland } = await import('@/components/kychon/LinkListIsland');
  const shell = hydrationShell(el);
  mountLinkListIsland(el, {
    config: cfg,
    headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
    onEmptyChange(empty) {
      shell.hidden = empty;
    },
  });
  el.dataset.hydrated = 'true';
}

// --- Catalog block hydrators ---

export async function hydrateEventsCalendar(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  if (!isHydrateHost(el, 'events_calendar') || el.dataset.hydrated === 'true') return;
  const { initCalendar } = await import('./blocks/events-calendar.js');
  initCalendar(el, section, ctx);
  el.dataset.hydrated = 'true';
}

export async function hydrateEventsList(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  if (!isHydrateHost(el, 'events_list') || el.dataset.hydrated === 'true') return;
  let cfg: any = {};
  try {
    cfg = JSON.parse(el.getAttribute('data-config') || '{}');
  } catch {
    cfg = {};
  }
  // SSR handoff: `blocks.ts:EVENTS_LIST.render` emits a `data-events-payload`
  // attribute with the build-time event rows when `ctx.buildEvents` is
  // populated. Passing them as `initialEvents` lets React's first render
  // match the SSR HTML exactly (no cards→skeleton→cards flicker) — the
  // background refresh in `EventsListIsland.useEffect` still fires to
  // catch admin edits made between build and visit.
  let initialEvents: unknown = undefined;
  const payloadAttr = el.getAttribute('data-events-payload');
  if (payloadAttr) {
    try {
      const parsed = JSON.parse(payloadAttr);
      if (Array.isArray(parsed)) initialEvents = parsed;
    } catch {
      initialEvents = undefined;
    }
  }
  const { mountEventsListIsland } = await import('@/components/kychon/EventsListIsland');
  mountEventsListIsland(el, {
    config: cfg,
    headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
    initialEvents: initialEvents as undefined,
  });
  el.dataset.hydrated = 'true';
}

export async function hydrateSignInBar(
  el: HTMLElement,
  section: Section,
  _ctx: BlockRenderContext,
): Promise<void> {
  if (!isHydrateHost(el, 'sign_in_bar')) return;
  const { mountSignInBarIsland } = await import('@/components/kychon/SignInBarIsland');
  mountSignInBarIsland(el, {
    showLangToggle: section.config.show_lang_toggle !== false,
    showThemeToggle: section.config.show_theme_toggle !== false,
  });
}
