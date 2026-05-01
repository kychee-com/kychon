import { describe, expect, it } from 'vitest';

import {
  applyColumnSpan,
  BLOCK_TYPES,
  type BlockRenderContext,
  type ColumnSpan,
  getSupportedSpans,
  renderBlock,
  type Section,
} from '../../src/lib/blocks';

const ALL_SPANS: ColumnSpan[] = ['1', '1/2', '1/3', '2/3'];

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => true,
  currentPath: '/',
  siteName: 'Test',
  logoUrl: '',
};

function makeSection(type: string, span?: ColumnSpan): Section {
  return {
    id: 1,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: type,
    config: BLOCK_TYPES[type]?.defaultConfig ?? {},
    position: 1,
    visible: true,
    column_span: span,
  };
}

describe('applyColumnSpan', () => {
  it('attaches data-column-span to a leading section tag', () => {
    expect(applyColumnSpan('<section class="x">body</section>', '1/2')).toContain('data-column-span="1/2"');
  });

  it('attaches the attribute even when leading whitespace is present', () => {
    const out = applyColumnSpan('   <div>x</div>', '1/3');
    expect(out).toContain('data-column-span="1/3"');
  });

  it('handles self-closing tags', () => {
    const out = applyColumnSpan('<img src="x" />', '2/3');
    expect(out).toContain('data-column-span="2/3"');
  });

  it('no-ops on input without a leading tag', () => {
    expect(applyColumnSpan('just text', '1/2')).toBe('just text');
  });
});

describe('renderBlock column span', () => {
  it('attaches data-column-span="1" by default to every registered block', () => {
    for (const type of Object.keys(BLOCK_TYPES)) {
      const html = renderBlock(makeSection(type), ctx);
      if (html === '') continue; // unknown / hidden — skip
      expect(html, `block ${type} should carry data-column-span="1" by default`).toContain('data-column-span="1"');
    }
  });

  it('propagates an explicit span to every registered block whose render emits HTML', () => {
    for (const type of Object.keys(BLOCK_TYPES)) {
      const html = renderBlock(makeSection(type, '1/2'), ctx);
      if (html === '') continue;
      // Renderers that emit multiple top-level elements (e.g. nav) only get
      // the attribute on the first; that's still enough for the grid.
      expect(html, `block ${type} should propagate column_span="1/2"`).toContain('data-column-span="1/2"');
    }
  });
});

describe('getSupportedSpans', () => {
  it('returns the BlockType.supportedSpans when set', () => {
    // hero declares ['1'] explicitly per the column-span-rows classification.
    if (BLOCK_TYPES.hero?.supportedSpans) {
      expect(getSupportedSpans('hero')).toEqual(BLOCK_TYPES.hero.supportedSpans);
    }
  });

  it('falls back to all four spans when supportedSpans is undefined', () => {
    expect(getSupportedSpans('does_not_exist')).toEqual(ALL_SPANS);
  });
});
