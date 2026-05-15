import { describe, expect, it } from 'vitest';

import { activityText, formatActivityTime } from '../../src/lib/activity-feed.ts';

describe('activity feed rendering', () => {
  describe('action-type templates', () => {
    it('renders member_join action', () => {
      const text = activityText('member_join', 'Alice', {});
      expect(text).toBe('Alice joined the community');
    });

    it('renders announcement action with title', () => {
      const text = activityText('announcement', 'Bob', { title: 'Big News' });
      expect(text).toBe('Bob posted an announcement: Big News');
    });

    it('renders rsvp action with event title', () => {
      const text = activityText('rsvp', 'Carol', { event_title: 'Spring Mixer' });
      expect(text).toBe('Carol is going to Spring Mixer');
    });

    it('renders resource_upload action', () => {
      const text = activityText('resource_upload', 'Dave', { title: 'Handbook.pdf' });
      expect(text).toBe('Dave shared a resource: Handbook.pdf');
    });

    it('renders forum_post action', () => {
      const text = activityText('forum_post', 'Eve', { title: 'How to volunteer?' });
      expect(text).toBe('Eve started a discussion: How to volunteer?');
    });

    it('renders reaction action', () => {
      const text = activityText('reaction', 'Frank', {
        content_type: 'announcement',
        content_id: 1,
        emoji: 'heart',
      });
      expect(text).toBe('Frank reacted to announcement');
    });

    it('falls back for unknown action type', () => {
      const text = activityText('unknown_action', 'Ghost', {});
      expect(text).toBe('Ghost was active');
    });

    it('handles missing metadata gracefully', () => {
      const text = activityText('announcement', 'Admin', null);
      expect(text).toBe('Admin posted an announcement: ');
    });
  });

  describe('missing member handling', () => {
    it('uses provided name for rendering', () => {
      const text = activityText('member_join', 'Former member', {});
      expect(text).toBe('Former member joined the community');
    });
  });

  describe('formatActivityTime', () => {
    it('shows "just now" for recent timestamps', () => {
      const now = Date.now();
      expect(formatActivityTime(new Date(now).toISOString(), now)).toBe('just now');
    });

    it('shows minutes for timestamps within an hour', () => {
      const now = Date.now();
      const ago = new Date(now - 5 * 60 * 1000).toISOString();
      expect(formatActivityTime(ago, now)).toBe('5m ago');
    });

    it('shows hours for timestamps within a day', () => {
      const now = Date.now();
      const ago = new Date(now - 3 * 60 * 60 * 1000).toISOString();
      expect(formatActivityTime(ago, now)).toBe('3h ago');
    });

    it('shows days for timestamps within a month', () => {
      const now = Date.now();
      const ago = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatActivityTime(ago, now)).toBe('7d ago');
    });

    it('shows date for timestamps older than a month', () => {
      const now = Date.now();
      const old = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
      const result = formatActivityTime(old, now);
      // Should be a formatted date like "Jan 29"
      expect(result).not.toContain('ago');
      expect(result).toBeTruthy();
    });
  });
});
