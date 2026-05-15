import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const BLOCKS = resolve(process.cwd(), 'src/lib/blocks.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');
const ctx: BlockRenderContext = { admin: true, locale: 'en', isFeatureEnabled: () => true };

function section(sectionType: string, config: Record<string, unknown>): Section {
  return {
    id: 91,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: sectionType,
    position: 1,
    config,
  };
}

describe('legacy static UI primitives', () => {
  it('renders empty placeholders with token classes instead of ky-text-muted', () => {
    const accordion = renderBlock(section('image_accordion', { panels: [] }), ctx);
    const slideshow = renderBlock(section('slideshow', { items: [] }), ctx);

    expect(accordion).toContain('text-muted-foreground');
    expect(slideshow).toContain('text-muted-foreground');
    expect(accordion).not.toContain('ky-text-muted');
    expect(slideshow).not.toContain('ky-text-muted');
  });

  it('renders the event calendar placeholder without the old skeleton primitive class', () => {
    const html = renderBlock(section('events_calendar', {}), ctx);

    expect(html).toContain('block-events-calendar__skeleton');
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('event-skeleton-card');
    expect(html).not.toContain(' skeleton');
  });

  it('keeps retired primitive CSS out of source', async () => {
    const blocks = await readFile(BLOCKS, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(blocks).not.toContain('ky-text-muted');
    expect(blocks).not.toContain('event-skeleton-card');
    expect(blocks).not.toContain(' skeleton"></div>');
    expect(styles).not.toMatch(/\.ky-text-muted\b/);
    expect(styles).not.toMatch(/\.skeleton(?:[.{:#\s-]|$)/);
    expect(styles).not.toContain('skeleton-pulse');
  });
});
