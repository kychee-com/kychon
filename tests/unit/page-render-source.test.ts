import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageRenderSource = readFileSync(join(import.meta.dirname, '../../src/lib/page-render.ts'), 'utf8');

describe('page-render source', () => {
  it('delegates runtime section replacement to the React HTML child renderer', () => {
    expect(pageRenderSource).toContain("import { renderReactHtmlChildren } from './react-html-children'");
    expect(pageRenderSource).toContain('renderReactHtmlChildren(sectionsHost, newHtml)');
    expect(pageRenderSource).not.toContain("from './dom-fragment'");
    expect(pageRenderSource).not.toContain('new DOMParser()');
    expect(pageRenderSource).not.toContain('replaceChildren');
    expect(pageRenderSource).not.toContain('innerHTML');
    expect(pageRenderSource).not.toContain('insertAdjacentHTML');
    expect(pageRenderSource).not.toContain('document.createElement');
    expect(pageRenderSource).not.toContain('appendChild');
    expect(pageRenderSource).not.toContain('querySelector');
    expect(pageRenderSource).not.toContain('getElementById');
    expect(pageRenderSource).not.toContain('.closest(');
    expect(pageRenderSource).toContain('nearestElementWithAttribute');
  });
});
