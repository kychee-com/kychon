import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real SDK, stubbed network: these pin how the SSR client talks to the API.
const { SSR_API_TIMEOUT_MS, ssrEventsList } = await import('../../src/lib/ssr-api');

const realTimeout = AbortSignal.timeout.bind(AbortSignal);

function okEnvelope(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, correlationId: 'c1', data }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SSR API client', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls kychon-api directly, never the portal host (its discovery doc is an SSR route)', async () => {
    const fetchMock = vi.fn(async () => okEnvelope({ rows: [{ id: 1 }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ssrEventsList({ host: 'club.kychon.com' })).resolves.toEqual({ rows: [{ id: 1 }] });

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual(['https://api.run402.com/functions/v1/kychon-api']);
  });

  it('gives up on a hung API call and falls back to null', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(20));
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      ),
    );

    await expect(ssrEventsList({ host: 'club.kychon.com' })).resolves.toBeNull();
    expect(timeout).toHaveBeenCalledWith(SSR_API_TIMEOUT_MS);
  });
});
