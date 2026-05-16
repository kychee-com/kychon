// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
  collectDescendantElements,
  directElementChildren,
  findDescendantElement,
  findDirectElementChild,
  nearestAncestorElement,
  nearestAncestorWithAttribute,
  nearestElementWithTagName,
} from '../../src/lib/dom-structure';
import { htmlFixture } from '../helpers/dom-fixture.js';

describe('DOM structure traversal helpers', () => {
  it('walks direct children, descendants, and ancestors without selector lookups', () => {
    const root = htmlFixture(`
      <section data-root>
        <div id="first">
          <span id="nested" data-hit>Nested</span>
        </div>
        <p id="second">Second</p>
      </section>
    `);

    expect(directElementChildren(root).map((child) => child.id)).toEqual(['first', 'second']);
    expect(findDirectElementChild(root, (child) => child.id === 'second')?.tagName).toBe('P');

    const nested = findDescendantElement(root, (child) => child.hasAttribute('data-hit'));
    expect(nested?.id).toBe('nested');
    expect(collectDescendantElements(root, (child) => !!child.id).map((child) => child.id)).toEqual([
      'first',
      'nested',
      'second',
    ]);

    expect(nearestAncestorElement(nested, (child) => child.id === 'first')?.id).toBe('first');
    expect(nearestAncestorWithAttribute(nested, 'data-root')).toBe(root);
    expect(nearestElementWithTagName(nested, 'section')).toBe(root);
  });
});
