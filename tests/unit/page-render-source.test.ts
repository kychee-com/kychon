import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageRenderSource = readFileSync(join(import.meta.dirname, '../../src/lib/page-render.ts'), 'utf8');

describe('page-render source', () => {
  it('uses structured DOM parsing for runtime section replacement', () => {
    expect(pageRenderSource).toContain('new DOMParser()');
    expect(pageRenderSource).toContain('replaceChildren');
    expect(pageRenderSource).not.toContain('innerHTML');
    expect(pageRenderSource).not.toContain('insertAdjacentHTML');
    expect(pageRenderSource).not.toContain('document.createElement');
    expect(pageRenderSource).not.toContain('appendChild');
  });
});
