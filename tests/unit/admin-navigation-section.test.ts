import { describe, expect, it } from 'vitest';
import {
  chooseNavigationSection,
  isCurrentHeaderNavigationSection,
  type NavigationSectionRow,
} from '../../src/lib/admin/navigation-section';

function section(overrides: Partial<NavigationSectionRow>): NavigationSectionRow {
  return {
    id: 1,
    section_type: 'nav',
    page_slug: '*',
    position: 1,
    scope: 'global',
    visible: true,
    zone: 'header',
    ...overrides,
  };
}

describe('admin navigation section selection', () => {
  it('accepts only visible header nav sections for the current page', () => {
    expect(isCurrentHeaderNavigationSection(section({ id: 2 }), 'index')).toBe(true);
    expect(isCurrentHeaderNavigationSection(section({ section_type: 'hero' }), 'index')).toBe(false);
    expect(isCurrentHeaderNavigationSection(section({ zone: 'main' }), 'index')).toBe(false);
    expect(isCurrentHeaderNavigationSection(section({ visible: false }), 'index')).toBe(false);
    expect(isCurrentHeaderNavigationSection(section({ scope: 'page', page_slug: 'about' }), 'index')).toBe(false);
  });

  it('uses the preferred id when it still points at the current nav', () => {
    const chosen = chooseNavigationSection(
      [section({ id: 10, position: 1 }), section({ id: 11, position: 2 })],
      11,
      'index',
    );

    expect(chosen?.id).toBe(11);
  });

  it('falls back to the current header nav when a rendered id is stale', () => {
    const chosen = chooseNavigationSection(
      [
        section({ id: 20, section_type: 'brand_header', position: 1 }),
        section({ id: 21, position: 2 }),
        section({ id: 22, zone: 'footer', position: 1 }),
      ],
      999,
      'index',
    );

    expect(chosen?.id).toBe(21);
  });

  it('prefers page-specific nav before the global nav when no preferred id matches', () => {
    const chosen = chooseNavigationSection(
      [
        section({ id: 30, page_slug: '*', position: 1, scope: 'global' }),
        section({ id: 31, page_slug: 'about', position: 2, scope: 'page' }),
      ],
      null,
      'about',
    );

    expect(chosen?.id).toBe(31);
  });
});
