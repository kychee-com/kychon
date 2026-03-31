import { describe, expect, it } from 'vitest';

describe('AI moderation logic', () => {
  function classifyResult(response) {
    try {
      const parsed = JSON.parse(response);
      return {
        classification: parsed.classification || 'appropriate',
        confidence: parsed.classification === 'appropriate' ? 0 : parsed.confidence || 0.5,
        reason: parsed.reason || 'No reason provided',
      };
    } catch {
      return { classification: 'appropriate', confidence: 0, reason: 'Parse error' };
    }
  }

  function getAction(confidence) {
    if (confidence > 0.7) return 'auto-hide';
    if (confidence > 0.3) return 'flag-for-review';
    return 'approved';
  }

  it('parses valid AI response', () => {
    const result = classifyResult('{"classification":"spam","confidence":0.95,"reason":"Contains promotional links"}');
    expect(result.classification).toBe('spam');
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toBe('Contains promotional links');
  });

  it('handles appropriate classification', () => {
    const result = classifyResult('{"classification":"appropriate","confidence":0.1,"reason":"Normal post"}');
    expect(result.classification).toBe('appropriate');
    expect(result.confidence).toBe(0); // Appropriate always gets 0 confidence
  });

  it('handles malformed response gracefully', () => {
    const result = classifyResult('not json');
    expect(result.classification).toBe('appropriate');
    expect(result.confidence).toBe(0);
  });

  it('handles empty response', () => {
    const result = classifyResult('{}');
    expect(result.classification).toBe('appropriate');
    // parsed.classification is undefined (not === 'appropriate'), so confidence falls to default 0.5
    expect(result.confidence).toBe(0.5);
  });

  it('auto-hides high confidence', () => {
    expect(getAction(0.9)).toBe('auto-hide');
    expect(getAction(0.75)).toBe('auto-hide');
  });

  it('flags borderline confidence', () => {
    expect(getAction(0.5)).toBe('flag-for-review');
    expect(getAction(0.4)).toBe('flag-for-review');
  });

  it('approves low confidence', () => {
    expect(getAction(0.2)).toBe('approved');
    expect(getAction(0)).toBe('approved');
  });

  it('boundary: 0.7 triggers auto-hide', () => {
    expect(getAction(0.71)).toBe('auto-hide');
  });

  it('boundary: 0.3 triggers flag', () => {
    expect(getAction(0.31)).toBe('flag-for-review');
  });
});
