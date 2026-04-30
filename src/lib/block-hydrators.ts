// block-hydrators.ts — Browser-only hydration logic for dynamic blocks.
// Kept separate from blocks.ts so the registry stays import-safe at build time
// (Astro frontmatter runs in Node and shouldn't pull in localStorage/auth).

import type { Section, BlockRenderContext } from './blocks';

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

export async function hydrateAnnouncementsFeed(
  el: HTMLElement,
  section: Section,
  ctx: BlockRenderContext,
): Promise<void> {
  const [{ get, patch, post, del }, { getSession }, { translateItems, isFeatureEnabled }, pollUI] = await Promise.all([
    import('./api'),
    import('./auth'),
    import('./config'),
    import('./poll-ui'),
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
        feed.innerHTML = '<p class="text-muted">No announcements yet.</p>';
        return;
      }
      const session = getSession();
      const memberId = session?.user?.member?.id ?? null;
      const pollsEnabled = isFeatureEnabled('feature_polls');

      const attachedPolls: Record<number, any> = {};
      if (pollsEnabled) {
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
      feed.innerHTML = '<p class="text-muted">Could not load announcements.</p>';
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
  _ctx: BlockRenderContext,
): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="activity_feed"]') as HTMLElement | null;
  if (!root) return;
  const feed = root.querySelector('#activity-feed') as HTMLElement | null;
  if (!feed) return;

  const { get } = await import('./api');
  const cfg = section.config || {};
  const limit = cfg.limit || 15;

  try {
    const entries = await get(`activity_log?order=created_at.desc&limit=${limit}`);
    if (entries.length === 0) {
      feed.innerHTML = '<p class="text-muted">No recent activity yet.</p>';
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
    feed.innerHTML = '<p class="text-muted">Could not load activity.</p>';
  }
}

export async function hydrateSignInBar(el: HTMLElement, ctx: BlockRenderContext): Promise<void> {
  const root = el.querySelector('[data-block-hydrate="sign_in_bar"]') as HTMLElement | null;
  if (!root) return;
  const [{ getSession }, i18n, { t }] = await Promise.all([
    import('./auth'),
    import('./i18n'),
    import('./i18n'),
  ]);
  const { getAvailableLocales, getLocale, setLanguage } = i18n;
  const session = getSession();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const locales = getAvailableLocales();
  const currentLocale = getLocale();
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
  const langBtn = locales.length >= 2
    ? `<button class="btn btn-sm btn-secondary" id="lang-toggle" aria-label="Switch language">${LANG_LABELS[currentLocale] || currentLocale.toUpperCase()}</button>`
    : '';
  const themeBtn = `<button class="btn btn-sm btn-secondary" id="theme-toggle" aria-label="Toggle dark mode">${isDark ? '☀️' : '🌙'}</button>`;
  if (!session) {
    root.innerHTML = `${langBtn}${themeBtn}<button class="btn btn-primary btn-sm" id="login-btn">${t('nav.sign_in')}</button>`;
  } else {
    const user = session.user || {};
    const avatar = user.avatar_url
      ? `<img class="nav-avatar" src="${esc(user.avatar_url)}" alt="" width="32" height="32">`
      : `<div class="nav-avatar" style="background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:0.875rem">${(user.display_name || user.email || '?')[0].toUpperCase()}</div>`;
    root.innerHTML = `${langBtn}${themeBtn}<a href="/profile.html" class="nav-link">${avatar}</a><button class="btn btn-sm btn-secondary" id="logout-btn">Sign Out</button>`;
  }
  document.getElementById('login-btn')?.addEventListener('click', () => {
    document.getElementById('auth-modal')?.classList.remove('hidden');
  });
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('wl_session');
    window.location.href = '/';
  });
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = dark ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('wl_theme', next);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  });
  if (locales.length >= 2) {
    document.getElementById('lang-toggle')?.addEventListener('click', async () => {
      const idx = locales.indexOf(currentLocale);
      const next = locales[(idx + 1) % locales.length];
      await setLanguage(next);
      document.dispatchEvent(new CustomEvent('wl-locale-changed', { detail: { locale: next } }));
    });
  }
}
