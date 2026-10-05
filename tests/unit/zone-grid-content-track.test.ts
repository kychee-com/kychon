// Regression: kychee-com/kychon#193 (dup #174) — half-width main-zone sections
// bled to the viewport edges. `#sections` is full-bleed, so a `1/2` cell was
// half the viewport and its text started at the viewport's left edge, while a
// `1` block's constrained container was centered at `--max-width`. Partial
// spans must sit in the same centered `--max-width` content track; full spans
// must still break out to full bleed (hero, page_banner, backgrounds).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src/styles/zone-grid.css');
const PUBLIC_COPY = resolve(process.cwd(), 'public/css/zone-grid.css');

interface Rule {
  selectors: string[];
  decls: Record<string, string>;
}

/** Minimal parser for top-level (non-@media) rules. */
function topLevelRules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  let depth = 0;
  let buf = '';
  let inAtRule = false;
  for (const ch of text) {
    if (ch === '{') {
      if (depth === 0) {
        inAtRule = buf.trim().startsWith('@');
        if (!inAtRule) {
          rules.push({
            selectors: buf
              .split(',')
              .map((s) => s.trim().replace(/\s+/g, ' '))
              .filter(Boolean),
            decls: {},
          });
        }
      }
      depth++;
      buf = '';
    } else if (ch === '}') {
      if (depth === 1 && !inAtRule) {
        const rule = rules[rules.length - 1];
        for (const decl of buf.split(';')) {
          const idx = decl.indexOf(':');
          if (idx > 0) rule.decls[decl.slice(0, idx).trim()] = decl.slice(idx + 1).trim();
        }
      }
      depth--;
      buf = '';
    } else {
      buf += ch;
    }
  }
  return rules;
}

function declsFor(rules: Rule[], selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rules) {
    if (rule.selectors.includes(selector)) Object.assign(out, rule.decls);
  }
  return out;
}

const css = readFileSync(SRC, 'utf8');
const rules = topLevelRules(css);

describe('zone-grid main-zone content track (#193)', () => {
  it('insets the #sections grid columns to a centered --max-width track', () => {
    const sections = declsFor(rules, '#sections');
    expect(sections['padding-inline']).toBeDefined();
    const padding = sections['padding-inline'];
    // Percentage padding resolves against #main-content's width (scrollbar-safe).
    expect(padding).toMatch(/max\(\s*0(px)?\s*,\s*calc\(\s*\(\s*100%\s*-\s*var\(--max-width\)\s*\)\s*\/\s*2\s*\)\s*\)/);
  });

  it('applies no containment to ancestors of blocks (keeps position: fixed viewport-relative)', () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/container-type|container\s*:|\bcontain\s*:|cqi|cqw/);
    for (const sel of ['#main-content', '#sections']) {
      const decls = declsFor(rules, sel);
      expect(decls['container-type'], sel).toBeUndefined();
      expect(decls.container, sel).toBeUndefined();
      expect(decls.contain, sel).toBeUndefined();
      // overflow other than clip would create a scroll container (breaks sticky).
      for (const prop of ['overflow', 'overflow-x', 'overflow-y']) {
        if (decls[prop] !== undefined) expect(decls[prop], `${sel} ${prop}`).toBe('clip');
      }
    }
  });

  it('breaks full-span main-zone blocks back out to full bleed', () => {
    for (const sel of [
      '#sections > [data-column-span="1"]',
      '#sections > [data-react-html-children] > [data-column-span="1"]',
    ]) {
      const decls = declsFor(rules, sel);
      expect(decls['margin-inline'], sel).toMatch(
        /min\(\s*0(px)?\s*,\s*calc\(\s*\(\s*var\(--max-width\)\s*-\s*100vw\s*\)\s*\/\s*2\s*\)\s*\)/,
      );
    }
    // The half-scrollbar overhang of a 100vw breakout is clipped without a scroll container.
    expect(declsFor(rules, '#main-content')['overflow-x']).toBe('clip');
  });

  it('keeps partial spans inside the content track', () => {
    for (const span of ['1/2', '1/3', '2/3']) {
      for (const sel of [
        `#sections > [data-column-span="${span}"]`,
        `#sections > [data-react-html-children] > [data-column-span="${span}"]`,
      ]) {
        expect(declsFor(rules, sel)['margin-inline'], sel).toBeUndefined();
      }
    }
  });

  it('leaves the footer zone host (already a constrained container) without breakout', () => {
    const footerFull = declsFor(rules, '[data-zone="footer"] > [data-layout-container] > [data-column-span="1"]');
    expect(footerFull['margin-inline']).toBeUndefined();
  });

  it('keeps the public/css copy in sync with src/styles', () => {
    expect(readFileSync(PUBLIC_COPY, 'utf8')).toBe(css);
  });
});
