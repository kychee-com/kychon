import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(import.meta.dirname, '../../functions/translate-text.js'), 'utf8');

describe('translate-text function source', () => {
  it('uses Run402 native translation without BYOK provider calls', () => {
    expect(source).toContain('ai.translate(');
    expect(source).toContain('@run402/functions');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('api.openai.com');
    expect(source).not.toContain('chat/completions');
  });

  it('respects the translation feature flag and preserves cache behavior', () => {
    expect(source).toContain('feature_ai_translation');
    expect(source).toContain('content_translations');
    expect(source).toContain('cached: true');
  });
});
