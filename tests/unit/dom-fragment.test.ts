// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
  clearHtmlChildren,
  moveNodeAfter,
  moveNodeBefore,
  moveNodeToEnd,
  removeNode,
  renderHtmlChildren,
  replaceNodeWith,
  serializeHtmlChildren,
  snapshotChildNodes,
  unwrapElement,
} from '../../src/lib/dom-fragment';
import { htmlFixture } from '../helpers/dom-fixture.js';

describe('DOM fragment reconciliation', () => {
  it('renders parsed HTML children without replacing identical nodes', () => {
    const host = htmlFixture('<div></div>');
    renderHtmlChildren(host, '<p data-id="1">Hello <strong>there</strong></p>');
    const firstChild = host.firstElementChild;

    renderHtmlChildren(host, '<p data-id="1">Hello <strong>there</strong></p>');
    expect(host.firstElementChild).toBe(firstChild);

    renderHtmlChildren(host, '<p data-id="2">Updated</p>');
    expect(host.firstElementChild).not.toBe(firstChild);
    expect(host.querySelector('[data-id="2"]')?.textContent).toBe('Updated');
  });

  it('serializes and clears child content for rich text handoff', () => {
    const host = htmlFixture('<div></div>');
    renderHtmlChildren(host, '<p>Copy</p>plain');

    expect(serializeHtmlChildren(host)).toBe('<p>Copy</p>plain');
    clearHtmlChildren(host);
    expect(host.childNodes).toHaveLength(0);
  });

  it('snapshots child nodes before sanitizer-style mutation', () => {
    const host = htmlFixture('<div><span>A</span><span>B</span></div>');
    const nodes = snapshotChildNodes(host);

    removeNode(nodes[0]);

    expect(nodes.map((node) => node.textContent)).toEqual(['A', 'B']);
    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['B']);
  });

  it('moves an existing node to the end without rebuilding siblings', () => {
    const host = htmlFixture('<div></div>');
    renderHtmlChildren(host, '<span>A</span><span>B</span>');
    const first = host.firstElementChild as HTMLElement;

    moveNodeToEnd(host, first);

    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['B', 'A']);
    expect(host.lastElementChild).toBe(first);
  });

  it('moves a node around a reference without rebuilding unrelated siblings', () => {
    const host = htmlFixture('<div></div>');
    renderHtmlChildren(host, '<span>A</span><span>B</span><span>C</span>');
    const [first, second, third] = Array.from(host.children) as HTMLElement[];

    moveNodeAfter(second, first);
    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['B', 'A', 'C']);
    expect(host.children[1]).toBe(first);

    moveNodeBefore(second, third);
    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['C', 'B', 'A']);
    expect(host.firstElementChild).toBe(third);
    expect(host.children[1]).toBe(second);
  });

  it('replaces a reference node without rebuilding unrelated siblings', () => {
    const host = htmlFixture('<div></div>');
    renderHtmlChildren(host, '<span>A</span><span>B</span>');
    const first = host.firstElementChild as HTMLElement;
    const second = host.lastElementChild as HTMLElement;
    const replacement = htmlFixture('<span>C</span>');

    replaceNodeWith(first, replacement);

    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['C', 'B']);
    expect(host.firstElementChild).toBe(replacement);
    expect(host.lastElementChild).toBe(second);
  });

  it('removes and unwraps nodes for sanitizer handoff', () => {
    const host = htmlFixture('<div></div>');
    renderHtmlChildren(host, '<span>A</span><em><span>B</span></em><span>C</span>');
    const wrapper = host.querySelector('em') as HTMLElement;
    const wrappedChild = wrapper.firstElementChild;

    unwrapElement(wrapper);
    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['A', 'B', 'C']);
    expect(host.children[1]).toBe(wrappedChild);

    removeNode(host.children[1]);
    expect(Array.from(host.children).map((child) => child.textContent)).toEqual(['A', 'C']);
  });
});
