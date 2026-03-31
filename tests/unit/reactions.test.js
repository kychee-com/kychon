import { describe, expect, it } from 'vitest';

// Pure logic extracted from index.html reactions

const EMOJI_MAP = {
  like: '\u{1F44D}',
  heart: '\u2764\uFE0F',
  celebrate: '\u{1F389}',
  laugh: '\u{1F604}',
  think: '\u{1F914}',
};
const EMOJI_CODES = Object.keys(EMOJI_MAP);

function aggregateReactions(reactions) {
  const counts = {};
  const myReactions = new Set();
  const myId = 99;
  for (const r of reactions) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.member_id === myId) myReactions.add(r.emoji);
  }
  return { counts, myReactions };
}

function shouldToggleOff(existing) {
  return existing.length > 0;
}

describe('reactions logic', () => {
  describe('emoji map', () => {
    it('has exactly 5 emoji codes', () => {
      expect(EMOJI_CODES).toEqual(['like', 'heart', 'celebrate', 'laugh', 'think']);
    });

    it('maps codes to unicode emoji', () => {
      expect(EMOJI_MAP.like).toBe('\u{1F44D}');
      expect(EMOJI_MAP.heart).toBe('\u2764\uFE0F');
      expect(EMOJI_MAP.celebrate).toBe('\u{1F389}');
      expect(EMOJI_MAP.laugh).toBe('\u{1F604}');
      expect(EMOJI_MAP.think).toBe('\u{1F914}');
    });
  });

  describe('reaction aggregation', () => {
    it('counts reactions by emoji type', () => {
      const reactions = [
        { content_id: 1, member_id: 1, emoji: 'like' },
        { content_id: 1, member_id: 2, emoji: 'like' },
        { content_id: 1, member_id: 3, emoji: 'heart' },
      ];
      const { counts } = aggregateReactions(reactions);
      expect(counts.like).toBe(2);
      expect(counts.heart).toBe(1);
      expect(counts.celebrate).toBeUndefined();
    });

    it('tracks current user reactions', () => {
      const reactions = [
        { content_id: 1, member_id: 99, emoji: 'like' },
        { content_id: 1, member_id: 99, emoji: 'heart' },
        { content_id: 1, member_id: 2, emoji: 'like' },
      ];
      const { myReactions } = aggregateReactions(reactions);
      expect(myReactions.has('like')).toBe(true);
      expect(myReactions.has('heart')).toBe(true);
      expect(myReactions.has('celebrate')).toBe(false);
    });

    it('handles empty reactions array', () => {
      const { counts, myReactions } = aggregateReactions([]);
      expect(Object.keys(counts)).toHaveLength(0);
      expect(myReactions.size).toBe(0);
    });
  });

  describe('toggle behavior', () => {
    it('toggles off when reaction already exists', () => {
      const existing = [{ id: 1, member_id: 99, emoji: 'like' }];
      expect(shouldToggleOff(existing)).toBe(true);
    });

    it('toggles on when no existing reaction', () => {
      expect(shouldToggleOff([])).toBe(false);
    });
  });

  describe('duplicate prevention', () => {
    it('unique constraint key combines content_type, content_id, member_id, emoji', () => {
      // Simulate the unique constraint logic
      function uniqueKey(r) {
        return `${r.content_type}:${r.content_id}:${r.member_id}:${r.emoji}`;
      }
      const r1 = { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' };
      const r2 = { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' };
      const r3 = { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'heart' };
      expect(uniqueKey(r1)).toBe(uniqueKey(r2));
      expect(uniqueKey(r1)).not.toBe(uniqueKey(r3));
    });
  });
});
