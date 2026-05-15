import { afterEach, describe, expect, it } from 'vitest';

import { resolveDeployTarget } from '../../scripts/_lib.ts';

const ORIGINAL_ENV = { ...process.env };
const run402Stub = {} as Parameters<typeof resolveDeployTarget>[0];

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveDeployTarget', () => {
  it('requires SUBDOMAIN to be set explicitly', async () => {
    process.env.RUN402_PROJECT_ID = 'prj_test';
    process.env.ANON_KEY = 'anon_test';
    delete process.env.SUBDOMAIN;

    await expect(resolveDeployTarget(run402Stub)).rejects.toThrow('No subdomain resolved');
  });

  it('rejects a blank SUBDOMAIN', async () => {
    process.env.RUN402_PROJECT_ID = 'prj_test';
    process.env.ANON_KEY = 'anon_test';
    process.env.SUBDOMAIN = '   ';

    await expect(resolveDeployTarget(run402Stub)).rejects.toThrow('No subdomain resolved');
  });

  it('returns the explicit SUBDOMAIN', async () => {
    process.env.RUN402_PROJECT_ID = 'prj_test';
    process.env.ANON_KEY = 'anon_test';
    process.env.SUBDOMAIN = '  eagles  ';

    await expect(resolveDeployTarget(run402Stub)).resolves.toEqual({
      projectId: 'prj_test',
      anonKey: 'anon_test',
      subdomain: 'eagles',
    });
  });
});
