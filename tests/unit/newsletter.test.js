import { describe, expect, it } from 'vitest';

describe('Newsletter generation logic', () => {
  function buildActivitySummary(activity) {
    const sections = [];
    if (activity.newMembers.length > 0) {
      sections.push(`New members this week: ${activity.newMembers.map((m) => m.display_name).join(', ')}`);
    }
    if (activity.upcomingEvents.length > 0) {
      sections.push(
        'Upcoming events:\n' +
          activity.upcomingEvents
            .map(
              (e) =>
                `- ${e.title} on ${new Date(e.starts_at).toLocaleDateString()}${e.location ? ` at ${e.location}` : ''}`,
            )
            .join('\n'),
      );
    }
    if (activity.announcements.length > 0) {
      sections.push(`Recent announcements:\n${activity.announcements.map((a) => `- ${a.title}`).join('\n')}`);
    }
    if (activity.topForumPosts.length > 0) {
      sections.push(
        'Popular discussions:\n' +
          activity.topForumPosts.map((p) => `- ${p.title} (${p.reply_count} replies)`).join('\n'),
      );
    }
    if (activity.newResources.length > 0) {
      sections.push(
        'New resources:\n' +
          activity.newResources.map((r) => `- ${r.title}${r.category ? ` (${r.category})` : ''}`).join('\n'),
      );
    }
    return sections;
  }

  function hasContent(activity) {
    return (
      activity.newMembers.length > 0 ||
      activity.upcomingEvents.length > 0 ||
      activity.announcements.length > 0 ||
      activity.topForumPosts.length > 0 ||
      activity.newResources.length > 0
    );
  }

  function parseNewsletterResponse(response, siteName) {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return {
      subject: parsed.subject || `${siteName} — Weekly Update`,
      body: parsed.body || '<p>This week in our community...</p>',
    };
  }

  const emptyActivity = {
    newMembers: [],
    upcomingEvents: [],
    announcements: [],
    topForumPosts: [],
    newResources: [],
  };

  const fullActivity = {
    newMembers: [{ display_name: 'Alice' }, { display_name: 'Bob' }],
    upcomingEvents: [{ title: 'Town Hall', starts_at: '2026-04-05T18:00:00Z', location: 'Main Hall' }],
    announcements: [{ title: 'Spring Update' }],
    topForumPosts: [{ title: 'Welcome thread', reply_count: 12 }],
    newResources: [{ title: 'Guide PDF', category: 'Guides' }],
  };

  it('detects no content for empty activity', () => {
    expect(hasContent(emptyActivity)).toBe(false);
  });

  it('detects content when any section has data', () => {
    expect(hasContent({ ...emptyActivity, newMembers: [{ display_name: 'Alice' }] })).toBe(true);
    expect(hasContent({ ...emptyActivity, announcements: [{ title: 'Test' }] })).toBe(true);
  });

  it('builds summary with all sections', () => {
    const sections = buildActivitySummary(fullActivity);
    expect(sections).toHaveLength(5);
    expect(sections[0]).toContain('Alice');
    expect(sections[0]).toContain('Bob');
    expect(sections[1]).toContain('Town Hall');
    expect(sections[1]).toContain('Main Hall');
    expect(sections[2]).toContain('Spring Update');
    expect(sections[3]).toContain('Welcome thread');
    expect(sections[3]).toContain('12 replies');
    expect(sections[4]).toContain('Guide PDF');
    expect(sections[4]).toContain('Guides');
  });

  it('skips empty sections in summary', () => {
    const partial = { ...emptyActivity, newMembers: [{ display_name: 'Alice' }] };
    const sections = buildActivitySummary(partial);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain('Alice');
  });

  it('handles resources without category', () => {
    const activity = { ...emptyActivity, newResources: [{ title: 'Untitled', category: null }] };
    const sections = buildActivitySummary(activity);
    expect(sections[0]).toBe('New resources:\n- Untitled');
  });

  it('handles events without location', () => {
    const activity = {
      ...emptyActivity,
      upcomingEvents: [{ title: 'Online Call', starts_at: '2026-04-01T10:00:00Z', location: null }],
    };
    const sections = buildActivitySummary(activity);
    expect(sections[0]).not.toContain(' at ');
  });

  it('parses valid newsletter JSON response', () => {
    const result = parseNewsletterResponse('{"subject":"Weekly Digest","body":"<p>Hello!</p>"}', 'Test');
    expect(result.subject).toBe('Weekly Digest');
    expect(result.body).toBe('<p>Hello!</p>');
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const response = '```json\n{"subject":"Update","body":"<p>Content</p>"}\n```';
    const result = parseNewsletterResponse(response, 'Test');
    expect(result.subject).toBe('Update');
    expect(result.body).toBe('<p>Content</p>');
  });

  it('falls back on missing subject/body', () => {
    const result = parseNewsletterResponse('{}', 'My Community');
    expect(result.subject).toBe('My Community — Weekly Update');
    expect(result.body).toContain('This week');
  });

  it('throws on completely invalid JSON', () => {
    expect(() => parseNewsletterResponse('not json at all', 'Test')).toThrow();
  });
});
