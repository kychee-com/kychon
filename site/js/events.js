// events.js — Event listing and RSVP logic

import { get, post } from './api.js?v=3';
import { getSession, isAdmin } from './auth.js?v=3';

let allEvents = [];

export async function initEvents() {
  await loadEvents();

  if (isAdmin()) {
    setupEventCreate();
  }
}

async function loadEvents() {
  try {
    allEvents = await get('events?order=starts_at.asc');
    renderEvents();
  } catch (e) {
    console.warn('Failed to load events:', e);
  }
}

function renderEvents() {
  const now = new Date().toISOString();
  const upcoming = allEvents.filter((e) => e.starts_at >= now);
  const past = allEvents.filter((e) => e.starts_at < now).reverse();

  const container = document.getElementById('events-list');
  if (!container) return;

  if (upcoming.length === 0 && past.length === 0) {
    container.innerHTML = '<p class="text-muted">No events yet.</p>';
    return;
  }

  let html = '';
  if (upcoming.length > 0) {
    html += '<h3 class="mb-1">Upcoming</h3><div class="card-grid mb-2">';
    html += upcoming.map((e) => eventCard(e)).join('');
    html += '</div>';
  }
  if (past.length > 0) {
    html += '<h3 class="mb-1 text-muted">Past Events</h3><div class="card-grid">';
    html += past.map((e) => eventCard(e)).join('');
    html += '</div>';
  }
  container.innerHTML = html;

  container.querySelectorAll('[data-event-id]').forEach((card) => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      window.location.href = `/event.html?id=${card.dataset.eventId}`;
    });
  });
}

function eventCard(e) {
  const date = new Date(e.starts_at);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `
    <div class="card" data-event-id="${e.id}">
      ${e.image_url ? `<img src="${esc(e.image_url)}" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:var(--radius) var(--radius) 0 0;margin:-1.5rem -1.5rem 1rem -1.5rem;width:calc(100% + 3rem)">` : ''}
      <h4>${esc(e.title)}</h4>
      <p class="text-sm text-muted">${dateStr} at ${timeStr}</p>
      ${e.location ? `<p class="text-sm text-muted">${esc(e.location)}</p>` : ''}
      ${e.is_members_only ? '<span class="badge badge-primary">Members Only</span>' : ''}
      ${e.capacity ? `<span class="badge badge-warning">${e.capacity} spots</span>` : ''}
    </div>`;
}

function setupEventCreate() {
  const btn = document.getElementById('event-create-btn');
  if (!btn) return;
  btn.classList.remove('hidden');
  btn.addEventListener('click', () => {
    document.getElementById('event-form-modal')?.classList.remove('hidden');
  });

  document.getElementById('event-form-cancel')?.addEventListener('click', () => {
    document.getElementById('event-form-modal')?.classList.add('hidden');
  });

  document.getElementById('event-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const session = getSession();
    const memberId = session?.user?.member?.id;
    const data = {
      title: document.getElementById('ef-title').value,
      description: document.getElementById('ef-description').value,
      location: document.getElementById('ef-location').value,
      starts_at: document.getElementById('ef-starts').value,
      ends_at: document.getElementById('ef-ends').value || null,
      capacity: parseInt(document.getElementById('ef-capacity').value, 10) || null,
      is_members_only: document.getElementById('ef-members-only').checked,
      created_by: memberId,
    };
    await post('events', data);
    document.getElementById('event-form-modal')?.classList.add('hidden');
    document.getElementById('event-form')?.reset();
    await loadEvents();
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}
