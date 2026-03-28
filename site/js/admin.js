// admin.js — Admin dashboard logic

import { get, count } from './api.js';
import { requireAdmin } from './auth.js';

export async function initDashboard() {
  if (!requireAdmin()) return;

  // Load stats
  const [activeCount, pendingCount, annCount, expiringCount] = await Promise.all([
    count('members?status=eq.active').catch(() => 0),
    count('members?status=eq.pending').catch(() => 0),
    count('announcements').catch(() => 0),
    count('members?status=eq.active&expires_at=lt.' + thirtyDaysFromNow()).catch(() => 0),
  ]);

  setText('stat-active', activeCount);
  setText('stat-pending', pendingCount);
  setText('stat-announcements', annCount);
  setText('stat-expiring', expiringCount);

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
