// admin.js — Admin dashboard logic

import { count, get, patch } from './api.js?v=6';
import { requireAdmin } from './auth.js?v=6';
import { isFeatureEnabled } from './config.js?v=6';

export async function initDashboard() {
  if (!requireAdmin()) return;

  // Load stats
  const statPromises = [
    count('members?status=eq.active').catch(() => 0),
    count('members?status=eq.pending').catch(() => 0),
    count('announcements').catch(() => 0),
    count(`members?status=eq.active&expires_at=lt.${thirtyDaysFromNow()}`).catch(() => 0),
  ];
  if (isFeatureEnabled('feature_events'))
    statPromises.push(count(`events?starts_at=gte.${new Date().toISOString()}`).catch(() => 0));
  if (isFeatureEnabled('feature_resources')) statPromises.push(count('resources').catch(() => 0));
  if (isFeatureEnabled('feature_forum')) statPromises.push(count('forum_topics').catch(() => 0));

  const stats = await Promise.all(statPromises);
  setText('stat-active', stats[0]);
  setText('stat-pending', stats[1]);
  setText('stat-announcements', stats[2]);
  setText('stat-expiring', stats[3]);

  // Extra stats
  const extraStats = document.getElementById('extra-stats');
  if (extraStats) {
    let html = '';
    let i = 4;
    if (isFeatureEnabled('feature_events')) {
      html += statCard(stats[i++], 'Upcoming Events');
    }
    if (isFeatureEnabled('feature_resources')) {
      html += statCard(stats[i++], 'Resources');
    }
    if (isFeatureEnabled('feature_forum')) {
      html += statCard(stats[i++], 'Forum Topics');
    }
    extraStats.innerHTML = html;
  }

  // Load activity feed
  try {
    const activities = await get('activity_log?order=created_at.desc&limit=20&select=*,members(display_name)');
    const feed = document.getElementById('activity-feed');
    if (feed && activities.length > 0) {
      feed.innerHTML = activities
        .map(
          (a) => `
        <div class="flex items-center gap-1" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border)">
          <span class="badge badge-primary">${esc(a.action)}</span>
          <span>${esc(a.members?.display_name || 'Unknown')}</span>
          <span class="text-muted text-sm" style="margin-left:auto">${formatDate(a.created_at)}</span>
        </div>`,
        )
        .join('');
    } else if (feed) {
      feed.innerHTML = '<p class="text-muted">No activity yet.</p>';
    }
  } catch {}

  // AI Moderation queue
  if (isFeatureEnabled('feature_ai_moderation')) {
    await loadModerationQueue();
  }
}

async function loadModerationQueue() {
  const container = document.getElementById('moderation-section');
  if (!container) return;
  container.classList.remove('hidden');

  try {
    const flagged = await get('moderation_log?action=eq.flagged&reviewed_by=is.null&order=created_at.desc&limit=10');
    const list = document.getElementById('moderation-list');
    if (!list) return;

    if (flagged.length === 0) {
      list.innerHTML = '<p class="text-muted">No flagged content.</p>';
      return;
    }

    // Load content previews
    const items = [];
    for (const f of flagged) {
      let preview = '';
      if (f.content_type === 'forum_topic') {
        const topics = await get(`forum_topics?id=eq.${f.content_id}&select=title,body&limit=1`);
        preview = topics[0]?.title || `Topic #${f.content_id}`;
      } else if (f.content_type === 'forum_reply') {
        const replies = await get(`forum_replies?id=eq.${f.content_id}&select=body&limit=1`);
        preview = (replies[0]?.body || '').substring(0, 100);
      }
      items.push({ ...f, preview });
    }

    list.innerHTML = items
      .map(
        (i) => `
      <div class="flex items-center gap-1" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border)">
        <div style="flex:1">
          <span class="badge badge-danger">${esc(i.content_type)}</span>
          <span class="text-sm">${esc(i.preview)}</span>
          <div class="text-sm text-muted">Reason: ${esc(i.reason)} (${Math.round(i.confidence * 100)}%)</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-sm btn-primary mod-action" data-id="${i.id}" data-content-type="${i.content_type}" data-content-id="${i.content_id}" data-action="approve">Approve</button>
          <button class="btn btn-sm btn-danger mod-action" data-id="${i.id}" data-content-type="${i.content_type}" data-content-id="${i.content_id}" data-action="reject">Reject</button>
        </div>
      </div>
    `,
      )
      .join('');

    const session = JSON.parse(localStorage.getItem('wl_session') || '{}');
    const memberId = session.user?.member?.id;

    list.querySelectorAll('.mod-action').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'approve') {
          // Unhide the content
          const table = btn.dataset.contentType === 'forum_topic' ? 'forum_topics' : 'forum_replies';
          await patch(`${table}?id=eq.${btn.dataset.contentId}`, { hidden: false });
          await patch(`moderation_log?id=eq.${btn.dataset.id}`, { action: 'approved', reviewed_by: memberId });
        } else {
          await patch(`moderation_log?id=eq.${btn.dataset.id}`, { action: 'hidden', reviewed_by: memberId });
        }
        loadModerationQueue();
      });
    });
  } catch {}
}

function statCard(value, label) {
  return `<div class="card stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function thirtyDaysFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}
