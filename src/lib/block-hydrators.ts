// block-hydrators.ts — Browser-only hydration logic for dynamic blocks.
// Kept separate from blocks.ts so the registry stays import-safe at build time
// (Astro frontmatter runs in Node and shouldn't pull in localStorage/auth).

import type { Section, BlockRenderContext } from './blocks.js';

export async function hydrateAnnouncementsFeed(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="announcements_feed"]') as HTMLElement | null;
  if (!root) return;
  let cfg: Record<string, unknown> = section.config || {};
  try {
    cfg = { ...cfg, ...JSON.parse(root.getAttribute('data-config') || '{}') };
  } catch {}
  const { mountAnnouncementsFeedIsland } = await import('@/components/kychon/AnnouncementsFeedIsland');
  mountAnnouncementsFeedIsland(root, {
    config: cfg,
    role: ctx.role || null,
    pollsEnabled: ctx.isFeatureEnabled?.('feature_polls') !== false,
    headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
  });
  root.dataset.hydrated = 'true';
}

export async function hydrateActivityFeed(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="activity_feed"]') as HTMLElement | null;
  if (!root) return;
  const { mountActivityFeedIsland } = await import('@/components/kychon/ActivityFeedIsland');
  mountActivityFeedIsland(root, {
    limit: Number(section.config?.limit || 15),
    role: ctx.role || null,
  });
}

export async function hydrateSiteSearch(
  el: HTMLElement,
  section: Section,
  _ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="site_search"]') as HTMLElement | null;
  if (!root || root.dataset.hydrated === 'true') return;
  let cfg: any = section.config || {};
  try {
    cfg = { ...cfg, ...JSON.parse(root.getAttribute('data-config') || '{}') };
  } catch {}

  const { mountSiteSearchIsland } = await import('@/components/kychon/SiteSearchIsland');
  mountSiteSearchIsland(root, {
    config: cfg,
    sectionId: String(section.id ?? `pos-${section.position}`),
    zone: section.zone,
  });
  root.dataset.hydrated = 'true';
}

export async function hydrateLinkListResources(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="link_list"]') as HTMLElement | null;
  if (!root) return;
  if (root.dataset.hydrated === 'true') return;
  let cfg: any = {};
  try {
    cfg = JSON.parse(root.getAttribute('data-config') || '{}');
  } catch {
    cfg = {};
  }
  const { mountLinkListIsland } = await import('@/components/kychon/LinkListIsland');
  mountLinkListIsland(root, {
    config: cfg,
    headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
    onEmptyChange(empty) {
      el.hidden = empty;
    },
  });
  root.dataset.hydrated = 'true';
}

// --- Catalog block hydrators ---

export async function hydrateEventsCalendar(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="events_calendar"]') as HTMLElement | null;
  if (!root) return;
  if (root.dataset.hydrated === 'true') return;
  const { initCalendar } = await import('./blocks/events-calendar.js');
  initCalendar(root, section, ctx);
  root.dataset.hydrated = 'true';
}

export async function hydrateEventsList(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="events_list"]') as HTMLElement | null;
  if (!root) return;
  if (root.dataset.hydrated === 'true') return;
  let cfg: any = {};
  try {
    cfg = JSON.parse(root.getAttribute('data-config') || '{}');
  } catch {
    cfg = {};
  }
  const { mountEventsListIsland } = await import('@/components/kychon/EventsListIsland');
  mountEventsListIsland(root, {
    config: cfg,
    headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
  });
  root.dataset.hydrated = 'true';
}

export async function hydrateSignInBar(
  el: HTMLElement,
  section: Section,
  _ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="sign_in_bar"]') as HTMLElement | null;
  if (!root) return;
  const { mountSignInBarIsland } = await import('@/components/kychon/SignInBarIsland');
  mountSignInBarIsland(root, {
    showLangToggle: section.config.show_lang_toggle !== false,
    showThemeToggle: section.config.show_theme_toggle !== false,
  });
}
