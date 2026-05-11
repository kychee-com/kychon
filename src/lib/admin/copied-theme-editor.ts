export type CopiedThemeEditorType = 'image_accordion' | 'shape_divider' | 'slideshow' | 'nav';

export const COPIED_THEME_EDITOR_TYPES = new Set<CopiedThemeEditorType>([
  'image_accordion',
  'shape_divider',
  'slideshow',
  'nav',
]);

export interface CopiedThemeEditorDeps {
  get: (path: string) => Promise<any[]>;
  patch: (path: string, body: any) => Promise<any>;
  showToast?: (message: string, type?: 'success' | 'error') => void;
  document?: Document;
  localStorage?: Storage;
}

let editorOpen = false;

function docFrom(deps: CopiedThemeEditorDeps): Document {
  return deps.document || document;
}

function storageFrom(deps: CopiedThemeEditorDeps): Storage {
  return deps.localStorage || localStorage;
}

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cloneConfig(value: any): Record<string, any> {
  if (!value || typeof value !== 'object') return {};
  return JSON.parse(JSON.stringify(value));
}

function valueAtPath(obj: any, path: string): any {
  return path.split('.').reduce((cur, key) => {
    if (cur == null) return undefined;
    const index = /^\d+$/.test(key) ? Number(key) : key;
    return cur[index];
  }, obj);
}

function setPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    const nextKey = parts[i + 1];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    cur = cur[key];
  }
  const last = parts[parts.length - 1];
  cur[/^\d+$/.test(last) ? Number(last) : last] = value;
}

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function moveItem(items: any[], from: number, to: number): void {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
}

function optionHtml(value: string, label: string, selected: any): string {
  return `<option value="${escapeHtml(value)}"${String(selected ?? '') === value ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function fieldHtml(
  cfg: Record<string, any>,
  path: string,
  label: string,
  opts: { type?: string; placeholder?: string; step?: string; min?: string; max?: string } = {},
): string {
  const type = opts.type || 'text';
  const value = valueAtPath(cfg, path);
  const attrs = [
    `type="${escapeHtml(type)}"`,
    `data-bind="${escapeHtml(path)}"`,
    `value="${escapeHtml(value ?? '')}"`,
    opts.placeholder ? `placeholder="${escapeHtml(opts.placeholder)}"` : '',
    opts.step ? `step="${escapeHtml(opts.step)}"` : '',
    opts.min ? `min="${escapeHtml(opts.min)}"` : '',
    opts.max ? `max="${escapeHtml(opts.max)}"` : '',
  ].filter(Boolean).join(' ');
  return `<label class="admin-copied-field"><span>${escapeHtml(label)}</span><input ${attrs}></label>`;
}

function textareaHtml(cfg: Record<string, any>, path: string, label: string, rows = 3): string {
  return `<label class="admin-copied-field admin-copied-field--wide"><span>${escapeHtml(label)}</span><textarea data-bind="${escapeHtml(path)}" rows="${rows}">${escapeHtml(valueAtPath(cfg, path) ?? '')}</textarea></label>`;
}

function selectHtml(
  cfg: Record<string, any>,
  path: string,
  label: string,
  options: Array<[string, string]>,
): string {
  const selected = valueAtPath(cfg, path);
  return `
    <label class="admin-copied-field">
      <span>${escapeHtml(label)}</span>
      <select data-bind="${escapeHtml(path)}">
        ${options.map(([value, optionLabel]) => optionHtml(value, optionLabel, selected)).join('')}
      </select>
    </label>
  `;
}

function checkboxHtml(cfg: Record<string, any>, path: string, label: string): string {
  const checked = valueAtPath(cfg, path) === true ? ' checked' : '';
  return `<label class="admin-copied-check"><input type="checkbox" data-bind="${escapeHtml(path)}"${checked}><span>${escapeHtml(label)}</span></label>`;
}

function sectionHtml(title: string, body: string): string {
  return `<fieldset class="admin-copied-group"><legend>${escapeHtml(title)}</legend>${body}</fieldset>`;
}

function renderImageAccordionEditor(cfg: Record<string, any>): string {
  const panels = asArray(cfg.panels);
  const panelHtml = panels.map((_panel, index) => {
    const path = `panels.${index}`;
    return `
      <fieldset class="admin-copied-item" data-panel-index="${index}">
        <legend>Panel ${index + 1}</legend>
        <div class="admin-copied-item__actions">
          <button type="button" class="btn btn-secondary btn-sm" data-panel-move="${index}" data-direction="-1">Up</button>
          <button type="button" class="btn btn-secondary btn-sm" data-panel-move="${index}" data-direction="1">Down</button>
          <button type="button" class="btn btn-secondary btn-sm danger" data-panel-remove="${index}">Remove</button>
        </div>
        <div class="admin-copied-grid">
          ${fieldHtml(cfg, `${path}.title`, 'Title')}
          ${fieldHtml(cfg, `${path}.cta_label`, 'CTA label')}
          ${fieldHtml(cfg, `${path}.href`, 'Link href', { placeholder: '/about' })}
          ${fieldHtml(cfg, `${path}.image_url`, 'Image URL')}
          ${fieldHtml(cfg, `${path}.image_alt`, 'Image alt')}
          ${fieldHtml(cfg, `${path}.object_position`, 'Object position', { placeholder: '50% 50%' })}
          ${selectHtml(cfg, `${path}.fit`, 'Image fit', [['', 'Default'], ['cover', 'Cover'], ['contain', 'Contain']])}
          ${textareaHtml(cfg, `${path}.description`, 'Description', 2)}
        </div>
      </fieldset>
    `;
  }).join('');
  const globalFields = `
    <div class="admin-copied-grid">
      ${fieldHtml(cfg, 'heading', 'Heading')}
      ${fieldHtml(cfg, 'active_ratio', 'Active ratio', { type: 'number', step: '0.1', min: '0.1' })}
      ${fieldHtml(cfg, 'idle_ratio', 'Idle ratio', { type: 'number', step: '0.1', min: '0.1' })}
      ${fieldHtml(cfg, 'overlay_color', 'Overlay color')}
      ${fieldHtml(cfg, 'overlay_opacity', 'Overlay opacity', { type: 'number', step: '0.05', min: '0', max: '1' })}
      ${fieldHtml(cfg, 'reveal_duration', 'Reveal duration', { placeholder: '260ms' })}
      ${selectHtml(cfg, 'mobile_fallback', 'Mobile fallback', [['stack', 'Stack'], ['cards', 'Cards']])}
    </div>
  `;
  return `
    ${sectionHtml('Accordion settings', globalFields)}
    ${sectionHtml('Panels', `<div class="admin-copied-list">${panelHtml}</div><button type="button" class="btn btn-secondary btn-sm" data-panel-add>Add panel</button>`)}
  `;
}

function renderShapeDividerEditor(cfg: Record<string, any>): string {
  const layers = asArray(cfg.layers);
  const layerHtml = layers.map((_layer, index) => {
    const path = `layers.${index}`;
    return `
      <fieldset class="admin-copied-item" data-layer-index="${index}">
        <legend>Layer ${index + 1}</legend>
        <div class="admin-copied-item__actions">
          <button type="button" class="btn btn-secondary btn-sm" data-layer-move="${index}" data-direction="-1">Up</button>
          <button type="button" class="btn btn-secondary btn-sm" data-layer-move="${index}" data-direction="1">Down</button>
          <button type="button" class="btn btn-secondary btn-sm danger" data-layer-remove="${index}">Remove</button>
        </div>
        <div class="admin-copied-grid">
          ${fieldHtml(cfg, `${path}.fill`, 'Fill')}
          ${fieldHtml(cfg, `${path}.opacity`, 'Opacity', { type: 'number', step: '0.05', min: '0', max: '1' })}
          ${fieldHtml(cfg, `${path}.translate_y`, 'Translate Y', { type: 'number', step: '1' })}
          ${textareaHtml(cfg, `${path}.path`, 'Layer path override', 2)}
        </div>
      </fieldset>
    `;
  }).join('');
  return `
    ${sectionHtml('Shape', `
      <div class="admin-copied-grid">
        ${selectHtml(cfg, 'preset', 'Preset', [['wave', 'Wave'], ['tilt', 'Tilt'], ['curve', 'Curve']])}
        ${fieldHtml(cfg, 'height', 'Height', { placeholder: '96px' })}
        ${fieldHtml(cfg, 'view_box', 'View box', { placeholder: '0 0 1440 120' })}
        ${fieldHtml(cfg, 'top_color', 'Top color')}
        ${fieldHtml(cfg, 'bottom_color', 'Bottom color')}
        ${selectHtml(cfg, 'placement', 'Placement', [['between', 'Between sections'], ['top', 'Top'], ['bottom', 'Bottom']])}
        ${checkboxHtml(cfg, 'flip_x', 'Flip horizontally')}
        ${checkboxHtml(cfg, 'flip_y', 'Flip vertically')}
        ${textareaHtml(cfg, 'path', 'Imported SVG path', 3)}
      </div>
    `)}
    ${sectionHtml('Fill layers', `<div class="admin-copied-list">${layerHtml}</div><button type="button" class="btn btn-secondary btn-sm" data-layer-add>Add layer</button>`)}
  `;
}

function renderSlideshowEditor(cfg: Record<string, any>): string {
  const slides = asArray(cfg.items);
  const slideHtml = slides.map((_slide, index) => {
    const path = `items.${index}`;
    return `
      <fieldset class="admin-copied-item" data-slide-index="${index}">
        <legend>Slide ${index + 1}</legend>
        <div class="admin-copied-item__actions">
          <button type="button" class="btn btn-secondary btn-sm" data-slide-move="${index}" data-direction="-1">Up</button>
          <button type="button" class="btn btn-secondary btn-sm" data-slide-move="${index}" data-direction="1">Down</button>
          <button type="button" class="btn btn-secondary btn-sm danger" data-slide-remove="${index}">Remove</button>
        </div>
        <div class="admin-copied-grid">
          ${fieldHtml(cfg, `${path}.src`, 'Image URL')}
          ${fieldHtml(cfg, `${path}.alt`, 'Alt text')}
          ${fieldHtml(cfg, `${path}.href`, 'Link href')}
          ${fieldHtml(cfg, `${path}.object_position`, 'Object position', { placeholder: '50% 50%' })}
          ${selectHtml(cfg, `${path}.fit`, 'Image fit', [['', 'Default'], ['cover', 'Cover'], ['contain', 'Contain']])}
          ${textareaHtml(cfg, `${path}.caption`, 'Caption', 2)}
        </div>
      </fieldset>
    `;
  }).join('');
  return `
    ${sectionHtml('Carousel settings', `
      <div class="admin-copied-grid">
        ${fieldHtml(cfg, 'heading', 'Heading')}
        ${fieldHtml(cfg, 'height', 'Desktop height', { placeholder: '420px' })}
        ${fieldHtml(cfg, 'mobile_height', 'Mobile height', { placeholder: '260px' })}
        ${selectHtml(cfg, 'aspect_ratio', 'Aspect ratio', [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', '1:1'], ['21/9', '21:9']])}
        ${selectHtml(cfg, 'fit', 'Default fit', [['cover', 'Cover'], ['contain', 'Contain']])}
        ${selectHtml(cfg, 'transition', 'Transition', [['fade', 'Fade'], ['slide', 'Slide']])}
        ${fieldHtml(cfg, 'auto_rotate_seconds', 'Autoplay seconds', { type: 'number', step: '0.5', min: '0' })}
        ${fieldHtml(cfg, 'transition_ms', 'Transition ms', { type: 'number', step: '50', min: '0' })}
        ${fieldHtml(cfg, 'transition_easing', 'Transition easing', { placeholder: 'ease-in-out' })}
        ${checkboxHtml(cfg, 'show_arrows', 'Show arrows')}
        ${checkboxHtml(cfg, 'show_dots', 'Show dots')}
        ${checkboxHtml(cfg, 'pause_on_hover', 'Pause on hover')}
        ${checkboxHtml(cfg, 'pause_on_focus', 'Pause on focus')}
        ${checkboxHtml(cfg, 'manual_pause', 'Manual interaction pauses autoplay')}
      </div>
    `)}
    ${sectionHtml('Control styling', `
      <div class="admin-copied-grid">
        ${fieldHtml(cfg, 'arrow_style.background', 'Arrow background')}
        ${fieldHtml(cfg, 'arrow_style.text', 'Arrow text')}
        ${fieldHtml(cfg, 'arrow_style.hover.background', 'Arrow hover background')}
        ${fieldHtml(cfg, 'arrow_style.hover.text', 'Arrow hover text')}
        ${fieldHtml(cfg, 'dot_style.background', 'Dot background')}
        ${fieldHtml(cfg, 'dot_style.active_background', 'Active dot background')}
      </div>
    `)}
    ${sectionHtml('Slides', `<div class="admin-copied-list">${slideHtml}</div><button type="button" class="btn btn-secondary btn-sm" data-slide-add>Add slide</button>`)}
  `;
}

function renderNavSourceEditor(cfg: Record<string, any>): string {
  return `
    ${sectionHtml('Behavior', `
      <div class="admin-copied-grid">
        ${selectHtml(cfg, 'behavior.desktop_open', 'Desktop open', [['', 'Default'], ['hover', 'Hover'], ['click', 'Click'], ['focus', 'Focus']])}
        ${fieldHtml(cfg, 'behavior.mobile_breakpoint', 'Mobile breakpoint', { type: 'number', step: '1', min: '1', placeholder: '768' })}
        ${selectHtml(cfg, 'behavior.mobile_closed_layout', 'Mobile closed layout', [['', 'Default'], ['hidden', 'Hidden'], ['overlay', 'Overlay']])}
        ${selectHtml(cfg, 'behavior.mobile_open_layout', 'Mobile open layout', [['', 'Default'], ['dropdown', 'Dropdown'], ['drawer', 'Drawer'], ['inline', 'Inline']])}
      </div>
    `)}
    ${sectionHtml('Links and dropdowns', `
      <div class="admin-copied-grid">
        ${fieldHtml(cfg, 'presentation.link_color', 'Link color')}
        ${fieldHtml(cfg, 'presentation.link_hover_bg', 'Link hover background')}
        ${fieldHtml(cfg, 'presentation.link_hover_color', 'Link hover color')}
        ${fieldHtml(cfg, 'presentation.link_active_bg', 'Link active background')}
        ${fieldHtml(cfg, 'presentation.link_active_color', 'Link active color')}
        ${fieldHtml(cfg, 'presentation.link_padding', 'Link padding')}
        ${fieldHtml(cfg, 'presentation.link_gap', 'Link gap')}
        ${fieldHtml(cfg, 'presentation.font_family', 'Font family')}
        ${fieldHtml(cfg, 'presentation.font_size', 'Font size')}
        ${fieldHtml(cfg, 'presentation.font_weight', 'Font weight')}
        ${fieldHtml(cfg, 'presentation.dropdown_bg', 'Dropdown background')}
        ${fieldHtml(cfg, 'presentation.dropdown_color', 'Dropdown color')}
        ${fieldHtml(cfg, 'presentation.dropdown_hover_bg', 'Dropdown hover background')}
        ${fieldHtml(cfg, 'presentation.dropdown_hover_color', 'Dropdown hover color')}
        ${fieldHtml(cfg, 'presentation.dropdown_border', 'Dropdown border')}
        ${fieldHtml(cfg, 'presentation.dropdown_shadow', 'Dropdown shadow')}
        ${fieldHtml(cfg, 'presentation.dropdown_width', 'Dropdown width')}
        ${fieldHtml(cfg, 'presentation.dropdown_offset_x', 'Dropdown offset X')}
        ${fieldHtml(cfg, 'presentation.dropdown_offset_y', 'Dropdown offset Y')}
        ${fieldHtml(cfg, 'presentation.chevron_color', 'Chevron color')}
        ${fieldHtml(cfg, 'presentation.transition', 'Transition')}
        ${fieldHtml(cfg, 'presentation.mobile_menu_bg', 'Mobile menu background')}
        ${fieldHtml(cfg, 'presentation.mobile_menu_padding', 'Mobile menu padding')}
      </div>
    `)}
    ${sectionHtml('Interaction fallback', `
      <div class="admin-copied-grid">
        ${fieldHtml(cfg, 'interactions.hover.background', 'Hover background')}
        ${fieldHtml(cfg, 'interactions.hover.text', 'Hover text')}
        ${fieldHtml(cfg, 'interactions.hover.icon', 'Hover icon')}
        ${fieldHtml(cfg, 'interactions.focus.border', 'Focus border')}
        ${fieldHtml(cfg, 'interactions.focus.text', 'Focus text')}
      </div>
    `)}
  `;
}

function renderBody(type: CopiedThemeEditorType, cfg: Record<string, any>): string {
  if (type === 'image_accordion') return renderImageAccordionEditor(cfg);
  if (type === 'shape_divider') return renderShapeDividerEditor(cfg);
  if (type === 'slideshow') return renderSlideshowEditor(cfg);
  return renderNavSourceEditor(cfg);
}

function readInputValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): any {
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked;
  if (el instanceof HTMLInputElement && el.type === 'number') {
    return el.value === '' ? undefined : Number(el.value);
  }
  return el.value;
}

function bindPrimitiveInputs(panel: HTMLElement, cfg: Record<string, any>): void {
  panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-bind]').forEach((el) => {
    const update = () => setPath(cfg, el.dataset.bind || '', readInputValue(el));
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });
}

function defaultPanel(): Record<string, any> {
  return {
    image_url: '',
    image_alt: '',
    title: 'New panel',
    description: '',
    cta_label: '',
    href: '',
    fit: 'cover',
    object_position: 'center',
  };
}

function defaultLayer(): Record<string, any> {
  return { fill: 'var(--shape-bottom-color)', opacity: 1, translate_y: 0 };
}

function defaultSlide(): Record<string, any> {
  return { src: '', alt: 'New slide', caption: '', href: '', fit: '', object_position: 'center' };
}

function bindArrayActions(type: CopiedThemeEditorType, panel: HTMLElement, cfg: Record<string, any>, render: () => void): void {
  if (type === 'image_accordion') {
    panel.querySelector('[data-panel-add]')?.addEventListener('click', () => {
      cfg.panels = asArray(cfg.panels);
      cfg.panels.push(defaultPanel());
      render();
    });
    panel.querySelectorAll<HTMLElement>('[data-panel-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        asArray(cfg.panels).splice(Number(btn.dataset.panelRemove), 1);
        render();
      });
    });
    panel.querySelectorAll<HTMLElement>('[data-panel-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const from = Number(btn.dataset.panelMove);
        moveItem(asArray(cfg.panels), from, from + Number(btn.dataset.direction || 0));
        render();
      });
    });
    return;
  }
  if (type === 'shape_divider') {
    panel.querySelector('[data-layer-add]')?.addEventListener('click', () => {
      cfg.layers = asArray(cfg.layers);
      cfg.layers.push(defaultLayer());
      render();
    });
    panel.querySelectorAll<HTMLElement>('[data-layer-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        asArray(cfg.layers).splice(Number(btn.dataset.layerRemove), 1);
        render();
      });
    });
    panel.querySelectorAll<HTMLElement>('[data-layer-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const from = Number(btn.dataset.layerMove);
        moveItem(asArray(cfg.layers), from, from + Number(btn.dataset.direction || 0));
        render();
      });
    });
    return;
  }
  if (type === 'slideshow') {
    panel.querySelector('[data-slide-add]')?.addEventListener('click', () => {
      cfg.items = asArray(cfg.items);
      cfg.items.push(defaultSlide());
      render();
    });
    panel.querySelectorAll<HTMLElement>('[data-slide-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        asArray(cfg.items).splice(Number(btn.dataset.slideRemove), 1);
        render();
      });
    });
    panel.querySelectorAll<HTMLElement>('[data-slide-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const from = Number(btn.dataset.slideMove);
        moveItem(asArray(cfg.items), from, from + Number(btn.dataset.direction || 0));
        render();
      });
    });
  }
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
  deps: Pick<CopiedThemeEditorDeps, 'patch' | 'document' | 'localStorage'>,
): Promise<void> {
  await deps.patch(`sections?id=eq.${sectionId}`, { config });
  clearSectionCaches(storageFrom(deps as CopiedThemeEditorDeps));
  docFrom(deps as CopiedThemeEditorDeps).dispatchEvent(new CustomEvent('wl-content-rendered'));
}

export async function openCopiedThemeEditor(sectionId: number, deps: CopiedThemeEditorDeps): Promise<void> {
  if (editorOpen) return;
  const doc = docFrom(deps);
  let row: any = null;
  try {
    const rows = await deps.get(`sections?id=eq.${sectionId}`);
    row = rows[0];
  } catch (err) {
    console.error('Failed to load copied-theme block:', err);
    deps.showToast?.('Could not load block', 'error');
    return;
  }
  const type = row?.section_type as CopiedThemeEditorType | undefined;
  if (!row || !type || !COPIED_THEME_EDITOR_TYPES.has(type)) {
    deps.showToast?.('No source settings for this block', 'error');
    return;
  }

  editorOpen = true;
  const draft = cloneConfig(row.config);
  if (type === 'image_accordion') draft.panels = asArray(draft.panels);
  if (type === 'shape_divider') draft.layers = asArray(draft.layers);
  if (type === 'slideshow') draft.items = asArray(draft.items);

  const backdrop = doc.createElement('div');
  backdrop.className = 'admin-popover-backdrop';
  const panel = doc.createElement('div');
  panel.className = 'admin-popover admin-copied-theme-editor';
  panel.dataset.copiedThemeEditor = type;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Source fidelity settings');

  const close = () => {
    panel.remove();
    backdrop.remove();
    editorOpen = false;
  };

  const render = () => {
    panel.innerHTML = `
      <div class="admin-copied-header">
        <h3>Source settings</h3>
        <div class="admin-copied-actions">
          <button class="btn btn-primary btn-sm" type="button" data-action="save">Save</button>
          <button class="btn btn-secondary btn-sm" type="button" data-action="cancel">Cancel</button>
        </div>
      </div>
      <p class="admin-copied-subtitle">${escapeHtml(row.section_type)} block</p>
      <div class="admin-copied-body">${renderBody(type, draft)}</div>
    `;
    bindPrimitiveInputs(panel, draft);
    bindArrayActions(type, panel, draft, render);
    panel.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
    panel.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
      const nextConfig = buildCopiedThemeEditorConfig(type, row.config || {}, draft);
      try {
        await saveCopiedThemeSectionConfig(sectionId, nextConfig, deps);
        deps.showToast?.('Source settings saved');
        close();
      } catch (err) {
        console.error('Source settings save failed:', err);
        deps.showToast?.('Save failed', 'error');
      }
    });
  };

  backdrop.addEventListener('click', close);
  doc.body.appendChild(backdrop);
  doc.body.appendChild(panel);
  render();
}
