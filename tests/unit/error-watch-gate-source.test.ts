import { describe, expect, it } from 'vitest';

import {
  classifyErrorWatchOutcome,
  pickErrorCommand,
  pickErrorSampleId,
  renderErrorVerdict,
  renderNewFingerprintFailure,
} from '../../scripts/_lib.ts';

/**
 * Guards the load-bearing exit-code contract of the post-deploy error gate
 * (run402 release-error-rollup). The pure decision + render helpers are tested
 * here without a network; `watchReleaseErrors` itself calls process.exit and is
 * exercised only in real deploys.
 */
describe('classifyErrorWatchOutcome — gate exit-code contract', () => {
  it('new fingerprints ⇒ "new" (fail fast, exit 1) even before any clean verdict', () => {
    expect(classifyErrorWatchOutcome({ anyVerdict: true, newFingerprints: 3 })).toBe('new');
    // newFingerprints>0 wins regardless of anyVerdict.
    expect(classifyErrorWatchOutcome({ anyVerdict: false, newFingerprints: 1 })).toBe('new');
  });

  it('no verdict ever produced ⇒ "unavailable" (outage is NOT a pass, exit 2)', () => {
    expect(classifyErrorWatchOutcome({ anyVerdict: false, newFingerprints: 0 })).toBe('unavailable');
  });

  it('at least one verdict, zero new ⇒ "clean" (continue)', () => {
    expect(classifyErrorWatchOutcome({ anyVerdict: true, newFingerprints: 0 })).toBe('clean');
  });
});

describe('error fingerprint field extraction', () => {
  const row = {
    fingerprint_id: 'fp_9b21fa',
    kind: 'uncaught',
    count: 12,
    error_name: 'ReferenceError',
    message_template: 'db is not defined',
    function: 'check-expirations',
    samples: {
      first: { id: 'req_first' },
      recent: [{ id: 'req_recent0' }, { id: 'req_recent1' }],
    },
    next_actions: [{ type: 'fetch_logs', command: 'run402 logs check-expirations --request-id req_recent0' }],
  };

  it('prefers the newest recent sample id, falling back to first', () => {
    expect(pickErrorSampleId(row)).toBe('req_recent0');
    expect(pickErrorSampleId({ samples: { first: { id: 'req_first' }, recent: [] } })).toBe('req_first');
    expect(pickErrorSampleId({})).toBeNull();
  });

  it('extracts the runnable next_actions command', () => {
    expect(pickErrorCommand(row)).toBe('run402 logs check-expirations --request-id req_recent0');
    expect(pickErrorCommand({ next_actions: [{ type: 'other' }] })).toBeNull();
    expect(pickErrorCommand({})).toBeNull();
  });

  it('failure render includes every actionable field', () => {
    const out = renderNewFingerprintFailure({ verdict: { new_fingerprints: 1 }, errors: [row] }, 'rel_ABC');
    expect(out).toContain('FAIL');
    expect(out).toContain('rel_ABC');
    expect(out).toContain('fp_9b21fa');
    expect(out).toContain('uncaught');
    expect(out).toContain('ReferenceError');
    expect(out).toContain('db is not defined');
    expect(out).toContain('req_recent0');
    expect(out).toContain('run402 logs check-expirations --request-id req_recent0');
  });

  it('clean verdict render surfaces invocations_in_window so 0-over-0 is visible', () => {
    const out = renderErrorVerdict(
      {
        new_fingerprints: 0,
        recurring_fingerprints: 2,
        invocations_in_window: 0,
        coverage: { full_fidelity_functions: 5, coarse_functions: 0 },
      },
      'rel_ABC',
    );
    expect(out).toContain('PASS');
    expect(out).toContain('invocations_in_window=0');
  });
});
