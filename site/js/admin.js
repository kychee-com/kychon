// admin.js — Admin dashboard logic

import { get, post, count, patch } from './api.js';
import { requireAdmin } from './auth.js';
import { getConfig, isFeatureEnabled } from './config.js';
import { getAuthHeaders, API } from './api.js';

export async function initDashboard() {
  if (!requireAdmin()) return;

  // Load stats
  const statPromises = [
    count('members?status=eq.active').catch(() => 0),
    count('members?status=eq.pending').catch(() => 0),
    count('announcements').catch(() => 0),
    count('members?status=eq.active&expires_at=lt.' + thirtyDaysFromNow()).catch(() => 0),
  ];
  if (isFeatureEnabled('feature_events')) statPromises.push(count('events?starts_at=gte.' + new Date().toISOString()).catch(() => 0));
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
    if (isFeatureEnabled('feature_events')) { html += statCard(stats[i++], 'Upcoming Events'); }
    if (isFeatureEnabled('feature_resources')) { html += statCard(stats[i++], 'Resources'); }
    if (isFeatureEnabled('feature_forum')) { html += statCard(stats[i++], 'Forum Topics'); }
    extraStats.innerHTML = html;
  }

  // Load activity feed
  try {
    const activities = await get('activity_log?order=created_at.desc&limit=20&select=*,members(display_name)');
    const feed = document.getElementById('activity-feed');
    if (feed && activities.length > 0) {
      feed.innerHTML = activities.map(a => `
        <div class="flex items-center gap-1" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border)">
          <span class="badge badge-primary">${esc(a.action)}</span>
          <span>${esc(a.members?.display_name || 'Unknown')}</span>
          <span class="text-muted text-sm" style="margin-left:auto">${formatDate(a.created_at)}</span>
        </div>`).join('');
    } else if (feed) {
      feed.innerHTML = '<p class="text-muted">No activity yet.</p>';
    }
  } catch {}

  // AI Insights
  if (isFeatureEnabled('feature_ai_insights')) {
    await loadInsights();
  }

  // AI Moderation queue
  if (isFeatureEnabled('feature_ai_moderation')) {
    await loadModerationQueue();
  }

  // Newsletter drafts
  if (isFeatureEnabled('feature_ai_newsletter')) {
    await loadNewsletterDrafts();
  }
}

async function loadInsights() {
  const container = document.getElementById('insights-section');
  if (!container) return;
  container.classList.remove('hidden');

  try {
    const insights = await get('member_insights?status=eq.pending&order=priority.desc,created_at.desc&limit=10&select=*,members(display_name)');
    const list = document.getElementById('insights-list');
    if (!list) return;

    if (insights.length === 0) {
      list.innerHTML = '<p class="text-muted">No pending insights.</p>';
      return;
    }

    list.innerHTML = insights.map(i => `
      <div class="flex items-center gap-1" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border)">
        <span class="badge badge-${i.priority === 'high' ? 'danger' : 'warning'}">${esc(i.insight_type)}</span>
        <div style="flex:1">
          <strong>${esc(i.members?.display_name || 'Member')}</strong>
          <div class="text-sm text-muted">${esc(i.message)}</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-sm btn-primary insight-action" data-id="${i.id}" data-action="actioned">Action</button>
          <button class="btn btn-sm btn-secondary insight-action" data-id="${i.id}" data-action="dismissed">Dismiss</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.insight-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        await patch('member_insights?id=eq.' + btn.dataset.id, { status: btn.dataset.action });
        loadInsights();
      });
    });
  } catch {}
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
        const topics = await get('forum_topics?id=eq.' + f.content_id + '&select=title,body&limit=1');
        preview = topics[0]?.title || 'Topic #' + f.content_id;
      } else if (f.content_type === 'forum_reply') {
        const replies = await get('forum_replies?id=eq.' + f.content_id + '&select=body&limit=1');
        preview = (replies[0]?.body || '').substring(0, 100);
      }
      items.push({ ...f, preview });
    }

    list.innerHTML = items.map(i => `
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
    `).join('');

    const session = JSON.parse(localStorage.getItem('wl_session') || '{}');
    const memberId = session.user?.member?.id;

    list.querySelectorAll('.mod-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'approve') {
          // Unhide the content
          const table = btn.dataset.contentType === 'forum_topic' ? 'forum_topics' : 'forum_replies';
          await patch(table + '?id=eq.' + btn.dataset.contentId, { hidden: false });
          await patch('moderation_log?id=eq.' + btn.dataset.id, { action: 'approved', reviewed_by: memberId });
        } else {
          await patch('moderation_log?id=eq.' + btn.dataset.id, { action: 'hidden', reviewed_by: memberId });
        }
        loadModerationQueue();
      });
    });
  } catch {}
}

// --- Newsletter Drafts ---

let tiptapEditor = null;
let currentDraftId = null;

async function loadNewsletterDrafts() {
  const container = document.getElementById('newsletter-section');
  if (!container) return;
  container.classList.remove('hidden');

  try {
    const drafts = await get('newsletter_drafts?order=created_at.desc&limit=10');
    const list = document.getElementById('newsletter-list');
    if (!list) return;

    if (drafts.length === 0) {
      list.innerHTML = '<p class="text-muted">No newsletter drafts yet. Drafts are generated weekly on Mondays.</p>';
      return;
    }

    list.innerHTML = drafts.map(d => `
      <div class="flex items-center gap-1" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border)">
        <div style="flex:1">
          <strong>${esc(d.subject)}</strong>
          <div class="text-sm text-muted">${formatDate(d.period_start)} — ${formatDate(d.period_end)}</div>
        </div>
        <span class="badge badge-${d.status === 'sent' ? 'primary' : 'warning'}">${esc(d.status)}</span>
        ${d.status !== 'sent' ? `<button class="btn btn-sm btn-primary newsletter-edit" data-id="${d.id}">Edit</button>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.newsletter-edit').forEach(btn => {
      btn.addEventListener('click', () => openNewsletterEditor(btn.dataset.id));
    });
  } catch {}
}

async function openNewsletterEditor(draftId) {
  currentDraftId = draftId;
  const drafts = await get('newsletter_drafts?id=eq.' + draftId);
  if (!drafts.length) return;
  const draft = drafts[0];

  document.getElementById('newsletter-list').classList.add('hidden');
  const editorSection = document.getElementById('newsletter-editor');
  editorSection.classList.remove('hidden');
  document.getElementById('newsletter-subject').value = draft.subject;

  const bodyEl = document.getElementById('newsletter-body');

  // Load Tiptap for rich editing
  try {
    const core = await import('https://esm.sh/@tiptap/core@2');
    const starter = await import('https://esm.sh/@tiptap/starter-kit@2');
    const Editor = core.Editor;
    const StarterKit = starter.default || starter.StarterKit;

    if (tiptapEditor) tiptapEditor.destroy();
    tiptapEditor = new Editor({
      element: bodyEl,
      extensions: [StarterKit],
      content: draft.body,
    });
  } catch (e) {
    // Fallback to plain HTML editing
    bodyEl.contentEditable = 'true';
    bodyEl.innerHTML = draft.body;
  }

  // Wire buttons
  document.getElementById('newsletter-send').onclick = async () => {
    const body = tiptapEditor ? tiptapEditor.getHTML() : bodyEl.innerHTML;
    const subject = document.getElementById('newsletter-subject').value;
    await patch('newsletter_drafts?id=eq.' + draftId, {
      subject,
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
    closeNewsletterEditor();
    loadNewsletterDrafts();
  };

  document.getElementById('newsletter-regenerate').onclick = async () => {
    const btn = document.getElementById('newsletter-regenerate');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    try {
      const res = await fetch(API + '/functions/v1/ai-content', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        closeNewsletterEditor();
        loadNewsletterDrafts();
      }
    } catch (e) {
      console.error('Regenerate failed:', e);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Regenerate';
    }
  };

  document.getElementById('newsletter-back').onclick = () => {
    closeNewsletterEditor();
  };
}

function closeNewsletterEditor() {
  if (tiptapEditor) {
    tiptapEditor.destroy();
    tiptapEditor = null;
  }
  currentDraftId = null;
  document.getElementById('newsletter-editor').classList.add('hidden');
  document.getElementById('newsletter-list').classList.remove('hidden');
  document.getElementById('newsletter-body').innerHTML = '';
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
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}
