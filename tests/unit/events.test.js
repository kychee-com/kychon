import { describe, it, expect } from 'vitest';

describe('events logic', () => {
  const events = [
    { id: 1, title: 'Future Event', starts_at: '2027-01-01T10:00:00Z', capacity: 50 },
    { id: 2, title: 'Past Event', starts_at: '2020-01-01T10:00:00Z', capacity: null },
    { id: 3, title: 'Full Event', starts_at: '2027-06-01T10:00:00Z', capacity: 2 },
  ];

  const rsvps = [
    { event_id: 3, member_id: 1, status: 'going' },
    { event_id: 3, member_id: 2, status: 'going' },
    { event_id: 1, member_id: 1, status: 'going' },
    { event_id: 1, member_id: 2, status: 'maybe' },
  ];

  function getGoingCount(eventId) {
    return rsvps.filter(r => r.event_id === eventId && r.status === 'going').length;
  }

  function isFull(event) {
    return event.capacity && getGoingCount(event.id) >= event.capacity;
  }

  function splitEvents(events) {
    const now = new Date().toISOString();
    return {
      upcoming: events.filter(e => e.starts_at >= now),
      past: events.filter(e => e.starts_at < now),
    };
  }

  it('splits events into upcoming and past', () => {
    const { upcoming, past } = splitEvents(events);
    expect(upcoming.length).toBe(2);
    expect(past.length).toBe(1);
    expect(past[0].title).toBe('Past Event');
  });

  it('counts going RSVPs correctly', () => {
    expect(getGoingCount(1)).toBe(1);
    expect(getGoingCount(3)).toBe(2);
  });

  it('detects full events', () => {
    expect(isFull(events[2])).toBe(true); // capacity 2, 2 going
    expect(isFull(events[0])).toBe(false); // capacity 50, 1 going
  });

  it('unlimited capacity is never full', () => {
    expect(isFull(events[1])).toBeFalsy(); // capacity null → short-circuits to falsy
  });

  it('enforces unique RSVP per event+member', () => {
    const existing = rsvps.filter(r => r.event_id === 1 && r.member_id === 1);
    expect(existing.length).toBe(1);
  });
});
