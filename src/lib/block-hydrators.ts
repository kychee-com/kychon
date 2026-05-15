// block-hydrators.ts — Browser-only hydration logic for dynamic blocks.
// Kept separate from blocks.ts so the registry stays import-safe at build time
// (Astro frontmatter runs in Node and shouldn't pull in localStorage/auth).

import type { Section, BlockRenderContext } from './blocks.js';
import { del, get, patch, post } from './api.js';
import { getSession } from './auth.js';
import { escAttr, escHtml, safeCssUrl } from './blocks.js';
import { isFeatureEnabled, siteConfig, translateItems } from './config.js';
import { formatEventDateTime } from './event-display.js';
import { sanitizeRichHtml } from './sanitize-html.js';

// `esc()` is intentionally an alias for escAttr — every call site in this
// module interpolates into a double-quoted attribute or HTML text, both of
// which require the quote-escaping that escAttr provides. The previous
// `textContent → innerHTML` helper left " and ' alone, which let attacker
// content break out of attribute context (#23).
const esc = escAttr;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function canReadMemberOnlyCapabilities(session: any, role: string | null | undefined): boolean {
  const member = session?.user?.member;
  return (
    role === 'admin' ||
    role === 'member' ||
    member?.status === 'active' ||
    (!member?.status && !!member?.id) ||
    !!session?.access_token
  );
}

export async function hydrateAnnouncementsFeed(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  const pollUI = await import('./poll-ui.js');
  const { fetchAttachedPoll, bindPollVoteListeners, createPollForm } = pollUI;

  const root = el.querySelector('[data-block-hydrate="announcements_feed"]') as HTMLElement | null;
  if (!root) return;
  const feed = root.querySelector('#announcements-feed') as HTMLElement | null;
  if (!feed) return;

  const cfg = section.config || {};
  const limit = cfg.limit || 20;

  async function render() {
    if (!feed) return;
    try {
      const items = await get(`announcements?order=is_pinned.desc,created_at.desc&limit=${limit}`);
      await translateItems('announcement', items, ['title', 'body']);
      if (items.length === 0) {
        feed.innerHTML = '<p class="ky-text-muted">No announcements yet.</p>';
        return;
      }
      const session = getSession();
      const memberId = session?.user?.member?.id ?? null;
      const pollsEnabled = isFeatureEnabled('feature_polls');
      const canReadPolls = canReadMemberOnlyCapabilities(session, ctx.role);

      const attachedPolls: Record<number, any> = {};
      if (pollsEnabled && canReadPolls) {
        for (const a of items) {
          try {
            const result = await fetchAttachedPoll('announcement', a.id, session);
            if (result) attachedPolls[a.id] = result;
          } catch (e) {
            console.warn(`Failed to fetch poll for announcement ${a.id}:`, e);
          }
        }
      }

      feed.innerHTML = items
        .map((a: any) => {
          const pollHtml = attachedPolls[a.id]
            ? `<div data-ann-poll="${a.id}">${attachedPolls[a.id].html}</div>`
            : '';
          return `
        <div class="announcement card mb-1 ${a.is_pinned ? 'pinned' : ''}" data-id="${a.id}">
          <div class="announcement-title" data-editable="announcements.${a.id}.title">${escHtml(a.title)}</div>
          <div class="announcement-body" data-editable-rich="announcements.${a.id}.body">${sanitizeRichHtml(a.body)}</div>
          ${pollHtml}
          <div class="announcement-meta">${a.is_pinned ? '<span class="badge badge-primary">Pinned</span> ' : ''}<span>${formatDate(a.created_at)}</span></div>
          ${ctx.role === 'admin' ? `<div class="mt-1 flex gap-1"><button class="btn btn-sm btn-secondary ann-pin" data-id="${a.id}" data-pinned="${a.is_pinned}">${a.is_pinned ? 'Unpin' : 'Pin'}</button><button class="btn btn-sm btn-danger ann-delete" data-id="${a.id}">Delete</button></div>` : ''}
        </div>`;
        })
        .join('');

      for (const [annId, pollData] of Object.entries(attachedPolls)) {
        const container = feed.querySelector(`[data-ann-poll="${annId}"]`) as HTMLElement;
        if (container) {
          bindPollVoteListeners(
            container,
            (pollData as any).poll,
            (pollData as any).votes,
            memberId,
            () => render(),
          );
        }
      }

      feed.querySelectorAll('.ann-pin').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const elBtn = btn as HTMLElement;
          await patch(`announcements?id=eq.${elBtn.dataset.id}`, {
            is_pinned: elBtn.dataset.pinned !== 'true',
          });
          render();
        });
      });
      feed.querySelectorAll('.ann-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const annId = (btn as HTMLElement).dataset.id!;
          try {
            await del(`polls?attached_to=eq.announcement&attached_id=eq.${annId}`);
          } catch (e) {
            console.warn('Failed to delete attached poll:', e);
          }
          await del(`announcements?id=eq.${annId}`);
          render();
        });
      });
    } catch {
      feed.innerHTML = '<p class="ky-text-muted">Could not load announcements.</p>';
    }
  }

  await render();

  // Admin: announcement creation form
  if (ctx.role === 'admin') {
    const createEl = root.querySelector('#announcement-create') as HTMLElement | null;
    if (createEl) {
      createEl.classList.remove('hidden');
      const pollsEnabled = isFeatureEnabled('feature_polls');
      createEl.innerHTML = `<div class="card"><h4 class="mb-1">New Announcement</h4><div class="form-group"><input class="form-input" id="ann-title" placeholder="Title"></div><div class="form-group"><textarea class="form-textarea" id="ann-body" placeholder="Write your announcement..."></textarea></div>${pollsEnabled ? '<div id="ann-poll-form-container"></div><button class="btn btn-sm btn-secondary mb-1" id="ann-add-poll" type="button">+ Add Poll</button>' : ''}<button class="btn btn-primary" id="ann-post">Post</button></div>`;

      let annPollFormRef: ReturnType<typeof createPollForm> | null = null;
      if (pollsEnabled) {
        document.getElementById('ann-add-poll')?.addEventListener('click', () => {
          const formContainer = document.getElementById('ann-poll-form-container')!;
          if (annPollFormRef) return;
          annPollFormRef = createPollForm(formContainer);
          document.getElementById('ann-add-poll')!.classList.add('hidden');
          const observer = new MutationObserver(() => {
            if (formContainer.innerHTML === '') {
              annPollFormRef = null;
              document.getElementById('ann-add-poll')?.classList.remove('hidden');
              observer.disconnect();
            }
          });
          observer.observe(formContainer, { childList: true });
        });
      }

      document.getElementById('ann-post')?.addEventListener('click', async () => {
        const title = (document.getElementById('ann-title') as HTMLInputElement).value.trim();
        const body = (document.getElementById('ann-body') as HTMLTextAreaElement).value.trim();
        if (!title || !body) return;
        const pollData = annPollFormRef?.getPollData() || null;
        await post('announcements', { title, body, ...(pollData ? { poll: pollData } : {}) });
        annPollFormRef = null;
        (document.getElementById('ann-title') as HTMLInputElement).value = '';
        (document.getElementById('ann-body') as HTMLTextAreaElement).value = '';
        const formContainer = document.getElementById('ann-poll-form-container');
        if (formContainer) formContainer.innerHTML = '';
        document.getElementById('ann-add-poll')?.classList.remove('hidden');
        render();
      });
    }
  }
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

const EVENTS_LIST_FILTER_DAYS = 7;

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
  _section: Section,
  _ctx: BlockRenderContext,
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
  const layout = cfg.layout || 'sidebar';
  const count = Math.max(1, Math.min(50, Number(cfg.count) || 4));
  const filter = cfg.filter || 'upcoming';
  const showImage = cfg.show_image !== false && cfg.show_image === true;
  const showLocation = cfg.show_location !== false;
  const showTime = cfg.show_time !== false;

  const nowIso = new Date().toISOString();
  let query: string;
  if (filter === 'past') {
    query = `events?starts_at=lt.${nowIso}&order=starts_at.desc&limit=${count}`;
  } else if (filter === 'this_week') {
    const inAWeek = new Date(Date.now() + EVENTS_LIST_FILTER_DAYS * 86400 * 1000).toISOString();
    // PostgREST concatenates duplicate column filters; use and=(...) so both
    // bounds AND-combine instead of overwriting.
    query = `events?and=(starts_at.gte.${nowIso},starts_at.lt.${inAWeek})&order=starts_at.asc&limit=${count}`;
  } else {
    query = `events?starts_at=gte.${nowIso}&order=starts_at.asc&limit=${count}`;
  }

  let events: any[] = [];
  try {
    events = await get(query);
  } catch (e) {
    console.warn('events_list hydrate failed:', e);
    events = [];
  }

  const skeleton = root.querySelector('.block-events-list__skeleton');
  if (skeleton) skeleton.remove();

  if (!events.length) {
    const empty = document.createElement('p');
    empty.className = 'ky-text-muted block-events-list__empty';
    empty.textContent = 'No upcoming events.';
    root.appendChild(empty);
    root.dataset.hydrated = 'true';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = `block-events-list__items block-events-list__items--${esc(layout)}`;
  wrap.innerHTML = events
    .map((evt: any) => renderEventCard(evt, layout, { showImage, showLocation, showTime }))
    .join('');
  root.appendChild(wrap);
  root.dataset.hydrated = 'true';
}

function renderEventCard(
  evt: any,
  layout: string,
  opts: { showImage: boolean; showLocation: boolean; showTime: boolean },
): string {
  const title = esc(evt.title || 'Untitled event');
  const dateTime = formatEventDateTime(evt, undefined, siteConfig, { dateStyle: 'card' });
  const dateLabel = dateTime.dateLabel;
  const timeLabel = opts.showTime ? dateTime.timeRangeLabel : '';
  const location = opts.showLocation && evt.location ? esc(evt.location) : '';
  const href = evt.id ? `/event?id=${encodeURIComponent(evt.id)}` : '/events';
  const imageUrl = evt.image_url || evt.cover_image_url || '';
  const safeImageUrl = imageUrl ? safeCssUrl(imageUrl) : '';
  const imageHtml =
    opts.showImage && safeImageUrl
      ? `<div class="event-card__image" style="background-image:url('${safeImageUrl}')"></div>`
      : '';
  const dateBlock = dateLabel
    ? `<div class="event-card__date"><span class="event-card__date-day">${esc(dateLabel)}</span>${timeLabel ? `<span class="event-card__date-time">${esc(timeLabel)}</span>` : ''}</div>`
    : '';
  const locationBlock = location ? `<div class="event-card__location">${location}</div>` : '';
  const body = `<div class="event-card__body"><h3 class="event-card__title">${title}</h3>${locationBlock}</div>`;
  if (layout === 'list') {
    return `<a href="${esc(href)}" class="event-card event-card--list">${dateBlock}${body}</a>`;
  }
  if (layout === 'grid') {
    return `<a href="${esc(href)}" class="event-card event-card--grid">${imageHtml}${dateBlock}${body}</a>`;
  }
  // sidebar (default)
  return `<a href="${esc(href)}" class="event-card event-card--sidebar">${dateBlock}${body}</a>`;
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
