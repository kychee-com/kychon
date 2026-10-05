// @vitest-environment happy-dom
// kychon#181 — the hero h1's gradient-clipped text (`background-clip: text` +
// `-webkit-text-fill-color: transparent`) must only apply on plain light
// heroes. On image / brand-scrim heroes it rendered blue-on-blue, ignored
// `color` overrides, and fooled contrast sweeps reading computed `color`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks.ts';
import { bodyFixture } from '../helpers/dom-fixture.js';

const baseCtx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => false,
  currentPath: '/',
};

function heroSection(config: Record<string, unknown>): Section {
  return {
    id: 1,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'hero',
    config,
    position: 1,
    visible: true,
  };
}

interface CssRule {
  selectors: string[];
  body: string;
}

function parseRules(css: string): CssRule[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorText = m[1].trim();
    if (selectorText.startsWith('@')) continue;
    rules.push({ selectors: selectorText.split(',').map((s) => s.trim()), body: m[2] });
  }
  return rules;
}

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function heroH1(config: Record<string, unknown>): HTMLHeadingElement {
  bodyFixture(renderBlock(heroSection(config), baseCtx));
  const h1 = document.querySelector('h1');
  if (!h1) throw new Error('hero rendered no h1');
  return h1 as HTMLHeadingElement;
}

function rulesFor(el: Element): CssRule[] {
  return rules.filter((r) => r.selectors.some((s) => matches(el, s)));
}

const rules = parseRules(readFileSync('src/styles/public.css', 'utf8'));
const isGradientText = (r: CssRule) =>
  /text-fill-color:\s*transparent/.test(r.body) || /background-clip:\s*text/.test(r.body);

describe('hero h1 gradient text is scoped to plain light heroes (kychon#181)', () => {
  it('a plain background-mode hero (no image) keeps the gradient heading', () => {
    const h1 = heroH1({ heading: 'Welcome' });
    expect(rulesFor(h1).some(isGradientText)).toBe(true);
  });

  it('a background-image hero (brand scrim) never matches the gradient-text rule', () => {
    const h1 = heroH1({ heading: 'Welcome', bg_image: '/img/hero.jpg' });
    expect(rulesFor(h1).filter(isGradientText)).toEqual([]);
  });

  it('an image-only background hero (overlay none) never matches the gradient-text rule', () => {
    const h1 = heroH1({ heading: 'Welcome', bg_image: '/img/hero.jpg', overlay: 'none' });
    expect(rulesFor(h1).filter(isGradientText)).toEqual([]);
  });

  it('a foreground hero with text over the image never matches the gradient-text rule', () => {
    const h1 = heroH1({ mode: 'foreground', image_url: '/x.png', heading: 'Hi', text_position: 'over_image' });
    expect(rulesFor(h1).filter(isGradientText)).toEqual([]);
  });

  it('image heroes paint the heading with a solid color that `color` overrides can change', () => {
    for (const cfg of [
      { heading: 'Welcome', bg_image: '/img/hero.jpg' },
      { mode: 'foreground', image_url: '/x.png', heading: 'Hi', text_position: 'over_image' },
    ]) {
      const matched = rulesFor(heroH1(cfg));
      expect(matched.some((r) => /(^|[;\s])color:\s*#fff/.test(r.body))).toBe(true);
      for (const r of matched) {
        const fill = r.body.match(/-webkit-text-fill-color:\s*([^;]+)/);
        if (fill) expect(fill[1].trim()).toBe('currentColor');
      }
    }
  });
});
