import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCopiedThemeEditorConfig,
  clearSectionCaches,
  openCopiedThemeEditor,
  saveCopiedThemeSectionConfig,
} from '../../src/lib/admin/copied-theme-editor';

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
  document.body.innerHTML = '';
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

  it('PATCHes section config, invalidates caches, and dispatches wl-content-rendered', async () => {
    storage.setItem('wl_cache_sections_index', 'cached');
    const patch = vi.fn().mockResolvedValue([{ id: 96 }]);
    const listener = vi.fn();
    document.addEventListener('wl-content-rendered', listener);

    await saveCopiedThemeSectionConfig(
      96,
      { panels: [{ title: 'Soprano', image_url: '/a.jpg' }] },
      { patch, document, localStorage: storage },
    );

    expect(patch).toHaveBeenCalledWith('sections?id=eq.96', {
      config: { panels: [{ title: 'Soprano', image_url: '/a.jpg' }] },
    });
    expect(storage.getItem('wl_cache_sections_index')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('copied-theme admin editor UI', () => {
  it('edits image accordion panels through structured config fields', async () => {
    const get = vi.fn().mockResolvedValue([
      {
        id: 96,
        section_type: 'image_accordion',
        config: {
          heading: 'Choirs',
          panels: [{ title: 'Junior', image_url: '/old.jpg', description: 'Old' }],
        },
      },
    ]);
    const patch = vi.fn().mockResolvedValue([{ id: 96 }]);

    await openCopiedThemeEditor(96, { get, patch, showToast: vi.fn(), document, localStorage: storage });

    const title = document.querySelector<HTMLInputElement>('[data-bind="panels.0.title"]');
    if (!title) throw new Error('Missing title field');
    title.value = 'Senior';
    title.dispatchEvent(new Event('input', { bubbles: true }));

    const addPanel = document.querySelector<HTMLButtonElement>('[data-panel-add]');
    if (!addPanel) throw new Error('Missing add panel button');
    addPanel.click();
    const added = document.querySelector<HTMLInputElement>('[data-bind="panels.1.title"]');
    expect(added?.value).toBe('New panel');

    const save = document.querySelector<HTMLButtonElement>('[data-action="save"]');
    if (!save) throw new Error('Missing save button');
    save.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(patch).toHaveBeenCalledWith('sections?id=eq.96', {
      config: expect.objectContaining({
        heading: 'Choirs',
        panels: expect.arrayContaining([
          expect.objectContaining({ title: 'Senior', image_url: '/old.jpg' }),
          expect.objectContaining({ title: 'New panel' }),
        ]),
      }),
    });
    expect(document.querySelector('[data-copied-theme-editor]')).toBeNull();
  });
});
