// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
  clearHtmlChildren,
  moveNodeToEnd,
  renderHtmlChildren,
  serializeHtmlChildren,
} from '../../src/lib/dom-fragment';

describe('DOM fragment reconciliation', () => {
  it('renders parsed HTML children without replacing identical nodes', () => {
    const host = document.createElement('div');
    renderHtmlChildren(host, '<p data-id="1">Hello <strong>there</strong></p>');
    const firstChild = host.firstElementChild;

    renderHtmlChildren(host, '<p data-id="1">Hello <strong>there</strong></p>');
    expect(host.firstElementChild).toBe(firstChild);

    renderHtmlChildren(host, '<p data-id="2">Updated</p>');
    expect(host.firstElementChild).not.toBe(firstChild);
    expect(host.querySelector('[data-id="2"]')?.textContent).toBe('Updated');
  });

  it('serializes and clears child content for rich text handoff', () => {
    const host = document.createElement('div');
    renderHtmlChildren(host, '<p>Copy</p>plain');

    expect(serializeHtmlChildren(host)).toBe('<p>Copy</p>plain');
    clearHtmlChildren(host);
    expect(host.childNodes).toHaveLength(0);
  });

  it('moves an existing node to the end without rebuilding siblings', () => {
    const host = document.createElement('div');
    renderHtmlChildren(host, '<span>A</span><span>B</span>');
    const first = host.firstElementChild as HTMLElement;

    moveNodeToEnd(host, first);

    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['B', 'A']);
    expect(host.lastElementChild).toBe(first);
  });
});
