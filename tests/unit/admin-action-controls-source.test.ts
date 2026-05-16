import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks.ts';

const ROOT = process.cwd();
const HELPER = resolve(ROOT, 'src/lib/admin-action-controls.tsx');
const BLOCK_RENDERERS = [
  resolve(ROOT, 'src/lib/blocks.ts'),
  resolve(ROOT, 'src/lib/blocks/embed.ts'),
  resolve(ROOT, 'src/lib/blocks/social-links.tsx'),
];
const ADMIN_EDITOR = resolve(ROOT, 'src/components/AdminEditor.astro');
const ADMIN_ACTION_PROMPT = resolve(ROOT, 'src/components/kychon/AdminActionPromptIsland.tsx');
const ADMIN_INLINE_TEXT_PROMPT = resolve(ROOT, 'src/components/kychon/AdminInlineTextPromptIsland.tsx');
const ADMIN_ZONE_ADD_BUTTON = resolve(ROOT, 'src/components/kychon/AdminZoneAddButton.tsx');
const ADMIN_CSS = resolve(ROOT, 'public/css/admin-editing.css');
const ZONE_GRID_CSS = resolve(ROOT, 'src/styles/zone-grid.css');

const adminCtx: BlockRenderContext = { admin: true, locale: 'en', role: 'admin' };

function section(
  section_type: string,
  config: Record<string, unknown> = {},
  scope: Section['scope'] = 'global',
): Section {
  return {
    id: 7,
    page_slug: 'index',
    zone: 'main',
    scope,
    section_type,
    config,
    position: 1,
    visible: true,
  };
}

describe('admin action controls source', () => {
  it('renders admin action chrome through shared shadcn components', async () => {
    const helper = await readFile(HELPER, 'utf8');

    expect(helper).toContain('@/components/kychon/ui');
    expect(helper).toContain('renderToStaticMarkup');
    expect(helper).toContain('<Button');
    expect(helper).toContain('<Badge');
    expect(helper).toContain('Button');
    expect(helper).toContain('Badge');
    expect(helper).toContain('lucide-react');
    expect(helper).toContain('[&:focus]:opacity-100');
    expect(helper).toContain('[nav:hover_&]:opacity-100');
    expect(helper).toContain('[[data-admin=true]_[data-sortable-group]>[data-sortable-id]:hover>&]:flex');
    expect(helper).toContain('data-section-edit');
    expect(helper).toContain('data-embed-edit');
    expect(helper).toContain('data-section-remove');
    expect(helper).toContain('data-scope-toggle');
    expect(helper).toContain('data-admin-scope-pill');
    expect(helper).not.toContain('<button');
    expect(helper).not.toContain('React.createElement');
    expect(helper).not.toContain('buttonVariants');
    expect(helper).not.toContain('badgeVariants');
  });

  it('keeps old admin primitive classes out of renderers, editor, and CSS', async () => {
    const sources = await Promise.all([
      ...BLOCK_RENDERERS.map((file) => readFile(file, 'utf8')),
      readFile(ADMIN_EDITOR, 'utf8'),
      readFile(ADMIN_CSS, 'utf8'),
    ]);

    for (const source of sources) {
      expect(source).not.toContain('admin-section-btn');
      expect(source).not.toContain('admin-section-edit-btn');
      expect(source).not.toContain('admin-scope-toggle');
      expect(source).not.toContain('admin-toolbar');
      expect(source).not.toContain('admin-zone-add-btn');
      expect(source).not.toContain('admin-nav-edit-btn');
      expect(source).not.toContain('admin-toast');
      expect(source).not.toContain('admin-section-actions');
      expect(source).not.toContain('admin-save-success');
      expect(source).not.toContain('admin-save-error');
      expect(source).not.toMatch(/(?:\.|["' ])admin-drag-handle\b/);
      expect(source).not.toMatch(/(?:\.|["' ])admin-scope-pill\b/);
      expect(source).not.toMatch(/(?:\.|["' ])admin-tooltip-close\b/);
      expect(source).not.toMatch(/(?:\.|["' ])admin-upload-spinner\b/);
      expect(source).not.toContain('admin-promotion-tooltip');
      expect(source).not.toContain('admin-wordmark-hint');
    }
  });

  it('lets rerendered sections update scope pills instead of hand-building them', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');

    expect(editor).not.toContain("from '../lib/admin-action-controls'");
    expect(editor).not.toContain('adminScopePillClass');
    expect(editor).not.toContain("document.createElement('span')");
    expect(editor).not.toContain('badgeVariants');
  });

  it('uses data attributes rather than transient editor state classes', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const styles = await readFile(ADMIN_CSS, 'utf8');

    expect(editor).toContain('dataset.adminTiptapActive');
    expect(editor).toContain('dataset.adminUploading');
    expect(editor).toContain('dataset.adminDragging');
    expect(editor).toContain('document.body.dataset.admin');
    expect(editor).not.toContain("classList.add('admin')");
    expect(editor).not.toContain("classList.contains('admin')");
    expect(editor).not.toContain('body.admin');
    expect(editor).not.toContain("classList.add('uploading')");
    expect(editor).not.toContain("classList.add('dragging')");
    expect(styles).toContain('[data-admin-tiptap-active="true"]');
    expect(styles).toContain('[data-admin-uploading="true"]');
    expect(styles).toContain('[data-admin-dragging="true"]');
    expect(styles).not.toContain('.tiptap-active');
    expect(styles).not.toContain('.uploading');
    expect(styles).not.toContain('.dragging');
    expect(styles).not.toMatch(/\.admin\b/);
    expect(styles).not.toContain('body.admin-dragging');
  });

  it('renders zone add buttons as shadcn buttons instead of inserted DOM primitives', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const component = await readFile(ADMIN_ZONE_ADD_BUTTON, 'utf8');
    const styles = await readFile(ADMIN_CSS, 'utf8');

    expect(component).toContain('@/components/kychon/ui');
    expect(component).toContain('<Button');
    expect(component).toContain('data-admin-zone-add-button');
    expect(component).toContain('data-zone-add');
    expect(component).toContain('[[data-admin=true]_&]:!flex');
    expect(component).not.toContain('body.admin');
    expect(editor).not.toContain('zoneAddButtonClass');
    expect(editor).not.toContain('ensureZoneAddButtons');
    expect(editor).not.toContain('data-admin-zone-add-button');
    expect(editor).toContain('dataset.zoneAdd');
    expect(editor).not.toContain("document.querySelectorAll<HTMLElement>('[data-zone]')");
    expect(editor).not.toContain('admin-zone-add-btn');
    expect(component).not.toContain('admin-zone-add-btn');
    expect(styles).not.toContain('admin-zone-add-btn');
  });

  it('renders drag handles through shared shadcn components instead of inserted DOM primitives', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const helper = await readFile(HELPER, 'utf8');
    const styles = await readFile(ADMIN_CSS, 'utf8');

    expect(helper).toContain('dragHandleButtonClass');
    expect(helper).toContain('Button');
    expect(helper).toContain('adminDragHandleHtml');
    expect(helper).toContain('data-admin-drag-handle');
    expect(helper).toContain("'aria-label': 'Drag to reorder'");
    expect(helper).not.toContain('<button');
    expect(editor).not.toContain('dragHandleButtonClass');
    expect(editor).not.toContain("document.createElement('button')");
    expect(editor).not.toContain('appendChild(handle)');
    expect(editor).toContain('data-admin-drag-handle');
    expect(editor).toContain("document.addEventListener('dragstart'");
    expect(editor).toContain('startDragFromHandle');
    expect(editor).not.toContain("setAttribute('aria-label'");
    expect(editor).not.toContain('bindDragHandle');
    expect(editor).not.toContain('bindSortableHandles');
    expect(editor).not.toContain("document.querySelectorAll<HTMLElement>('[data-admin-drag-handle]')");
    expect(editor).not.toContain('dataset.adminDragBound');
    expect(editor).not.toContain("textContent = '☰'");
    expect(editor).not.toMatch(/(?:\.|["' ])admin-drag-handle\b/);
    expect(styles).not.toMatch(/(?:\.|["' ])admin-drag-handle\b/);
  });

  it('uses a static data-attribute drop indicator instead of creating a CSS primitive', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const adminStyles = await readFile(ADMIN_CSS, 'utf8');
    const zoneGrid = await readFile(ZONE_GRID_CSS, 'utf8');

    expect(editor).toContain('id="admin-editor-drop-indicator"');
    expect(editor).toContain('data-admin-drop-indicator');
    expect(editor).not.toContain("document.createElement('div')");
    expect(editor).not.toContain("className = 'admin-drop-indicator'");
    expect(editor).not.toContain('appendChild(indicator)');
    expect(editor).not.toContain('?.append(indicator)');
    expect(editor).not.toContain('.before(indicator)');
    expect(editor).not.toContain('.after(indicator)');
    expect(editor).not.toContain('replaceWith(draggedEl)');
    expect(editor).toContain('moveIndicatorToEnd');
    expect(editor).toContain('moveNodeBefore');
    expect(editor).toContain('moveNodeAfter');
    expect(editor).toContain('replaceNodeWith');
    expect(editor).toContain('removeNode');
    expect(adminStyles).not.toContain('.admin-drop-indicator');
    expect(zoneGrid).toContain('[data-admin-drop-indicator][data-column-span="1"]');
    expect(zoneGrid).not.toContain('.admin-drop-indicator');
  });

  it('keeps tooltip action buttons on shadcn variants', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const prompt = await readFile(ADMIN_ACTION_PROMPT, 'utf8');
    const styles = await readFile(ADMIN_CSS, 'utf8');

    expect(prompt).toContain('@/components/kychon/ui');
    expect(prompt).toContain('<Card');
    expect(prompt).toContain('<Button');
    expect(editor).toContain('showAdminActionPrompt');
    expect(editor).not.toContain('tip.innerHTML');
    expect(editor).not.toContain('document.body.appendChild(tip)');
    expect(editor).not.toContain('data-admin-tooltip-close');
    expect(editor).not.toMatch(/(?:\.|["' ])admin-tooltip-close\b/);
    expect(prompt).not.toMatch(/(?:\.|["' ])admin-tooltip-close\b/);
    expect(styles).not.toMatch(/(?:\.|["' ])admin-tooltip-close\b/);
  });

  it('routes simple text edits through a shared shadcn prompt island', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const prompt = await readFile(ADMIN_INLINE_TEXT_PROMPT, 'utf8');

    expect(editor).toContain('id="admin-inline-text-root"');
    expect(editor).toContain('AdminInlineTextPromptIsland');
    expect(editor).toContain('ensureAdminInlineTextPrompt');
    expect(editor).toContain('showAdminInlineTextPrompt');
    expect(editor).toContain('promptEditableText');
    expect(editor).toContain('initEditableDelegates');
    expect(editor).toContain('activateEditableText');
    expect(editor).toContain('activateEditableRich');
    expect(editor).toContain('activateEditableImage');
    expect(editor).toContain("closestAdminEditable(event, '[data-editable]')");
    expect(editor).toContain("document.addEventListener('wl-content-rendered', rebindAdminEditableContent)");
    expect(editor).not.toContain("document.querySelectorAll('[data-editable]')");
    expect(editor).not.toContain("document.querySelectorAll('[data-editable-rich]')");
    expect(editor).not.toContain("document.querySelectorAll('[data-editable-image]')");
    expect(editor).not.toContain('MutationObserver');
    expect(editor).not.toContain('contentEditable');
    expect(editor).not.toContain('document.createRange');
    expect(editor).not.toContain('selectNodeContents');
    expect(editor).not.toContain('window.getSelection');
    expect(prompt).toContain('@/components/kychon/ui');
    expect(prompt).toContain('<Dialog');
    expect(prompt).toContain('<Input');
    expect(prompt).toContain('<Label');
    expect(prompt).toContain('<Button');
    expect(prompt).toContain('data-admin-inline-text-prompt');
    expect(prompt).not.toContain('contentEditable');
    expect(prompt).not.toContain('document.createElement');
    expect(prompt).not.toContain('innerHTML');
  });

  it('uses a static image upload input instead of creating file inputs on click', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');

    expect(editor).toContain('id="admin-image-upload-input"');
    expect(editor).toContain('imageUploadInput');
    expect(editor).not.toContain("document.createElement('input')");
  });

  it('uses structured parsing for rich text editing instead of HTML assignment sinks', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');

    expect(editor).toContain('../lib/dom-fragment');
    expect(editor).toContain('serializeHtmlChildren');
    expect(editor).toContain('renderHtmlChildren');
    expect(editor).toContain('clearHtmlChildren');
    expect(editor).not.toContain('new DOMParser()');
    expect(editor).not.toContain('replaceChildren');
    expect(editor).not.toContain('htmlEl.innerHTML');
    expect(editor).not.toContain('innerHTML =');
    expect(editor).not.toContain('insertAdjacentHTML');
  });

  it('renders admin actions with shared variant classes instead of legacy primitives', () => {
    const html = [
      renderBlock(section('custom', { html: '<p>Custom</p>' }), adminCtx),
      renderBlock(section('embed', { provider: 'youtube', params: { video_id: 'abcd1234' } }), adminCtx),
      renderBlock(
        section('social_links', {
          icons: [{ platform: 'website', href: 'https://example.com', label: 'Example', show_label: true }],
        }),
        adminCtx,
      ),
      renderBlock(section('nav', { links: [{ label: 'Home', href: '/' }] }), adminCtx),
    ].join('');

    expect(html).toContain('inline-flex');
    expect(html).toContain('data-section-edit');
    expect(html).toContain('data-embed-edit');
    expect(html).toContain('data-nav-edit');
    expect(html).toContain('data-section-remove');
    expect(html).toContain('data-scope-toggle');
    expect(html).toContain('data-admin-scope-pill');
    expect(html).toContain('lucide-settings');
    expect(html).toContain('lucide-pencil');
    expect(html).toContain('lucide-x');
    expect(html).toContain('lucide-grip-vertical');
    expect(html).not.toContain('admin-section-btn');
    expect(html).not.toContain('admin-section-edit-btn');
    expect(html).not.toContain('admin-scope-toggle');
    expect(html).not.toMatch(/(?:\.|["' ])admin-scope-pill\b/);
  });
});
