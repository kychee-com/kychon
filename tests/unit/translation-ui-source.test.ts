import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const configSource = readFileSync(join(root, 'src/lib/config.ts'), 'utf8');
const publicCss = readFileSync(join(root, 'src/styles/public.css'), 'utf8');

describe('translation UI source', () => {
  it('does not keep the unused hand-built translate button DOM helper', () => {
    expect(configSource).not.toContain('addTranslateButton');
    expect(configSource).not.toContain('translatedEl.innerHTML');
    expect(configSource).not.toContain('translate-link');
    expect(publicCss).not.toContain('.translate-link');
    expect(publicCss).not.toContain('.translated-content');
    expect(publicCss).not.toContain('.announcement-body');
  });
});
