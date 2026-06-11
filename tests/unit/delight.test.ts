import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { formatStatValue, parseStatValue } from '../../src/lib/delight';

const root = join(import.meta.dirname, '../..');
const portal = readFileSync(join(root, 'src/layouts/Portal.astro'), 'utf8');
const css = readFileSync(join(root, 'src/styles/public.css'), 'utf8');
const delight = readFileSync(join(root, 'src/lib/delight.ts'), 'utf8');
const marketing = readFileSync(join(root, 'src/components/kychon/MarketingBlocksView.tsx'), 'utf8');

describe('stat value parsing', () => {
  it('parses plain, grouped, and affixed numbers', () => {
    expect(parseStatValue('1200')).toEqual({ prefix: '', value: 1200, suffix: '', grouped: false });
    expect(parseStatValue('1,200+')).toEqual({ prefix: '', value: 1200, suffix: '+', grouped: true });
    expect(parseStatValue('$50')).toEqual({ prefix: '$', value: 50, suffix: '', grouped: false });
    expect(parseStatValue('98%')).toEqual({ prefix: '', value: 98, suffix: '%', grouped: false });
  });

  it('leaves unparseable or zero stats static', () => {
    expect(parseStatValue('24/7')).toBeNull();
    expect(parseStatValue('—')).toBeNull();
    expect(parseStatValue('0')).toBeNull();
  });

  it('formats grouped values with separators', () => {
    expect(formatStatValue(1199.6, true)).toBe('1,200');
    expect(formatStatValue(42.2, false)).toBe('42');
  });
});

describe('delight wiring invariants', () => {
  it('the hidden pre-state is JS-applied, never static CSS on sections', () => {
    // Static CSS may only hide [data-reveal] (set by delight.ts at runtime);
    // a bare [data-section] must never be hidden for no-JS readers.
    expect(css).toContain("[data-reveal] {");
    expect(css).not.toMatch(/\[data-section\][^{]*\{[^}]*opacity:\s*0/);
  });

  it('reduced motion collapses reveal to static', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(delight).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  });

  it('theme.motion none disables and Portal stamps the mode', () => {
    expect(delight).toContain("getAttribute('data-motion') === 'none'");
    expect(portal).toContain("setAttribute('data-motion', motionMode)");
    expect(portal).toContain('initDelight');
  });

  it('in-viewport sections are never hidden (LCP safety)', () => {
    expect(delight).toContain('getBoundingClientRect().top < fold');
  });

  it('stats expose the count-up hook with motion-reduce guards on the lift', () => {
    expect(marketing).toContain('data-stat-value=""');
    expect(marketing).toContain('motion-reduce:transform-none');
  });
});
