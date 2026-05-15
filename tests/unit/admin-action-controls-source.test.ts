import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks.ts';

const ROOT = process.cwd();
const HELPER = resolve(ROOT, 'src/lib/admin-action-controls.ts');
const BLOCK_RENDERERS = [
  resolve(ROOT, 'src/lib/blocks.ts'),
  resolve(ROOT, 'src/lib/blocks/embed.ts'),
  resolve(ROOT, 'src/lib/blocks/social-links.ts'),
];
const ADMIN_EDITOR = resolve(ROOT, 'src/components/AdminEditor.astro');
const ADMIN_ZONE_ADD_BUTTON = resolve(ROOT, 'src/components/kychon/AdminZoneAddButton.tsx');
const ADMIN_CSS = resolve(ROOT, 'public/css/admin-editing.css');

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
  it('renders admin action chrome through shadcn variants', async () => {
    const helper = await readFile(HELPER, 'utf8');

    expect(helper).toContain('@/components/kychon/ui');
    expect(helper).toContain('buttonVariants');
    expect(helper).toContain('badgeVariants');
    expect(helper).toContain('data-section-edit');
    expect(helper).toContain('data-embed-edit');
    expect(helper).toContain('data-section-remove');
    expect(helper).toContain('data-scope-toggle');
    expect(helper).toContain('data-admin-scope-pill');
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
      expect(source).not.toMatch(/(?:\.|["' ])admin-drag-handle\b/);
      expect(source).not.toMatch(/(?:\.|["' ])admin-scope-pill\b/);
      expect(source).not.toMatch(/(?:\.|["' ])admin-tooltip-close\b/);
      expect(source).not.toMatch(/(?:\.|["' ])admin-upload-spinner\b/);
    }
  });

  it('lets rerendered sections update scope pills instead of hand-building them', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');

    expect(editor).not.toContain("from '../lib/admin-action-controls'");
    expect(editor).not.toContain('adminScopePillClass');
    expect(editor).not.toContain("document.createElement('span')");
    expect(editor).not.toContain('badgeVariants');
  });

  it('renders zone add buttons as shadcn buttons instead of inserted DOM primitives', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const component = await readFile(ADMIN_ZONE_ADD_BUTTON, 'utf8');
    const styles = await readFile(ADMIN_CSS, 'utf8');

    expect(component).toContain('@/components/kychon/ui');
    expect(component).toContain('<Button');
    expect(component).toContain('data-admin-zone-add-button');
    expect(component).toContain('data-zone-add');
    expect(component).toContain('[body.admin_&]:!flex');
    expect(editor).not.toContain('zoneAddButtonClass');
    expect(editor).not.toContain('ensureZoneAddButtons');
    expect(editor).not.toContain('data-admin-zone-add-button');
    expect(editor).toContain('dataset.zoneAdd');
    expect(editor).not.toContain("document.querySelectorAll<HTMLElement>('[data-zone]')");
    expect(editor).not.toContain('admin-zone-add-btn');
    expect(component).not.toContain('admin-zone-add-btn');
    expect(styles).not.toContain('admin-zone-add-btn');
  });

  it('keeps dynamically inserted drag handles on shadcn variants', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const styles = await readFile(ADMIN_CSS, 'utf8');

    expect(editor).toContain('dragHandleButtonClass');
    expect(editor).toContain('data-admin-drag-handle');
    expect(editor).toContain('aria-label');
    expect(editor).not.toMatch(/(?:\.|["' ])admin-drag-handle\b/);
    expect(styles).not.toMatch(/(?:\.|["' ])admin-drag-handle\b/);
  });

  it('keeps tooltip action buttons on shadcn variants', async () => {
    const editor = await readFile(ADMIN_EDITOR, 'utf8');
    const styles = await readFile(ADMIN_CSS, 'utf8');

    expect(editor).toContain('tooltipPrimaryButtonClass');
    expect(editor).toContain('tooltipCloseButtonClass');
    expect(editor).toContain('data-admin-tooltip-close');
    expect(editor).not.toMatch(/(?:\.|["' ])admin-tooltip-close\b/);
    expect(styles).not.toMatch(/(?:\.|["' ])admin-tooltip-close\b/);
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
    expect(html).not.toContain('admin-section-btn');
    expect(html).not.toContain('admin-section-edit-btn');
    expect(html).not.toContain('admin-scope-toggle');
    expect(html).not.toMatch(/(?:\.|["' ])admin-scope-pill\b/);
  });
});
