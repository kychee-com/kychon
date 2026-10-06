import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('@kychon/sdk', () => ({
  createKychonClient: () => ({ request }),
}));

const { ssrAssetManifest, ssrEventGet, resetSsrAssetManifestCache } = await import('../../src/lib/ssr-api');

describe('ssrEventGet', () => {
  beforeEach(() => {
    request.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the event through the anonymous events.get capability', async () => {
    request.mockResolvedValue({ id: 7, title: 'Gala' });
    await expect(ssrEventGet({ id: ' 7 ', host: 'club.kychon.com' })).resolves.toEqual({
      status: 'found',
      event: { id: 7, title: 'Gala' },
    });
    expect(request).toHaveBeenCalledWith('events.get', 'query', { id: 7 });
  });

  it('reports a null row (nonexistent or members-only) as missing', async () => {
    request.mockResolvedValue(null);
    await expect(ssrEventGet({ id: '8', host: 'club.kychon.com' })).resolves.toEqual({ status: 'missing' });
  });

  it('treats absent or non-integer ids as missing without calling the API', async () => {
    for (const id of ['', 'abc', '1.5', '-3', '7; drop', '99999999999999999999']) {
      await expect(ssrEventGet({ id, host: 'club.kychon.com' })).resolves.toEqual({ status: 'missing' });
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('reports a failed read as an error, not a 404', async () => {
    request.mockRejectedValue(new Error('gateway timeout'));
    await expect(ssrEventGet({ id: '7', host: 'club.kychon.com' })).resolves.toEqual({ status: 'error' });
  });
});

describe('ssrAssetManifest', () => {
  const manifestJson = JSON.stringify({
    version: 1,
    generated_at: '2026-10-06T00:00:00Z',
    assets: { 'gala.jpg': { cdnUrl: 'https://cdn.example.com/gala.jpg' } },
  });

  beforeEach(() => {
    resetSsrAssetManifestCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the site manifest, normalizes it, and caches it per origin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(manifestJson));
    const manifest = await ssrAssetManifest('https://club.kychon.com', 1_000);
    expect(manifest?.assets['gala.jpg']).toMatchObject({ cdn_url: 'https://cdn.example.com/gala.jpg' });
    expect(fetchMock).toHaveBeenCalledWith('https://club.kychon.com/_assets-manifest.json', expect.any(Object));

    await ssrAssetManifest('https://club.kychon.com', 2_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await ssrAssetManifest('https://club.kychon.com', 1_000 + 5 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resolves to null on a missing manifest or a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('nope', { status: 404 }));
    await expect(ssrAssetManifest('https://a.kychon.com')).resolves.toBeNull();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(ssrAssetManifest('https://b.kychon.com')).resolves.toBeNull();
  });
});
