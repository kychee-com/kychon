import { describe, expect, it } from 'vitest';

// Extracted logic from moderate-content.js for unit testing
function moderateContent(result) {
  try {
    const scores = result.category_scores || {};
    const entries = Object.entries(scores);
    const maxEntry = entries.reduce((a, b) => (b[1] > a[1] ? b : a), ['unknown', 0]);
    const confidence = maxEntry[1];
    const reason = maxEntry[0];

    if (!result.flagged) {
      return { action: 'approved', confidence, reason, flagged: false };
    }
    if (confidence > 0.7) {
      return { action: 'hidden', confidence, reason, flagged: true };
    }
    return { action: 'flagged', confidence, reason, flagged: true };
  } catch {
    return { action: 'approved', confidence: 0, reason: 'moderation unavailable', flagged: false };
  }
}

describe('AI moderation logic (native ai.moderate)', () => {
  it('approves unflagged content', () => {
    const result = moderateContent({
      flagged: false,
      categories: { harassment: false, violence: false },
      category_scores: { harassment: 0.01, violence: 0.02 },
    });
    expect(result.action).toBe('approved');
    expect(result.flagged).toBe(false);
    expect(result.confidence).toBe(0.02);
  });

  it('auto-hides flagged content with high confidence', () => {
    const result = moderateContent({
      flagged: true,
      categories: { harassment: true, violence: false },
      category_scores: { harassment: 0.85, violence: 0.02 },
    });
    expect(result.action).toBe('hidden');
    expect(result.flagged).toBe(true);
    expect(result.confidence).toBe(0.85);
    expect(result.reason).toBe('harassment');
  });

  it('flags content with medium confidence for review', () => {
    const result = moderateContent({
      flagged: true,
      categories: { harassment: true },
      category_scores: { harassment: 0.55, violence: 0.1 },
    });
    expect(result.action).toBe('flagged');
    expect(result.flagged).toBe(true);
    expect(result.confidence).toBe(0.55);
  });

  it('picks the highest scoring category as reason', () => {
    const result = moderateContent({
      flagged: true,
      categories: { harassment: true, sexual: true },
      category_scores: { harassment: 0.4, sexual: 0.8, violence: 0.1 },
    });
    expect(result.reason).toBe('sexual');
    expect(result.confidence).toBe(0.8);
  });

  it('boundary: 0.7 does not trigger auto-hide', () => {
    const result = moderateContent({
      flagged: true,
      categories: { harassment: true },
      category_scores: { harassment: 0.7 },
    });
    expect(result.action).toBe('flagged');
  });

  it('boundary: just above 0.7 triggers auto-hide', () => {
    const result = moderateContent({
      flagged: true,
      categories: { harassment: true },
      category_scores: { harassment: 0.71 },
    });
    expect(result.action).toBe('hidden');
  });

  it('handles empty category_scores', () => {
    const result = moderateContent({
      flagged: false,
      categories: {},
      category_scores: {},
    });
    expect(result.action).toBe('approved');
    expect(result.confidence).toBe(0);
    expect(result.reason).toBe('unknown');
  });

  it('handles missing category_scores', () => {
    const result = moderateContent({ flagged: false, categories: {} });
    expect(result.action).toBe('approved');
  });

  it('handles error gracefully', () => {
    const result = moderateContent(null);
    expect(result.action).toBe('approved');
    expect(result.reason).toBe('moderation unavailable');
  });
});
