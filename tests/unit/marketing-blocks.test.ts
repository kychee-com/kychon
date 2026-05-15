import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };
const MARKETING_VIEW = resolve(process.cwd(), 'src/components/kychon/MarketingBlocksView.tsx');
const BLOCKS = resolve(process.cwd(), 'src/lib/blocks.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');

function makeSection(sectionType: Section['section_type'], config: Record<string, unknown> = {}, id = 41): Section {
  return {
    id,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: sectionType,
    position: 1,
    config,
  };
}

function expectNoLegacyMarketingPrimitives(html: string): void {
  expect(html).not.toContain('class="btn');
  expect(html).not.toContain('class="card');
  expect(html).not.toContain('feature-card');
  expect(html).not.toContain('features-grid');
  expect(html).not.toContain('stat-card');
  expect(html).not.toContain('stats-grid');
  expect(html).not.toContain('card-grid');
  expect(html).not.toContain('ky-text-muted');
  expect(html).not.toContain('section-features');
  expect(html).not.toContain('section-cta');
  expect(html).not.toContain('section-stats');
}

describe('marketing block renderers', () => {
  it.each([
    [
      'features',
      {
        columns: 3,
        items: [{ icon: 'home', title: 'A better home', desc: 'Useful things', cta_text: 'Learn', cta_href: '/learn' }],
      },
    ],
    ['cta', { heading: 'Ready?', text: 'Come in.', cta_text: 'Join', cta_href: '/join' }],
    ['stats', { items: [{ value: '42', label: 'Members', href: '/members' }] }],
    ['testimonials', { items: [{ quote: 'Great community', name: 'A Member', role: 'Lead' }] }],
    ['faq', { items: [{ q: 'Question?', a: 'Answer.' }] }],
  ])('%s renders through the shadcn marketing view without legacy primitives', (sectionType, config) => {
    const html = renderBlock(makeSection(sectionType, config), ctx);
    expect(html).toContain('rounded-lg border');
    expectNoLegacyMarketingPrimitives(html);
  });

  it('preserves admin editable paths for nested marketing config fields', () => {
    const html = renderBlock(
      makeSection('features', {
        items: [
          {
            icon: 'star',
            title: 'Editable title',
            desc: 'Editable description',
            cta_text: 'Edit me',
            cta_href: '/edit',
          },
        ],
      }),
      { ...ctx, admin: true },
    );

    expect(html).toContain('data-editable="sections.41.config.items.0.title"');
    expect(html).toContain('data-editable="sections.41.config.items.0.desc"');
    expect(html).toContain('data-editable="sections.41.config.items.0.cta_text"');
    expect(html).toContain('data-editable-config=');
  });

  it('escapes user-provided text and canonicalizes Kychon links', () => {
    const html = renderBlock(
      makeSection('cta', {
        heading: '<script>alert(1)</script>',
        text: 'Safe copy',
        cta_text: 'Join',
        cta_href: '/join.html',
      }),
      ctx,
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('href="/join"');
  });

  it('keeps the old marketing templates out of the block registry source', async () => {
    const viewSource = await readFile(MARKETING_VIEW, 'utf8');
    const blocksSource = await readFile(BLOCKS, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(viewSource).toContain('@/components/kychon/ui');
    expect(viewSource).toContain('Card');
    expect(viewSource).toContain('Button');
    expect(viewSource).not.toContain('innerHTML');
    expect(viewSource).not.toContain('document.createElement');

    for (const legacy of [
      'feature-card',
      'features-grid',
      'stat-card',
      'stats-grid',
      'card-grid',
      'section-features',
      'section-cta',
      'section-stats',
    ]) {
      expect(blocksSource).not.toContain(legacy);
      expect(styles).not.toContain(`.${legacy}`);
    }
  });
});
