import { describe, expect, it } from 'vitest';

import { DEMOS, findMissingDemoStaticAssets } from '../../scripts/deploy-demo';

describe('demo static asset fixtures', () => {
  for (const [key, config] of Object.entries(DEMOS)) {
    it(`${key} ships every /assets reference used by its seed sources`, () => {
      expect(findMissingDemoStaticAssets(config)).toEqual([]);
    });
  }
});
