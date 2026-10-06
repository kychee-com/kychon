import { describe, expect, it } from 'vitest';

import { gatewayFunctionChanges } from '../../scripts/_lib.ts';

describe('gatewayFunctionChanges', () => {
  it('counts only what the gateway redeploys, not the size of a replace spec', () => {
    // A CI `functions.replace` sends all 13; the gateway changed one.
    const diff = { functions: { added: [], removed: [], changed: [{ name: 'ssr', fields_changed: ['code_hash'] }] } };
    expect(gatewayFunctionChanges(diff, 13)).toEqual({ changed: 1, skipped: 12, names: ['ssr'] });
  });

  it('counts added functions as redeployed and dedupes names', () => {
    const diff = {
      functions: {
        added: ['reset-demo'],
        removed: ['old-fn'],
        changed: [{ name: 'kychon-api' }, { name: 'reset-demo' }],
      },
    };
    expect(gatewayFunctionChanges(diff, 13)).toEqual({ changed: 2, skipped: 11, names: ['kychon-api', 'reset-demo'] });
  });

  it('returns null when the diff has no functions bucket', () => {
    expect(gatewayFunctionChanges(undefined, 13)).toBeNull();
    expect(gatewayFunctionChanges({}, 13)).toBeNull();
  });
});
