// block-hydrators.ts — Browser-only hydration logic for dynamic blocks.
// Kept separate from blocks.ts so the registry stays import-safe at build time
// (Astro frontmatter runs in Node and shouldn't pull in localStorage/auth).

import type { Section, BlockRenderContext } from './blocks.js';
import { siteConfig } from './config.js';
import { formatEventDateTime } from './event-display.js';

function esc(s: any): string {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const [{ get, patch, post, del }, { getSession }, { translateItems, isFeatureEnabled }, pollUI] = await Promise.all([
    import('./api.js'),
    import('./auth.js'),
    import('./config.js'),
    import('./poll-ui.js'),
  ]);
  const { fetchAttachedPoll, bindPollVoteListeners, createPollForm, submitPoll } = pollUI;

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
          <div class="announcement-title" data-editable="announcements.${a.id}.title">${esc(a.title)}</div>
          <div class="announcement-body" data-editable-rich="announcements.${a.id}.body">${a.body}</div>
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
        const session = getSession();
        const memberId = session?.user?.member?.id;
        if (!memberId) return;
        const [created] = await post('announcements', { title, body, author_id: memberId });
        if (annPollFormRef) {
          const pollData = annPollFormRef.getPollData();
          if (pollData) {
            try {
              await submitPoll(pollData, memberId, { type: 'announcement', id: created.id });
            } catch (e) {
              console.error('Failed to create attached poll:', e);
            }
          }
          annPollFormRef = null;
        }
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
  const feed = root.querySelector('#activity-feed') as HTMLElement | null;
  if (!feed) return;

  const [{ get }, { getSession }] = await Promise.all([import('./api.js'), import('./auth.js')]);
  const cfg = section.config || {};
  const limit = cfg.limit || 15;
  const session = getSession();

  if (!canReadMemberOnlyCapabilities(session, ctx.role)) {
    feed.innerHTML = '<p class="ky-text-muted">Sign in as a member to see recent activity.</p>';
    return;
  }

  try {
    const entries = await get(`activity_log?order=created_at.desc&limit=${limit}`);
    if (entries.length === 0) {
      feed.innerHTML = '<p class="ky-text-muted">No recent activity yet.</p>';
      return;
    }
    const memberIds = [...new Set(entries.map((e: any) => e.member_id).filter(Boolean))];
    const membersMap: Record<number, any> = {};
    if (memberIds.length > 0) {
      const members = await get(`members?id=in.(${memberIds.join(',')})`);
      for (const m of members) membersMap[m.id] = m;
    }
    feed.innerHTML = entries
      .map((e: any) => {
        const member = membersMap[e.member_id];
        const name = member ? member.display_name : 'Former member';
        const avatar = member?.avatar_url
          ? `<img class="activity-avatar" src="${esc(member.avatar_url)}" alt="">`
          : `<div class="activity-avatar activity-avatar-fallback">${(name[0] || '?').toUpperCase()}</div>`;
        return `<div class="activity-entry">${avatar}<div class="activity-entry-content"><div class="activity-entry-text"><strong>${esc(name)}</strong> was active</div><div class="activity-entry-time">${timeAgo(e.created_at)}</div></div></div>`;
      })
      .join('');
  } catch {
    feed.innerHTML = '<p class="ky-text-muted">Could not load activity.</p>';
  }
}

export async function hydrateSiteSearch(
  el: HTMLElement,
  section: Section,
  _ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="site_search"]') as HTMLElement | null;
  if (!root || root.dataset.hydrated === 'true') return;

  const form = root.querySelector('form') as HTMLFormElement | null;
  const input = root.querySelector('input[name="q"]') as HTMLInputElement | null;
  const typeInput = root.querySelector('input[name="type"]') as HTMLInputElement | null;
  const list = root.querySelector('[role="listbox"]') as HTMLElement | null;
  if (!form || !input || !typeInput || !list) return;
  const formEl = form;
  const inputEl = input;
  const typeInputEl = typeInput;
  const listEl = list;

  let cfg: any = section.config || {};
  try {
    cfg = { ...cfg, ...JSON.parse(root.getAttribute('data-config') || '{}') };
  } catch {}
  const minChars = Math.max(2, Number(cfg.min_chars) || 2);
  const defaultType = ['all', 'pages', 'resources', 'events'].includes(cfg.default_type)
    ? cfg.default_type
    : 'all';
  typeInputEl.value = defaultType;

  const { searchSite } = await import('./api.js');
  let timer: number | undefined;
  let requestSeq = 0;
  let activeIndex = -1;

  function closeSuggestions() {
    listEl.hidden = true;
    listEl.innerHTML = '';
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function setActive(next: number) {
    const options = Array.from(listEl.querySelectorAll<HTMLElement>('[role="option"]'));
    if (!options.length) {
      activeIndex = -1;
      return;
    }
    activeIndex = (next + options.length) % options.length;
    options.forEach((opt, i) => {
      const active = i === activeIndex;
      opt.classList.toggle('is-active', active);
      opt.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const activeOption = options[activeIndex];
    if (activeOption) {
      inputEl.setAttribute('aria-activedescendant', activeOption.id);
    }
  }

  function renderSuggestions(results: any[]) {
    if (!results.length) {
      closeSuggestions();
      return;
    }
    const typeLabel: Record<string, string> = { page: 'Page', resource: 'Resource', event: 'Event' };
    listEl.innerHTML = results
      .slice(0, 5)
      .map((result, i) => {
        const id = `${inputEl.id}-option-${i}`;
        return `<a id="${esc(id)}" class="site-search__option" role="option" aria-selected="false" href="${esc(result.url)}"><span>${esc(result.title)}</span><small>${esc(typeLabel[result.type] || result.type)}</small></a>`;
      })
      .join('');
    listEl.hidden = false;
    inputEl.setAttribute('aria-expanded', 'true');
    activeIndex = -1;
  }

  async function fetchSuggestions(query: string) {
    const seq = ++requestSeq;
    try {
      const data = await searchSite({ q: query, type: typeInputEl.value || defaultType, suggest: true });
      if (seq !== requestSeq || inputEl.value.trim() !== query) return;
      renderSuggestions(data.results || []);
    } catch {
      closeSuggestions();
    }
  }

  inputEl.addEventListener('input', () => {
    window.clearTimeout(timer);
    const query = inputEl.value.trim();
    if (query.length < minChars) {
      requestSeq += 1;
      closeSuggestions();
      return;
    }
    timer = window.setTimeout(() => fetchSuggestions(query), 200);
  });

  inputEl.addEventListener('keydown', (event) => {
    if (listEl.hidden) return;
    const options = Array.from(listEl.querySelectorAll<HTMLAnchorElement>('[role="option"]'));
    if (!options.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      options[activeIndex]?.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSuggestions();
      inputEl.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target as Node)) closeSuggestions();
  });

  formEl.addEventListener('submit', () => {
    requestSeq += 1;
    closeSuggestions();
  });

  root.dataset.hydrated = 'true';
}

// --- Catalog block hydrators ---

const ALLOWED_LINK_LIST_ORDER = new Set(['newest', 'oldest', 'title']);

export async function hydrateLinkListResources(
  el: HTMLElement,
  _section: Section,
  _ctx: BlockRenderContext,
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
  const filter = cfg.filter || {};
  const layout = cfg.layout || 'bullets';
  const category = String(filter.category || '').trim();
  const limit = Math.max(1, Math.min(50, Number(filter.limit) || 6));
  const order = ALLOWED_LINK_LIST_ORDER.has(filter.order) ? filter.order : 'newest';
  const orderParam =
    order === 'title'
      ? 'title.asc'
      : order === 'oldest'
        ? 'created_at.asc'
        : 'created_at.desc';

  const { get } = await import('./api.js');
  let items: any[] = [];
  try {
    const params: string[] = [];
    if (category) params.push(`category=eq.${encodeURIComponent(category)}`);
    params.push(`order=${orderParam}`);
    params.push(`limit=${limit}`);
    items = await get(`resources?${params.join('&')}`);
  } catch (e) {
    console.warn('link_list hydrate failed:', e);
    items = [];
  }

  if (!items.length) {
    // Hide the entire section.
    const wrapper = el as HTMLElement;
    wrapper.style.display = 'none';
    root.dataset.hydrated = 'true';
    return;
  }

  const skeleton = root.querySelector('.block-link-list__skeleton');
  if (skeleton) skeleton.remove();
  const list = document.createElement('ul');
  list.className = 'block-link-list__list';
  list.innerHTML = items
    .map((r: any) => {
      const url = r.file_url || r.url || '';
      const fileType = (r.file_type || '').toLowerCase();
      const date = r.created_at ? formatDate(r.created_at) : '';
      const isPdf =
        fileType === 'pdf' || (typeof url === 'string' && /\.pdf(\?|$)/i.test(url));
      const isExternal = /^https?:\/\//i.test(url) && !url.startsWith(location.origin);
      const badge = isPdf ? 'PDF' : r.is_members_only ? 'MEMBERS' : '';
      const externalAttrs = isExternal
        ? ` target="_blank" rel="noopener noreferrer"`
        : '';
      const externalIcon = isExternal
        ? `<span class="block-link-list__ext" aria-hidden="true">↗</span>`
        : '';
      const badgeHtml = badge
        ? `<span class="block-link-list__badge block-link-list__badge--${esc(badge.toLowerCase())}">${esc(badge)}</span>`
        : '';
      const showDate = (layout === 'rows' || layout === 'compact') && date;
      const dateHtml = showDate ? `<span class="block-link-list__date">${esc(date)}</span>` : '';
      const label = `<span class="block-link-list__label">${esc(r.title || url)}</span>`;
      return `<li class="block-link-list__item"><a href="${esc(url || '#')}" class="block-link-list__link"${externalAttrs}>${dateHtml}${badgeHtml}${label}${externalIcon}</a></li>`;
    })
    .join('');
  root.appendChild(list);
  root.dataset.hydrated = 'true';
}

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

  const { get } = await import('./api.js');
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
  const href = evt.id ? `/event.html?id=${encodeURIComponent(evt.id)}` : '/events.html';
  const imageUrl = evt.image_url || evt.cover_image_url || '';
  const imageHtml =
    opts.showImage && imageUrl
      ? `<div class="event-card__image" style="background-image:url(${esc(imageUrl)})"></div>`
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
  const [{ getSession }, i18n, { t }] = await Promise.all([
    import('./auth.js'),
    import('./i18n.js'),
    import('./i18n.js'),
  ]);
  const { getAvailableLocales, getLocale, setLanguage } = i18n;
  const session = getSession();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const locales = getAvailableLocales();
  const currentLocale = getLocale();
  const showLangToggle = section.config.show_lang_toggle !== false;
  const showThemeToggle = section.config.show_theme_toggle !== false;
  const LANG_LABELS: Record<string, string> = {
    en: 'EN',
    es: 'ES',
    pt: 'PT',
    fr: 'FR',
    de: 'DE',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
  };
  const langBtn = showLangToggle && locales.length >= 2
    ? `<button class="btn btn-sm btn-secondary" id="lang-toggle" aria-label="Switch language">${LANG_LABELS[currentLocale] || currentLocale.toUpperCase()}</button>`
    : '';
  const themeBtn = showThemeToggle
    ? `<button class="btn btn-sm btn-secondary" id="theme-toggle" aria-label="Toggle dark mode">${isDark ? '☀️' : '🌙'}</button>`
    : '';
  if (!session) {
    root.innerHTML = `${langBtn}${themeBtn}<button class="btn btn-primary btn-sm" id="login-btn">${t('nav.sign_in')}</button>`;
  } else {
    const user = session.user || {};
    const avatar = user.avatar_url
      ? `<img class="nav-avatar" src="${esc(user.avatar_url)}" alt="" width="32" height="32">`
      : `<div class="nav-avatar" style="background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:0.875rem">${(user.display_name || user.email || '?')[0].toUpperCase()}</div>`;
    root.innerHTML = `${langBtn}${themeBtn}<a href="/profile.html" class="nav-link">${avatar}</a><button class="btn btn-sm btn-secondary" id="logout-btn">Sign Out</button>`;
  }
  document.getElementById('login-btn')?.addEventListener('click', (event) => {
    const trigger = event.currentTarget as HTMLElement;
    void import('./auth-modal-events.js').then(({ openAuthModal }) => {
      openAuthModal({ trigger });
    });
  });
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('wl_session');
    window.location.href = '/';
  });
  if (showThemeToggle) {
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = dark ? 'light' : 'dark';
      if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('wl_theme', next);
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }
  if (showLangToggle && locales.length >= 2) {
    document.getElementById('lang-toggle')?.addEventListener('click', async () => {
      const idx = locales.indexOf(currentLocale);
      const next = locales[(idx + 1) % locales.length];
      if (!next) return;
      await setLanguage(next);
      document.dispatchEvent(new CustomEvent('wl-locale-changed', { detail: { locale: next } }));
    });
  }
}
