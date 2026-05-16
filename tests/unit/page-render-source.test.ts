import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageRenderSource = readFileSync(join(import.meta.dirname, '../../src/lib/page-render.ts'), 'utf8');
const domFragmentSource = readFileSync(join(import.meta.dirname, '../../src/lib/dom-fragment.ts'), 'utf8');

describe('page-render source', () => {
  it('delegates runtime section replacement to the shared DOM fragment helper', () => {
    expect(pageRenderSource).toContain("import { renderHtmlChildren } from './dom-fragment'");
    expect(pageRenderSource).toContain('renderHtmlChildren(sectionsHost, newHtml)');
    expect(pageRenderSource).not.toContain('new DOMParser()');
    expect(pageRenderSource).not.toContain('replaceChildren');
    expect(pageRenderSource).not.toContain('innerHTML');
    expect(pageRenderSource).not.toContain('insertAdjacentHTML');
    expect(pageRenderSource).not.toContain('document.createElement');
    expect(pageRenderSource).not.toContain('appendChild');
    expect(pageRenderSource).not.toContain('querySelector');
    expect(domFragmentSource).toContain('function domParserCtor');
    expect(domFragmentSource).toContain('new parserCtor()');
    expect(domFragmentSource).toContain('replaceChildren');
  });
});
