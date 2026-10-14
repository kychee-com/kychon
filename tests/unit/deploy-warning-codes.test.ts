/**
 * runDeploy can acknowledge specific confirmation-required warning codes
 * instead of every warning. A temp-host cut-over leaves the release record
 * naming the released temporary subdomain, so the next deploy's plan flags a
 * DESTRUCTIVE_SUBDOMAIN_REMOVAL (run402#626); approving that one code must not
 * also wave through any other blocking warning.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('runDeploy warning-code approvals', () => {
  const lib = readFileSync(join(import.meta.dirname, '../../scripts/_lib.ts'), 'utf8');

  it('declares allowWarningCodes on RunDeployOptions', () => {
    expect(lib).toMatch(/allowWarningCodes\?: readonly string\[\];/);
  });

  it('passes the codes to apply only when allowWarnings is off', () => {
    expect(lib).toMatch(
      /\} else if \(opts\.allowWarningCodes\?\.length\) \{\s+applyOptions\.allowWarningCodes = \[\.\.\.opts\.allowWarningCodes\];/,
    );
  });

  it('refuses warning-code approvals alongside a reviewed plan', () => {
    expect(lib).toContain('if (opts.requiredPlan && (opts.allowWarnings || opts.allowWarningCodes?.length)) {');
  });
});
