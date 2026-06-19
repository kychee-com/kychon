// live-config-coherence (first-paint fidelity): the build-time seed override.
// Tests the pure merge — fetching is the SDK's job and is exercised at deploy.

import { describe, expect, it } from 'vitest';
import { applyLiveConfigOverrides, liveOverridableConfigKeys } from '../../src/lib/build-config';
import type { ProjectSeed } from '../../src/seeds/types';

function seedFixture(): ProjectSeed {
  return {
    site_config: {
      brand_text: 'Seed Brand',
      custom_css: '.seed { color: black; }',
      // Wrapped-entry shape ({ value, category }) — the override must preserve it.
      theme: { value: { primary: '#000', font_body: 'Inter' }, category: 'design' },
      // Not chrome/overridable — must be left untouched.
      languages_enabled: ['en'],
    },
    sections: [],
    pages: [],
  } as unknown as ProjectSeed;
}

function siteConfig(seed: ProjectSeed): Record<string, unknown> {
  return seed.site_config as Record<string, unknown>;
}

describe('liveOverridableConfigKeys', () => {
  it('includes chrome top-level runtime keys and excludes dotted theme sub-fields', () => {
    const keys = liveOverridableConfigKeys();
    expect(keys).toContain('custom_css');
    expect(keys).toContain('theme');
    expect(keys).toContain('brand_text');
    expect(keys).not.toContain('theme.font_heading');
    expect(keys).not.toContain('theme.color_scheme'); // redeploy + dotted
  });
});

describe('applyLiveConfigOverrides', () => {
  it('overrides custom_css and theme from live values (first-paint fidelity)', () => {
    const { seed, overridden } = applyLiveConfigOverrides(seedFixture(), [
      { key: 'custom_css', value: '.live { color: red; }' },
      { key: 'theme', value: { primary: '#f00', font_body: 'Bitter' } },
    ]);
    expect(overridden).toEqual(['custom_css', 'theme']);
    expect(siteConfig(seed).custom_css).toBe('.live { color: red; }');
    // Wrapper preserved, value replaced.
    expect(siteConfig(seed).theme).toEqual({
      value: { primary: '#f00', font_body: 'Bitter' },
      category: 'design',
    });
  });

  it('ignores non-overridable keys (feature flags, languages, unknown rows)', () => {
    const { seed, overridden } = applyLiveConfigOverrides(seedFixture(), [
      { key: 'languages_enabled', value: ['en', 'fr'] },
      { key: 'feature_events', value: false },
    ]);
    expect(overridden).toEqual([]);
    expect(siteConfig(seed).languages_enabled).toEqual(['en']); // untouched
  });

  it('is a graceful no-op when there are no live rows (fetch-failure fallback)', () => {
    const base = seedFixture();
    const { seed, overridden } = applyLiveConfigOverrides(base, []);
    expect(overridden).toEqual([]);
    expect(seed).toBe(base); // same reference — unchanged
  });

  it('skips no-op overrides when live already equals the seed (demo steady state)', () => {
    const base = seedFixture();
    const { seed, overridden } = applyLiveConfigOverrides(base, [
      { key: 'custom_css', value: '.seed { color: black; }' }, // identical to seed
      { key: 'theme', value: { primary: '#000', font_body: 'Inter' } }, // identical (unwrapped)
    ]);
    expect(overridden).toEqual([]);
    expect(seed).toBe(base); // same reference — typed-seed source kind preserved
  });

  it('does not mutate the input seed', () => {
    const base = seedFixture();
    applyLiveConfigOverrides(base, [{ key: 'custom_css', value: '.live {}' }]);
    expect(siteConfig(base).custom_css).toBe('.seed { color: black; }');
  });
});
