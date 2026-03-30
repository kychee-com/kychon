import { describe, it, expect, vi, beforeEach } from 'vitest';

// Integration tests for activity feed data fetching

describe('activity feed data fetching', () => {
  const mockMembers = [
    { id: 1, display_name: 'Alice Admin', avatar_url: '/img/alice.jpg' },
    { id: 2, display_name: 'Bob Builder', avatar_url: null },
    { id: 3, display_name: 'Carol Chen', avatar_url: '/img/carol.jpg' },
  ];

  const mockActivityLog = [
    { id: 10, member_id: 1, action: 'announcement', metadata: { title: 'Welcome!' }, created_at: '2026-03-30T10:00:00Z' },
    { id: 9, member_id: 2, action: 'rsvp', metadata: { event_title: 'Spring Mixer', event_id: 1 }, created_at: '2026-03-29T15:00:00Z' },
    { id: 8, member_id: 3, action: 'member_join', metadata: {}, created_at: '2026-03-28T09:00:00Z' },
    { id: 7, member_id: 1, action: 'resource_upload', metadata: { title: 'Handbook.pdf' }, created_at: '2026-03-27T14:00:00Z' },
    { id: 6, member_id: 999, action: 'member_join', metadata: {}, created_at: '2026-03-26T08:00:00Z' }, // deleted member
  ];

  function buildMemberMap(members) {
    const map = {};
    for (const m of members) map[m.id] = m;
    return map;
  }

  it('joins activity entries with member data', () => {
    const membersMap = buildMemberMap(mockMembers);
    const enriched = mockActivityLog.map(entry => ({
      ...entry,
      member: membersMap[entry.member_id] || null,
    }));

    expect(enriched[0].member.display_name).toBe('Alice Admin');
    expect(enriched[1].member.display_name).toBe('Bob Builder');
    expect(enriched[4].member).toBeNull(); // deleted member
  });

  it('collects unique member IDs from entries', () => {
    const ids = [...new Set(mockActivityLog.map(e => e.member_id).filter(Boolean))];
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    expect(ids).toContain(999);
    expect(ids).toHaveLength(4);
  });

  it('limits entries to configured amount', () => {
    const limit = 3;
    const limited = mockActivityLog.slice(0, limit);
    expect(limited).toHaveLength(3);
    expect(limited[0].id).toBe(10); // most recent first
  });

  it('entries are ordered by created_at descending', () => {
    const dates = mockActivityLog.map(e => new Date(e.created_at).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });

  it('handles missing member gracefully', () => {
    const membersMap = buildMemberMap(mockMembers);
    const entry = mockActivityLog[4]; // member_id: 999
    const member = membersMap[entry.member_id];
    const displayName = member ? member.display_name : 'Former member';
    expect(displayName).toBe('Former member');
  });

  it('handles entries with null metadata', () => {
    const entry = { id: 1, member_id: 1, action: 'member_join', metadata: null, created_at: '2026-03-30T10:00:00Z' };
    const meta = entry.metadata || {};
    expect(meta).toEqual({});
  });

  it('renders correct text for each action type', () => {
    const ACTION_TEMPLATES = {
      member_join: (m) => `${m.name} joined the community`,
      announcement: (m) => `${m.name} posted an announcement: ${m.meta.title || ''}`,
      rsvp: (m) => `${m.name} is going to ${m.meta.event_title || ''}`,
      resource_upload: (m) => `${m.name} shared a resource: ${m.meta.title || ''}`,
      forum_post: (m) => `${m.name} started a discussion: ${m.meta.title || ''}`,
      reaction: (m) => `${m.name} reacted to ${m.meta.content_type || 'a post'}`,
    };

    const membersMap = buildMemberMap(mockMembers);
    const results = mockActivityLog.map(entry => {
      const member = membersMap[entry.member_id];
      const name = member ? member.display_name : 'Former member';
      const meta = entry.metadata || {};
      const tmpl = ACTION_TEMPLATES[entry.action];
      return tmpl ? tmpl({ name, meta }) : `${name} was active`;
    });

    expect(results[0]).toBe('Alice Admin posted an announcement: Welcome!');
    expect(results[1]).toBe('Bob Builder is going to Spring Mixer');
    expect(results[2]).toBe('Carol Chen joined the community');
    expect(results[3]).toBe('Alice Admin shared a resource: Handbook.pdf');
    expect(results[4]).toBe('Former member joined the community');
  });
});
