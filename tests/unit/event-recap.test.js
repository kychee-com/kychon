import { describe, expect, it } from 'vitest';

describe('Event recap generation logic', () => {
  function validateRecapRequest(eventId, endsAt) {
    if (!eventId) return { valid: false, error: 'event_id is required' };
    if (new Date(endsAt) > new Date()) return { valid: false, error: 'Event has not ended yet' };
    return { valid: true };
  }

  function parseRecapResponse(response, eventTitle) {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return {
      title: parsed.title || `Recap: ${eventTitle}`,
      body: parsed.body || `<p>Thanks to everyone who attended ${eventTitle}!</p>`,
    };
  }

  function shouldShowRecapButton(isAdmin, featureEnabled, endsAt) {
    if (!isAdmin || !featureEnabled) return false;
    return new Date(endsAt) < new Date();
  }

  it('rejects missing event_id', () => {
    const result = validateRecapRequest(null, '2020-01-01');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('event_id');
  });

  it('rejects future event', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = validateRecapRequest(1, future);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not ended');
  });

  it('accepts past event', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const result = validateRecapRequest(1, past);
    expect(result.valid).toBe(true);
  });

  it('parses valid recap JSON', () => {
    const result = parseRecapResponse('{"title":"Great Event!","body":"<p>Fun times.</p>"}', 'BBQ');
    expect(result.title).toBe('Great Event!');
    expect(result.body).toBe('<p>Fun times.</p>');
  });

  it('falls back on missing title/body', () => {
    const result = parseRecapResponse('{}', 'Town Hall');
    expect(result.title).toBe('Recap: Town Hall');
    expect(result.body).toContain('Town Hall');
  });

  it('parses JSON in code fences', () => {
    const result = parseRecapResponse('```json\n{"title":"Recap","body":"<p>Hi</p>"}\n```', 'X');
    expect(result.title).toBe('Recap');
  });

  it('shows recap button for past events when admin and feature enabled', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(shouldShowRecapButton(true, true, past)).toBe(true);
  });

  it('hides recap button for future events', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(shouldShowRecapButton(true, true, future)).toBe(false);
  });

  it('hides recap button when feature disabled', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(shouldShowRecapButton(true, false, past)).toBe(false);
  });

  it('hides recap button for non-admins', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(shouldShowRecapButton(false, true, past)).toBe(false);
  });
});
