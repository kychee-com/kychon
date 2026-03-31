import { describe, expect, it } from 'vitest';

// Pure logic extracted from index.html activity feed renderer

const ACTION_TEMPLATES = {
  member_join: (m) => `${m.name} joined the community`,
  announcement: (m) => `${m.name} posted an announcement: ${m.meta.title || ''}`,
  rsvp: (m) => `${m.name} is going to ${m.meta.event_title || ''}`,
  resource_upload: (m) => `${m.name} shared a resource: ${m.meta.title || ''}`,
  forum_post: (m) => `${m.name} started a discussion: ${m.meta.title || ''}`,
  reaction: (m) => `${m.name} reacted to ${m.meta.content_type || 'a post'}`,
};

function renderActivityText(action, name, metadata) {
  const meta = metadata || {};
  const tmpl = ACTION_TEMPLATES[action];
  return tmpl ? tmpl({ name, meta }) : `${name} was active`;
}

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

describe('activity feed rendering', () => {
  describe('action-type templates', () => {
    it('renders member_join action', () => {
      const text = renderActivityText('member_join', 'Alice', {});
      expect(text).toBe('Alice joined the community');
    });

    it('renders announcement action with title', () => {
      const text = renderActivityText('announcement', 'Bob', { title: 'Big News' });
      expect(text).toBe('Bob posted an announcement: Big News');
    });

    it('renders rsvp action with event title', () => {
      const text = renderActivityText('rsvp', 'Carol', { event_title: 'Spring Mixer' });
      expect(text).toBe('Carol is going to Spring Mixer');
    });

    it('renders resource_upload action', () => {
      const text = renderActivityText('resource_upload', 'Dave', { title: 'Handbook.pdf' });
      expect(text).toBe('Dave shared a resource: Handbook.pdf');
    });

    it('renders forum_post action', () => {
      const text = renderActivityText('forum_post', 'Eve', { title: 'How to volunteer?' });
      expect(text).toBe('Eve started a discussion: How to volunteer?');
    });

    it('renders reaction action', () => {
      const text = renderActivityText('reaction', 'Frank', {
        content_type: 'announcement',
        content_id: 1,
        emoji: 'heart',
      });
      expect(text).toBe('Frank reacted to announcement');
    });

    it('falls back for unknown action type', () => {
      const text = renderActivityText('unknown_action', 'Ghost', {});
      expect(text).toBe('Ghost was active');
    });

    it('handles missing metadata gracefully', () => {
      const text = renderActivityText('announcement', 'Admin', null);
      expect(text).toBe('Admin posted an announcement: ');
    });
  });

  describe('missing member handling', () => {
    it('uses provided name for rendering', () => {
      const text = renderActivityText('member_join', 'Former member', {});
      expect(text).toBe('Former member joined the community');
    });
  });

  describe('timeAgo', () => {
    it('shows "just now" for recent timestamps', () => {
      const now = new Date().toISOString();
      expect(timeAgo(now)).toBe('just now');
    });

    it('shows minutes for timestamps within an hour', () => {
      const ago = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(timeAgo(ago)).toBe('5m ago');
    });

    it('shows hours for timestamps within a day', () => {
      const ago = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(ago)).toBe('3h ago');
    });

    it('shows days for timestamps within a month', () => {
      const ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(ago)).toBe('7d ago');
    });

    it('shows date for timestamps older than a month', () => {
      const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const result = timeAgo(old);
      // Should be a formatted date like "Jan 29"
      expect(result).not.toContain('ago');
      expect(result).toBeTruthy();
    });
  });
});
