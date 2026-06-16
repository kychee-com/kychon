import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '../../src/lib/blocks';
import { utilityHeaderPreset } from '../../src/lib/header-presets';
import { listPortPatterns, PORT_PATTERNS, resolvePortPattern } from '../../src/lib/port-patterns';

describe('port-pattern coverage registry (#124/#123/#99/#91)', () => {
  it('grounds every referenced block in BLOCK_TYPES (no fossils)', () => {
    for (const entry of PORT_PATTERNS) {
      expect(entry.blocks.length).toBeGreaterThan(0);
      for (const block of entry.blocks) {
        expect(BLOCK_TYPES[block], `pattern ${entry.pattern} references unregistered block ${block}`).toBeDefined();
      }
    }
  });

  it('lists the new port patterns as covered', () => {
    const patterns = listPortPatterns().map((entry) => entry.pattern);
    expect(patterns).toEqual(expect.arrayContaining(['homepage_panels', 'menu', 'utility_header', 'member_login']));
  });

  it('resolves a supported pattern to its covering block(s)', () => {
    expect(resolvePortPattern('menu')).toMatchObject({ supported: true, blocks: ['menu'] });
    expect(resolvePortPattern('utility_header')).toMatchObject({
      supported: true,
      blocks: ['utility_bar', 'social_row', 'safety_cta'],
    });
  });

  it('reports an unknown source pattern as unsupported so the porter records a fallback', () => {
    expect(resolvePortPattern('legacy_flash_widget')).toEqual({
      pattern: 'legacy_flash_widget',
      supported: false,
      blocks: [],
    });
  });
});

describe('utility header preset (#99)', () => {
  it('composes a coordinated header cluster from registered blocks in order', () => {
    const preset = utilityHeaderPreset();
    expect(preset.map((s) => s.section_type)).toEqual([
      'utility_bar',
      'brand_header',
      'nav',
      'site_search',
      'social_row',
      'safety_cta',
      'sign_in_bar',
    ]);
    for (const s of preset) {
      expect(s.zone).toBe('header');
      expect(BLOCK_TYPES[s.section_type], `preset references unregistered block ${s.section_type}`).toBeDefined();
    }
    const positions = preset.map((s) => s.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(positions).size).toBe(positions.length);
  });
});
