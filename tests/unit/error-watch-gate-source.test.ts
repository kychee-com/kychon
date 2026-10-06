import { describe, expect, it } from 'vitest';

import {
  classifyErrorWatchOutcome,
  errorWatchCanStopEarly,
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

describe('errorWatchCanStopEarly — adaptive clean exit', () => {
  const base = { elapsedSeconds: 60, invocations: 20, newFingerprints: 0, minSeconds: 60, minInvocations: 20 };

  it('stops once the minimum time and traffic are both met with zero new fingerprints', () => {
    expect(errorWatchCanStopEarly(base)).toBe(true);
    expect(errorWatchCanStopEarly({ ...base, elapsedSeconds: 75, invocations: 116 })).toBe(true);
  });

  it('keeps watching before the minimum time, even with plenty of traffic', () => {
    expect(errorWatchCanStopEarly({ ...base, elapsedSeconds: 30, invocations: 500 })).toBe(false);
  });

  it('keeps watching while traffic is below the minimum — 0-over-0 is never health', () => {
    expect(errorWatchCanStopEarly({ ...base, elapsedSeconds: 290, invocations: 0 })).toBe(false);
    expect(errorWatchCanStopEarly({ ...base, elapsedSeconds: 120, invocations: 19 })).toBe(false);
  });

  it('never stops early as clean when a new fingerprint exists', () => {
    expect(errorWatchCanStopEarly({ ...base, elapsedSeconds: 200, invocations: 200, newFingerprints: 1 })).toBe(false);
  });

  it('minSeconds <= 0 or minInvocations <= 0 still requires the other bound', () => {
    expect(errorWatchCanStopEarly({ ...base, minSeconds: 0, elapsedSeconds: 0, invocations: 20 })).toBe(true);
    expect(errorWatchCanStopEarly({ ...base, minInvocations: 0, invocations: 0 })).toBe(true);
  });
});
