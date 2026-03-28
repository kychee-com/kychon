import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { featureFlags, defaultNav } from '../fixtures/configs.js';

describe('feature flag permutations', () => {
  function filterNav(navItems, features) {
    return navItems.filter(item => {
      if (item.feature && !features[item.feature]) return false;
      return true;
    });
  }

  function parseFeatureFlags(configRows) {
    const features = {};
    for (const row of configRows) {
      if (row.key.startsWith('feature_')) {
        features[row.key] = row.value === true || row.value === 'true';
      }
    }
    return features;
  }

  it('random feature flag combinations never crash nav rendering', () => {
    fc.assert(
      fc.property(
        // Generate random booleans for each feature flag
        fc.record(Object.fromEntries(featureFlags.map(f => [f, fc.boolean()]))),
        (features) => {
          // This should never throw
          const filtered = filterNav(defaultNav, features);
          // Result should always be an array
          expect(Array.isArray(filtered)).toBe(true);
          // Home (public, no feature flag) should always be present
          expect(filtered.some(i => i.label === 'Home')).toBe(true);
          // All returned items should have valid href
          for (const item of filtered) {
            expect(item.href).toBeTruthy();
            expect(item.label).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('random feature flags produce valid DOM', () => {
    fc.assert(
      fc.property(
        fc.record(Object.fromEntries(featureFlags.map(f => [f, fc.boolean()]))),
        (features) => {
          const container = document.createElement('div');
          const filtered = filterNav(defaultNav, features);
          for (const item of filtered) {
            const a = document.createElement('a');
            a.href = item.href;
            a.textContent = item.label;
            container.appendChild(a);
          }
          // DOM should not throw, container should have at least Home
          expect(container.children.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseFeatureFlags handles all boolean variants', () => {
    const configRows = [
      { key: 'feature_events', value: true },
      { key: 'feature_forum', value: 'true' },
      { key: 'feature_blog', value: false },
      { key: 'feature_directory', value: 'false' },
    ];
    const features = parseFeatureFlags(configRows);
    expect(features.feature_events).toBe(true);
    expect(features.feature_forum).toBe(true);
    expect(features.feature_blog).toBe(false);
    expect(features.feature_directory).toBe(false);
  });
});
