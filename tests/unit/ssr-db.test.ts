import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the `adminDb()` query builder: chainable, settling to
// whatever `state.result()` returns when the route awaits it.
const state: { result: () => Promise<unknown> } = { result: async () => [] };
const builder = {
  from: () => builder,
  select: () => builder,
  eq: () => builder,
  limit: () => state.result(),
};

vi.mock('@run402/functions', () => ({ adminDb: () => builder }));

const {
  adminGateUnavailableResponse,
  SSR_DB_TIMEOUT_MS,
  ssrAdminGate,
  ssrConnectorEnabled,
  SsrTimeoutError,
  withSsrTimeout,
} = await import('../../src/lib/ssr-db');

const rows = (value: unknown) => {
  state.result = async () => value;
};
const hang = () => {
  state.result = () => new Promise(() => {});
};

describe('withSsrTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves with the read value', async () => {
    rows([{ ok: 1 }]);
    await expect(withSsrTimeout(state.result(), 'read')).resolves.toEqual([{ ok: 1 }]);
  });

  it('rejects with SsrTimeoutError when the read never settles', async () => {
    vi.useFakeTimers();
    hang();
    const pending = withSsrTimeout(state.result(), 'read', 50);
    vi.advanceTimersByTime(50);
    await expect(pending).rejects.toBeInstanceOf(SsrTimeoutError);
  });
});

describe('ssrAdminGate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('allows active admins and owners', async () => {
    rows([{ role: 'admin', status: 'active' }]);
    await expect(ssrAdminGate('u1')).resolves.toBe('allowed');
    rows([{ role: 'owner', status: 'active' }]);
    await expect(ssrAdminGate('u1')).resolves.toBe('allowed');
  });

  it('forbids members, suspended admins and non-members', async () => {
    for (const value of [[{ role: 'member', status: 'active' }], [{ role: 'admin', status: 'suspended' }], [], null]) {
      rows(value);
      await expect(ssrAdminGate('u1')).resolves.toBe('forbidden');
    }
  });

  it('is unavailable, not forbidden, when the lookup errors', async () => {
    state.result = async () => {
      throw new Error('PostgREST error');
    };
    await expect(ssrAdminGate('u1')).resolves.toBe('unavailable');
  });

  it('is unavailable when the lookup hangs past the SSR timeout (kychon#226)', async () => {
    vi.useFakeTimers();
    hang();
    const pending = ssrAdminGate('u1');
    vi.advanceTimersByTime(SSR_DB_TIMEOUT_MS);
    await expect(pending).resolves.toBe('unavailable');
  });

  it('answers unavailable with a retryable 503', () => {
    const response = adminGateUnavailableResponse();
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('5');
  });
});

describe('ssrConnectorEnabled', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('follows the stored flag', async () => {
    rows([{ value: false }]);
    await expect(ssrConnectorEnabled()).resolves.toBe(false);
    rows([{ value: 'false' }]);
    await expect(ssrConnectorEnabled()).resolves.toBe(false);
    rows([{ value: true }]);
    await expect(ssrConnectorEnabled()).resolves.toBe(true);
    rows([]);
    await expect(ssrConnectorEnabled()).resolves.toBe(true);
  });

  it('fails open when the read hangs', async () => {
    vi.useFakeTimers();
    hang();
    const pending = ssrConnectorEnabled();
    vi.advanceTimersByTime(SSR_DB_TIMEOUT_MS);
    await expect(pending).resolves.toBe(true);
  });
});

describe('SSR routes use bounded service-key reads', () => {
  const pages = join(import.meta.dirname, '../../src/pages');
  it.each([
    'admin.astro',
    'admin-members.astro',
    'admin-settings.astro',
    'media-upload.astro',
    '.well-known/kychon.json.ts',
  ])('%s has no unbounded adminDb() call', (route) => {
    expect(readFileSync(join(pages, route), 'utf8')).not.toContain('adminDb(');
  });
});
