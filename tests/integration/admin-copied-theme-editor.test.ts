import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCopiedThemeEditorConfig,
  clearSectionCaches,
  saveCopiedThemeSectionConfig,
} from '../../src/lib/admin/copied-theme-editor';
import { clearBodyFixture } from '../helpers/dom-fixture.js';

function createStorage(): Storage {
  const storage = {} as Storage & Record<string, string>;
  Object.defineProperties(storage, {
    length: {
      get() {
        return Object.keys(storage).length;
      },
    },
    key: {
      value(index: number) {
        return Object.keys(storage)[index] ?? null;
      },
    },
    getItem: {
      value(key: string) {
        return Object.hasOwn(storage, key) ? storage[key] : null;
      },
    },
    setItem: {
      value(key: string, value: string) {
        storage[key] = String(value);
      },
    },
    removeItem: {
      value(key: string) {
        delete storage[key];
      },
    },
    clear: {
      value() {
        for (const key of Object.keys(storage)) {
          delete storage[key];
        }
      },
    },
  });
  return storage as Storage;
}

let storage: Storage;

beforeEach(() => {
  clearBodyFixture();
  storage = createStorage();
});

describe('copied-theme admin editor helpers', () => {
  it('builds structured nav config without replacing nav items', () => {
    const next = buildCopiedThemeEditorConfig(
      'nav',
      { items: [{ label: 'Home', href: '/' }], unrelated: true },
      {
        items: [{ label: 'Stale draft should not win', href: '/stale' }],
        presentation: { dropdown_width: '18rem' },
        behavior: { mobile_breakpoint: 820 },
      },
    );
    expect(next.items).toEqual([{ label: 'Home', href: '/' }]);
    expect(next.presentation.dropdown_width).toBe('18rem');
    expect(next.behavior.mobile_breakpoint).toBe(820);
    expect(next.unrelated).toBe(true);
  });

  it('clears only section caches', () => {
    storage.setItem('wl_cache_sections_index', 'cached');
    storage.setItem('wl_cache_sections_about', 'cached');
    storage.setItem('wl_cache_site_config', 'keep');

    expect(clearSectionCaches(storage).sort()).toEqual(['wl_cache_sections_about', 'wl_cache_sections_index']);
    expect(storage.getItem('wl_cache_sections_index')).toBeNull();
    expect(storage.getItem('wl_cache_sections_about')).toBeNull();
    expect(storage.getItem('wl_cache_site_config')).toBe('keep');
  });

  it('PATCHes section config, invalidates caches, and dispatches section refresh events', async () => {
    storage.setItem('wl_cache_sections_index', 'cached');
    const patch = vi.fn().mockResolvedValue([{ id: 96 }]);
    const contentRenderedListener = vi.fn();
    const sectionsChangedListener = vi.fn();
    document.addEventListener('wl-content-rendered', contentRenderedListener);
    document.addEventListener('wl-sections-changed', sectionsChangedListener);

    await saveCopiedThemeSectionConfig(
      96,
      { panels: [{ title: 'Soprano', image_url: '/a.jpg' }] },
      { patch, document, localStorage: storage },
    );

    expect(patch).toHaveBeenCalledWith('sections?id=eq.96', {
      config: { panels: [{ title: 'Soprano', image_url: '/a.jpg' }] },
    });
    expect(storage.getItem('wl_cache_sections_index')).toBeNull();
    expect(sectionsChangedListener).toHaveBeenCalledTimes(1);
    expect(contentRenderedListener).toHaveBeenCalledTimes(1);
  });
});
