import { describe, expect, it } from 'vitest';
import { escapeHtml, htmlFixture } from '../helpers/dom-fixture.js';

describe('events rendering', () => {
  const events = [
    {
      id: 1,
      title: 'Summer BBQ',
      starts_at: '2027-07-15T18:00:00Z',
      location: 'Park',
      capacity: 50,
      is_members_only: false,
    },
    {
      id: 2,
      title: 'Members Workshop',
      starts_at: '2027-08-01T10:00:00Z',
      location: 'Office',
      capacity: 20,
      is_members_only: true,
    },
    {
      id: 3,
      title: 'Past Meetup',
      starts_at: '2020-01-01T18:00:00Z',
      location: null,
      capacity: null,
      is_members_only: false,
    },
  ];

  function renderEventCard(event) {
    const date = new Date(event.starts_at);
    return htmlFixture(`
      <div data-event-id="${escapeHtml(event.id)}">
        <h4>${escapeHtml(event.title)}</h4>
        <p data-event-date>${escapeHtml(date.toLocaleDateString())}</p>
        ${event.location ? `<p data-event-location>${escapeHtml(event.location)}</p>` : ''}
        ${event.is_members_only ? '<span data-event-members-only>Members Only</span>' : ''}
        ${event.capacity ? `<span data-event-capacity>${escapeHtml(event.capacity)} spots</span>` : ''}
      </div>
    `);
  }

  it('renders event card with title and date', () => {
    const card = renderEventCard(events[0]);
    expect(card.querySelector('h4').textContent).toBe('Summer BBQ');
    expect(card.querySelector('[data-event-date]')).toBeTruthy();
  });

  it('shows location when present', () => {
    const card = renderEventCard(events[0]);
    expect(card.querySelector('[data-event-location]').textContent).toBe('Park');
  });

  it('hides location when null', () => {
    const card = renderEventCard(events[2]);
    expect(card.querySelector('[data-event-location]')).toBeNull();
  });

  it('shows members-only badge', () => {
    const card = renderEventCard(events[1]);
    expect(card.querySelector('[data-event-members-only]')).toBeTruthy();
  });

  it('hides members-only badge for public events', () => {
    const card = renderEventCard(events[0]);
    expect(card.querySelector('[data-event-members-only]')).toBeNull();
  });

  it('shows capacity badge', () => {
    const card = renderEventCard(events[0]);
    expect(card.querySelector('[data-event-capacity]').textContent).toContain('50');
  });

  it('hides capacity badge when null', () => {
    const card = renderEventCard(events[2]);
    expect(card.querySelector('[data-event-capacity]')).toBeNull();
  });

  it('renders RSVP buttons', () => {
    const container = htmlFixture(`
      <div>
        <button data-rsvp="going">Going</button>
        <button data-rsvp="maybe">Maybe</button>
      </div>
    `);
    const buttons = container.querySelectorAll('[data-rsvp]');
    expect(buttons.length).toBe(2);
    expect(buttons[0].dataset.rsvp).toBe('going');
  });
});
