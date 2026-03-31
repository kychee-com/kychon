// event.js — Single event detail page with RSVP

import { del, get, patch, post } from './api.js?v=9';
import { getSession, isAdmin, isAuthenticated } from './auth.js?v=9';
import { translateItems } from './config.js?v=9';
import { showToast } from './toast.js?v=9';

export async function initEvent() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    document.getElementById('event-detail').innerHTML = '<p>Event not found.</p>';
    return;
  }

  try {
    const events = await get(`events?id=eq.${id}&limit=1`);
    if (events.length === 0) {
      document.getElementById('event-detail').innerHTML = '<p>Event not found.</p>';
      return;
    }
    const event = events[0];
    await translateItems('event', [event], ['title', 'description']);

    // Check members-only access
    if (event.is_members_only && !isAuthenticated()) {
      document.getElementById('event-detail').innerHTML = '<p>This event is for members only. Please sign in.</p>';
      return;
    }

    // Load RSVPs
    const rsvps = await get(`event_rsvps?event_id=eq.${id}&select=*,members(display_name,avatar_url)`);
    const goingCount = rsvps.filter((r) => r.status === 'going').length;
    const maybeCount = rsvps.filter((r) => r.status === 'maybe').length;

    // Current user's RSVP
    const session = getSession();
    const memberId = session?.user?.member?.id;
    const myRsvp = memberId ? rsvps.find((r) => r.member_id === memberId) : null;

    renderEvent(event, rsvps, goingCount, maybeCount, myRsvp, memberId);
  } catch (_e) {
    document.getElementById('event-detail').innerHTML = '<p>Error loading event.</p>';
  }
}

function renderEvent(event, rsvps, goingCount, maybeCount, myRsvp, memberId) {
  const container = document.getElementById('event-detail');
  if (!container) return;

  const date = new Date(event.starts_at);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const endStr = event.ends_at
    ? ` — ${new Date(event.ends_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const capacityPct = event.capacity ? Math.min(100, Math.round((goingCount / event.capacity) * 100)) : 0;
  const spotsLeft = event.capacity ? event.capacity - goingCount : null;
  const isFull = event.capacity && goingCount >= event.capacity;

  container.innerHTML = `
    ${event.image_url ? `<img src="${esc(event.image_url)}" alt="" style="width:100%;max-height:300px;object-fit:cover;border-radius:var(--radius);margin-bottom:1.5rem">` : ''}
    <h1>${esc(event.title)}</h1>
    <p class="text-muted">${dateStr} at ${timeStr}${endStr}</p>
    ${event.location ? `<p class="text-muted">📍 ${esc(event.location)}</p>` : ''}
    ${event.is_members_only ? '<span class="badge badge-primary mb-1">Members Only</span>' : ''}

    <div class="mt-2">${event.description || ''}</div>

    <div class="card mt-2">
      <div class="flex justify-between items-center mb-1">
        <strong>${goingCount} going${maybeCount ? `, ${maybeCount} maybe` : ''}</strong>
        ${event.capacity ? `<span class="text-sm text-muted">${spotsLeft} of ${event.capacity} spots left</span>` : ''}
      </div>
      ${event.capacity ? `<div style="height:6px;background:var(--color-border);border-radius:3px;overflow:hidden"><div style="width:${capacityPct}%;height:100%;background:var(--color-primary);border-radius:3px"></div></div>` : ''}

      ${
        memberId
          ? `
        <div class="flex gap-1 mt-2" id="rsvp-buttons">
          <button class="btn ${myRsvp?.status === 'going' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-rsvp="going" ${isFull && myRsvp?.status !== 'going' ? 'disabled' : ''}>Going</button>
          <button class="btn ${myRsvp?.status === 'maybe' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-rsvp="maybe">Maybe</button>
          ${myRsvp ? '<button class="btn btn-secondary btn-sm" data-rsvp="cancel">Cancel RSVP</button>' : ''}
        </div>
      `
          : '<p class="text-sm text-muted mt-1">Sign in to RSVP</p>'
      }
    </div>

    ${
      rsvps.filter((r) => r.status === 'going' || r.status === 'maybe').length > 0
        ? `
      <div class="mt-2">
        <h3 class="mb-1">Attendees</h3>
        ${rsvps
          .filter((r) => r.status !== 'cancelled')
          .map(
            (r) => `
          <div class="member-card">
            ${
              r.members?.avatar_url
                ? `<img class="member-avatar" src="${esc(r.members.avatar_url)}" alt="">`
                : `<div class="member-avatar" style="background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:600">${(r.members?.display_name || '?')[0].toUpperCase()}</div>`
            }
            <div class="member-info">
              <span class="member-name">${esc(r.members?.display_name || 'Member')}</span>
              <span class="badge badge-${r.status === 'going' ? 'success' : 'warning'} ml-1">${r.status}</span>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `
        : ''
    }

    ${
      isAdmin()
        ? `
      <div class="mt-2 flex gap-1">
        <button class="btn btn-danger btn-sm" id="event-delete">Delete Event</button>
      </div>
    `
        : ''
    }
  `;

  // RSVP handlers
  container.querySelectorAll('[data-rsvp]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.rsvp;
      const eventId = event.id;

      try {
        if (action === 'cancel' && myRsvp) {
          await del(`event_rsvps?id=eq.${myRsvp.id}`);
          showToast('RSVP cancelled', 'info');
        } else if (myRsvp) {
          await patch(`event_rsvps?id=eq.${myRsvp.id}`, { status: action });
          showToast(action === 'going' ? "You're going!" : 'Marked as maybe', 'success');
        } else {
          await post('event_rsvps', { event_id: eventId, member_id: memberId, status: action });
          showToast(action === 'going' ? "You're going!" : 'Marked as maybe', 'success');
        }
        // Log RSVP activity (only for going/maybe, not cancel)
        if (action !== 'cancel' && memberId) {
          await post('activity_log', {
            member_id: memberId,
            action: 'rsvp',
            metadata: { event_title: event.title, event_id: eventId },
          });
        }
      } catch (_e) {
        showToast('Could not update RSVP', 'error');
      }
      // Reload
      await initEvent();
    });
  });

  // Delete handler
  document.getElementById('event-delete')?.addEventListener('click', async () => {
    if (!confirm('Delete this event?')) return;
    await del(`events?id=eq.${event.id}`);
    window.location.href = '/events.html';
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}
