import { describe, expect, it, vi } from 'vitest';
import { releaseSiteUrl, shipsSsrFunction } from '../../scripts/_lib.ts';
import {
  classifySsrProbe,
  probeSsrRoutes,
  renderSsrProbeLine,
  SSR_PROBE_BUDGET_MS,
  SSR_PROBE_PATHS,
} from '../../scripts/ssr-probe.ts';

describe('classifySsrProbe (kychon#226 deploy gate)', () => {
  it('passes a fast non-5xx answer, including redirects and 404s', () => {
    for (const status of [200, 301, 404]) {
      expect(classifySsrProbe({ path: '/calendar', status, ms: 800 })).toBe('ok');
    }
  });

  it('fails a 5xx or no response', () => {
    expect(classifySsrProbe({ path: '/calendar', status: 500, ms: 900 })).toBe('error');
    expect(classifySsrProbe({ path: '/calendar', status: 504, ms: 900 })).toBe('error');
    expect(classifySsrProbe({ path: '/calendar', status: null, ms: 30_000, error: 'timeout' })).toBe('error');
  });

  it('fails an answer slower than the budget', () => {
    expect(classifySsrProbe({ path: '/search?q=meeting', status: 200, ms: SSR_PROBE_BUDGET_MS + 1 })).toBe('slow');
    expect(renderSsrProbeLine({ path: '/search?q=meeting', status: 200, ms: 40_000 })).toContain('FAIL');
  });
});

describe('probeSsrRoutes', () => {
  it('asks each read-only route once, in order, without following redirects', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
    const results = await probeSsrRoutes('https://club.run402.com/', fetchImpl as unknown as typeof fetch);

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual(
      SSR_PROBE_PATHS.map((path) => `https://club.run402.com${path}`),
    );
    for (const call of fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(call[1].redirect).toBe('manual');
      expect(call[1].method ?? 'GET').toBe('GET');
    }
    expect(results.every((r) => r.status === 200)).toBe(true);
  });

  it('records a network failure as no response', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('The operation was aborted due to timeout');
    });
    const results = await probeSsrRoutes('https://club.run402.com', fetchImpl as unknown as typeof fetch, [
      '/calendar',
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      path: '/calendar',
      status: null,
      error: 'The operation was aborted due to timeout',
    });
    expect(results.map((r) => classifySsrProbe(r))).toEqual(['error']);
  });
});

describe('releaseSiteUrl', () => {
  it('prefers urls.site, falls back to the subdomain URL, ignores non-URLs', () => {
    expect(releaseSiteUrl({ site: 'https://a.run402.com', subdomain: 'https://b.run402.com' })).toBe(
      'https://a.run402.com',
    );
    expect(releaseSiteUrl({ subdomain: 'https://b.run402.com' })).toBe('https://b.run402.com');
    expect(releaseSiteUrl({ site: 'nope' })).toBeUndefined();
    expect(releaseSiteUrl(undefined)).toBeUndefined();
  });
});

describe('shipsSsrFunction', () => {
  it('is true only when a function carries the ssr class', () => {
    const ssr = { ssr: { class: 'ssr' } } as unknown as Parameters<typeof shipsSsrFunction>[0];
    const plain = { 'kychon-api': {} } as unknown as Parameters<typeof shipsSsrFunction>[0];
    expect(shipsSsrFunction(ssr)).toBe(true);
    expect(shipsSsrFunction(plain)).toBe(false);
  });
});

describe('probe output', () => {
  it('prints the Server-Timing breakdown when the route sends one', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('ok', { status: 200, headers: { 'server-timing': 'boot;dur=900, app;dur=1200, cold' } }),
    );
    const results = await probeSsrRoutes('https://club.run402.com', fetchImpl as unknown as typeof fetch, [
      '/calendar',
    ]);
    expect(results.map((r) => renderSsrProbeLine(r)).join('\n')).toContain('[boot;dur=900, app;dur=1200, cold]');
  });
});
