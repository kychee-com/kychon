// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { REACT_HTML_CHILDREN_ATTR, renderReactHtmlChildren } from '../../src/lib/react-html-children';
import { htmlFixture } from '../helpers/dom-fixture.js';

describe('React HTML child renderer', () => {
  it('renders HTML inside a transparent React-owned wrapper', () => {
    const host = htmlFixture('<div></div>');

    renderReactHtmlChildren(
      host,
      '<section data-sortable-id="sections.1" class="space-y-2"><p>Hello &amp; welcome</p></section><section data-sortable-id="sections.2"></section>',
    );

    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.hasAttribute(REACT_HTML_CHILDREN_ATTR)).toBe(true);
    expect(host.firstElementChild?.className).toBe('contents');
    expect(host.firstElementChild?.children).toHaveLength(2);
    expect(host.firstElementChild?.firstElementChild?.tagName).toBe('SECTION');
    expect(host.firstElementChild?.firstElementChild?.getAttribute('data-sortable-id')).toBe('sections.1');
    expect(host.firstElementChild?.firstElementChild?.textContent).toBe('Hello & welcome');
  });

  it('preserves existing nodes when the rendered structure is unchanged', () => {
    const host = htmlFixture('<div></div>');

    renderReactHtmlChildren(host, '<section data-id="1"><p>Copy</p></section>');
    const firstSection = host.firstElementChild?.firstElementChild;

    renderReactHtmlChildren(host, '<section data-id="1"><p>Copy</p></section>');
    expect(host.firstElementChild?.firstElementChild).toBe(firstSection);
  });

  it('maps HTML attributes to React props for styles, booleans, SVG, and labels', () => {
    const host = htmlFixture('<div></div>');

    renderReactHtmlChildren(
      host,
      '<label for="name">Name</label><input id="name" disabled hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M0 0"></path></svg><div style="background-image:url(&quot;/hero.png&quot;); --accent: #fff"></div>',
    );

    const label = host.querySelector('label');
    const input = host.querySelector('input');
    const path = host.querySelector('path');
    const styled = host.querySelector('div[style]');

    expect(label?.getAttribute('for')).toBe('name');
    expect(input?.disabled).toBe(true);
    expect(input?.hidden).toBe(true);
    expect(path?.getAttribute('stroke-width')).toBe('2');
    expect(styled?.getAttribute('style')).toContain('background-image:url("/hero.png")');
    expect(styled?.getAttribute('style')).toContain('--accent: #fff');
  });
});
