// forum.js — Forum categories, topics, and replies

import { del, get, patch, post } from './api.js?v=5';
import { getSession, isAdmin, isAuthenticated } from './auth.js?v=5';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export async function initForum() {
  const params = new URLSearchParams(window.location.search);
  const root = document.getElementById('forum-root');
  if (!root) return;

  if (params.has('topic')) {
    await renderTopicView(root, params.get('topic'));
  } else if (params.has('cat')) {
    await renderTopicListing(root, params.get('cat'));
  } else {
    await renderCategoryListing(root);
  }
}

// ── Category Listing ────────────────────────────────────────────────────────

async function renderCategoryListing(root) {
  let categories = [];
  try {
    categories = await get('forum_categories?order=position.asc');
  } catch (e) {
    console.warn('Failed to load forum categories:', e);
    root.innerHTML = '<p class="text-muted">Could not load forum categories.</p>';
    return;
  }

  // Count topics per category
  const counts = {};
  try {
    const topics = await get('forum_topics?select=category_id');
    for (const t of topics) {
      counts[t.category_id] = (counts[t.category_id] || 0) + 1;
    }
  } catch (e) {
    console.warn('Failed to count topics:', e);
  }

  let html = '<h2 class="mb-2">Forum</h2>';

  if (categories.length === 0) {
    html += '<p class="text-muted">No categories yet.</p>';
    root.innerHTML = html;
    return;
  }

  html += '<div class="card-grid">';
  for (const cat of categories) {
    const color = cat.color || 'var(--color-primary)';
    const count = counts[cat.id] || 0;
    html += `
      <a href="?cat=${esc(cat.id)}" class="card forum-category" style="border-left-color:${esc(color)}">
        <div class="forum-category-name">${esc(cat.name)}</div>
        ${cat.description ? `<div class="forum-category-desc">${esc(cat.description)}</div>` : ''}
        <div class="forum-category-count">${count} topic${count !== 1 ? 's' : ''}</div>
      </a>`;
  }
  html += '</div>';
  root.innerHTML = html;
}

// ── Topic Listing ───────────────────────────────────────────────────────────

async function renderTopicListing(root, categoryId) {
  // Load category info
  let category = null;
  try {
    const cats = await get(`forum_categories?id=eq.${categoryId}`);
    category = cats[0] || null;
  } catch (e) {
    console.warn('Failed to load category:', e);
  }

  // Build query: admin sees hidden topics too
  let query = `forum_topics?category_id=eq.${categoryId}`;
  if (!isAdmin()) {
    query += '&hidden=eq.false';
  }
  query += '&order=is_pinned.desc,last_reply_at.desc.nullslast';

  let topics = [];
  try {
    topics = await get(query);
  } catch (e) {
    console.warn('Failed to load topics:', e);
    root.innerHTML = '<p class="text-muted">Could not load topics.</p>';
    return;
  }

  const catName = category ? esc(category.name) : 'Category';

  let html = `
    <div class="forum-breadcrumb"><a href="forum.html">Forum</a> / ${catName}</div>
    <div class="flex justify-between items-center mb-2">
      <h2>${catName}</h2>
    </div>`;

  if (topics.length === 0) {
    html += '<p class="text-muted">No topics yet. Be the first to start a discussion!</p>';
  } else {
    html += '<div class="card" style="padding:0;overflow:hidden">';
    for (const t of topics) {
      const pinnedClass = t.is_pinned ? ' pinned' : '';
      const hiddenClass = t.hidden ? ' hidden-topic' : '';
      html += `
        <a href="?topic=${esc(t.id)}" class="forum-topic-row${pinnedClass}${hiddenClass}" style="text-decoration:none;color:inherit">
          <div class="forum-topic-info">
            <div class="forum-topic-title">
              ${t.is_pinned ? '<span class="badge badge-primary" style="margin-right:0.375rem">Pinned</span>' : ''}
              ${t.locked ? '<span class="badge badge-warning" style="margin-right:0.375rem">Locked</span>' : ''}
              ${t.hidden ? '<span class="badge badge-danger" style="margin-right:0.375rem">Hidden</span>' : ''}
              ${esc(t.title)}
            </div>
            <div class="forum-topic-meta">by ${esc(t.author_name || 'Anonymous')} &middot; ${timeAgo(t.created_at)}</div>
          </div>
          <div class="forum-topic-stats">
            <span>${t.reply_count || 0} replies</span>
            <span>${t.last_reply_at ? timeAgo(t.last_reply_at) : 'no replies'}</span>
          </div>
        </a>`;
    }
    html += '</div>';
  }

  // New topic form for authenticated users
  if (isAuthenticated()) {
    html += `
      <div class="forum-new-topic-form">
        <h3 class="mb-1">New Topic</h3>
        <form id="new-topic-form">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="nt-title" required maxlength="200">
          </div>
          <div class="form-group">
            <label class="form-label">Body</label>
            <textarea class="form-textarea" id="nt-body" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Create Topic</button>
        </form>
      </div>`;
  }

  root.innerHTML = html;

  // Bind new topic form
  const form = document.getElementById('new-topic-form');
  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const session = getSession();
      const memberId = session?.user?.member?.id;
      if (!memberId) {
        alert('You must be logged in.');
        return;
      }

      const title = document.getElementById('nt-title').value.trim();
      const body = document.getElementById('nt-body').value.trim();
      if (!title || !body) return;

      try {
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        await post('forum_topics', {
          title,
          body,
          author_id: memberId,
          author_name: session.user.member.display_name || session.user.email,
          category_id: categoryId,
        });

        // Log forum post activity
        await post('activity_log', { member_id: memberId, action: 'forum_post', metadata: { title } });

        // Reload the topic listing
        await renderTopicListing(root, categoryId);
      } catch (e) {
        console.error('Failed to create topic:', e);
        alert('Failed to create topic. Please try again.');
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Create Topic';
        }
      }
    });
  }
}

// ── Topic View (with replies) ───────────────────────────────────────────────

async function renderTopicView(root, topicId) {
  let topic = null;
  try {
    const topics = await get(`forum_topics?id=eq.${topicId}`);
    topic = topics[0] || null;
  } catch (e) {
    console.warn('Failed to load topic:', e);
  }

  if (!topic) {
    root.innerHTML = '<p class="text-muted">Topic not found.</p>';
    return;
  }

  // Non-admin cannot see hidden topics
  if (topic.hidden && !isAdmin()) {
    root.innerHTML = '<p class="text-muted">Topic not found.</p>';
    return;
  }

  // Load replies
  let replyQuery = `forum_replies?topic_id=eq.${topicId}`;
  if (!isAdmin()) {
    replyQuery += '&hidden=eq.false';
  }
  replyQuery += '&order=created_at.asc';

  let replies = [];
  try {
    replies = await get(replyQuery);
  } catch (e) {
    console.warn('Failed to load replies:', e);
  }

  const admin = isAdmin();

  let html = `
    <div class="forum-breadcrumb">
      <a href="forum.html">Forum</a> /
      <a href="?cat=${esc(topic.category_id)}">Back to topics</a> /
      ${esc(topic.title)}
    </div>`;

  // Topic post
  const hiddenLabel = topic.hidden ? ' hidden-post' : '';
  html += `
    <div class="card${hiddenLabel}" style="margin-bottom:1.5rem">
      <div class="forum-post-header">
        <div>
          <h2 style="margin-bottom:0.25rem">
            ${topic.is_pinned ? '<span class="badge badge-primary" style="margin-right:0.375rem">Pinned</span>' : ''}
            ${topic.locked ? '<span class="badge badge-warning" style="margin-right:0.375rem">Locked</span>' : ''}
            ${topic.hidden ? '<span class="badge badge-danger" style="margin-right:0.375rem">Hidden</span>' : ''}
            ${esc(topic.title)}
          </h2>
          <span class="forum-post-date">by ${esc(topic.author_name || 'Anonymous')} &middot; ${timeAgo(topic.created_at)}</span>
        </div>
      </div>
      <div class="forum-post-body">${esc(topic.body)}</div>
      ${admin ? buildTopicAdminBar(topic) : ''}
    </div>`;

  // Replies
  if (replies.length > 0) {
    html += '<div class="card" style="padding:0;overflow:hidden">';
    for (const r of replies) {
      const rHidden = r.hidden ? ' hidden-post' : '';
      html += `
        <div class="forum-post${rHidden}">
          <div class="forum-post-header">
            <span class="forum-post-author">${esc(r.author_name || 'Anonymous')}</span>
            <span class="forum-post-date">${timeAgo(r.created_at)}${r.hidden ? ' <span class="badge badge-danger">Hidden</span>' : ''}</span>
          </div>
          <div class="forum-post-body">${esc(r.body)}</div>
          ${admin ? buildReplyAdminBar(r) : ''}
        </div>`;
    }
    html += '</div>';
  } else {
    html += '<p class="text-muted mt-2">No replies yet.</p>';
  }

  // Reply form (if authenticated and topic not locked)
  if (topic.locked) {
    html += '<div class="forum-locked-notice">This topic is locked. No new replies can be posted.</div>';
  } else if (isAuthenticated()) {
    html += `
      <div class="forum-reply-form">
        <h3 class="mb-1">Reply</h3>
        <form id="reply-form">
          <div class="form-group">
            <textarea class="form-textarea" id="rf-body" required placeholder="Write your reply..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Post Reply</button>
        </form>
      </div>`;
  }

  root.innerHTML = html;

  // ── Bind reply form ──
  const replyForm = document.getElementById('reply-form');
  if (replyForm) {
    replyForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const session = getSession();
      const memberId = session?.user?.member?.id;
      if (!memberId) {
        alert('You must be logged in.');
        return;
      }

      const body = document.getElementById('rf-body').value.trim();
      if (!body) return;

      try {
        const btn = replyForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        await post('forum_replies', {
          body,
          author_id: memberId,
          author_name: session.user.member.display_name || session.user.email,
          topic_id: topicId,
        });

        // Update topic reply_count and last_reply_at
        await patch(`forum_topics?id=eq.${topicId}`, {
          reply_count: (topic.reply_count || 0) + 1,
          last_reply_at: new Date().toISOString(),
        });

        // Re-render topic view
        await renderTopicView(root, topicId);
      } catch (e) {
        console.error('Failed to post reply:', e);
        alert('Failed to post reply. Please try again.');
        const btn = replyForm.querySelector('button[type="submit"]');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Post Reply';
        }
      }
    });
  }

  // ── Bind admin actions ──
  if (admin) {
    bindTopicAdminActions(root, topic);
    bindReplyAdminActions(root, topicId);
  }
}

// ── Admin Controls ──────────────────────────────────────────────────────────

function buildTopicAdminBar(topic) {
  return `
    <div class="forum-admin-bar">
      <button class="btn btn-sm btn-secondary" data-topic-action="pin" data-topic-id="${esc(topic.id)}">${topic.is_pinned ? 'Unpin' : 'Pin'}</button>
      <button class="btn btn-sm btn-secondary" data-topic-action="lock" data-topic-id="${esc(topic.id)}">${topic.locked ? 'Unlock' : 'Lock'}</button>
      <button class="btn btn-sm btn-secondary" data-topic-action="hide" data-topic-id="${esc(topic.id)}">${topic.hidden ? 'Unhide' : 'Hide'}</button>
      <button class="btn btn-sm btn-danger" data-topic-action="delete" data-topic-id="${esc(topic.id)}">Delete</button>
    </div>`;
}

function buildReplyAdminBar(reply) {
  return `
    <div class="forum-post-actions">
      <button class="btn btn-sm btn-secondary" data-reply-action="hide" data-reply-id="${esc(reply.id)}">${reply.hidden ? 'Unhide' : 'Hide'}</button>
      <button class="btn btn-sm btn-danger" data-reply-action="delete" data-reply-id="${esc(reply.id)}">Delete</button>
    </div>`;
}

function bindTopicAdminActions(root, topic) {
  root.querySelectorAll('[data-topic-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.topicAction;
      const id = btn.dataset.topicId;

      try {
        if (action === 'pin') {
          await patch(`forum_topics?id=eq.${id}`, { is_pinned: !topic.is_pinned });
        } else if (action === 'lock') {
          await patch(`forum_topics?id=eq.${id}`, { locked: !topic.locked });
        } else if (action === 'hide') {
          await patch(`forum_topics?id=eq.${id}`, { hidden: !topic.hidden });
        } else if (action === 'delete') {
          if (!confirm('Delete this topic and all its replies?')) return;
          await del(`forum_replies?topic_id=eq.${id}`);
          await del(`forum_topics?id=eq.${id}`);
          window.location.href = `?cat=${topic.category_id}`;
          return;
        }

        // Re-render topic view after toggle actions
        await renderTopicView(root, id);
      } catch (e) {
        console.error('Admin action failed:', e);
        alert('Action failed. Please try again.');
      }
    });
  });
}

function bindReplyAdminActions(root, topicId) {
  root.querySelectorAll('[data-reply-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.replyAction;
      const id = btn.dataset.replyId;

      try {
        if (action === 'hide') {
          // Fetch current state to toggle
          const replies = await get(`forum_replies?id=eq.${id}`);
          const reply = replies[0];
          if (!reply) return;
          await patch(`forum_replies?id=eq.${id}`, { hidden: !reply.hidden });
        } else if (action === 'delete') {
          if (!confirm('Delete this reply?')) return;
          await del(`forum_replies?id=eq.${id}`);
        }

        // Re-render topic view
        await renderTopicView(root, topicId);
      } catch (e) {
        console.error('Reply admin action failed:', e);
        alert('Action failed. Please try again.');
      }
    });
  });
}
