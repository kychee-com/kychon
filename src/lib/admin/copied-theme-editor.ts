export type CopiedThemeEditorType = 'image_accordion' | 'shape_divider' | 'slideshow' | 'nav';

export const COPIED_THEME_EDITOR_TYPES = new Set<CopiedThemeEditorType>([
  'image_accordion',
  'shape_divider',
  'slideshow',
  'nav',
]);

function cloneConfig(value: any): Record<string, any> {
  if (!value || typeof value !== 'object') return {};
  return JSON.parse(JSON.stringify(value));
}

export function buildCopiedThemeEditorConfig(
  type: CopiedThemeEditorType,
  currentConfig: Record<string, any>,
  draft: Record<string, any>,
): Record<string, any> {
  const current = cloneConfig(currentConfig);
  if (type === 'nav') {
    return {
      ...current,
      presentation: cloneConfig(draft.presentation),
      behavior: cloneConfig(draft.behavior),
      interactions: cloneConfig(draft.interactions),
    };
  }
  return { ...current, ...cloneConfig(draft) };
}

export function clearSectionCaches(storage: Storage = localStorage): string[] {
  const removed: string[] = [];
  Object.keys(storage)
    .filter((key) => key.startsWith('wl_cache_sections_'))
    .forEach((key) => {
      storage.removeItem(key);
      removed.push(key);
    });
  return removed;
}

export async function saveCopiedThemeSectionConfig(
  sectionId: number,
  config: Record<string, any>,
  deps: {
    patch: (path: string, body: any) => Promise<any>;
    document?: Document;
    localStorage?: Storage;
  },
): Promise<void> {
  await deps.patch(`sections?id=eq.${sectionId}`, { config });
  clearSectionCaches(deps.localStorage || localStorage);
  const doc = deps.document || document;
  doc.dispatchEvent(new CustomEvent('wl-sections-changed'));
  doc.dispatchEvent(new CustomEvent('wl-content-rendered'));
}
