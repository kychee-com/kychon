import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const source = readFileSync(join(root, 'functions/kychon-api.js'), 'utf8');
const forum = readFileSync(join(root, 'src/components/kychon/ForumPageApp.tsx'), 'utf8');

describe('translations.translateText source', () => {
  it('uses Run402 native translation without BYOK provider calls', () => {
    expect(source).toContain('ai.translate(');
    expect(source).toMatch(/import \{[^}]*\bai\b[^}]*\} from '@run402\/functions'/);
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('api.openai.com');
    expect(source).not.toContain('chat/completions');
  });

  it('respects the translation feature flag and caches in content_translations', () => {
    expect(source).toContain('feature_ai_translation');
    expect(source).toContain("from('content_translations')");
  });

  it('replaces the anonymous translate-text function', () => {
    expect(existsSync(join(root, 'functions/translate-text.js'))).toBe(false);
    expect(forum).toContain("execOp('translations.translateText'");
    expect(forum).not.toContain('/functions/v1/translate-text');
  });
});
