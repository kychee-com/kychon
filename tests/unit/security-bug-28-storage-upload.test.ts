import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadFileContentAddressed } from '../../src/lib/storage-upload.ts';

// Each test starts with a fresh fetch mock so the call log only sees the
// requests for that scenario.
let fetchMock: ReturnType<typeof vi.fn>;

function makeFile(name: string, contents: string, type = 'text/plain'): File {
  return new File([contents], name, { type });
}

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // safeStorageName uses Date.now() in the key — pin it so assertions are stable.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-18T00:00:00Z'));
  // The library reads window.__KYCHON_API + window.__KYCHON_ANON_KEY.
  vi.stubGlobal('window', {
    __KYCHON_API: 'https://api.run402.example',
    __KYCHON_ANON_KEY: 'anon-key',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('bug #28 — uploadFileContentAddressed routes through functions/upload-asset', () => {
  it('POSTs to /functions/v1/upload-asset with the file payload and returns the resulting url', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'uploaded', url: 'https://cdn.example/blob/abc', path: '1779062400000_hello.txt' }),
    );

    const file = makeFile('hello.txt', 'hello');
    const result = await uploadFileContentAddressed(file, { keyPrefix: 'assets' });

    expect(result.url).toBe('https://cdn.example/blob/abc');
    expect(result.key).toBe('assets/1779062400000_hello.txt');

    // Exactly one fetch — to the upload-asset edge function.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.run402.example/functions/v1/upload-asset');
    expect(init.method).toBe('POST');
    // The legacy storage substrate must never be called from the browser.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/storage/v1/'))).toBe(false);
  });

  it('includes a base64 file payload + path in the request body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'uploaded', url: '/storage/x', path: '1779062400000_avatar.png' }),
    );

    const file = makeFile('avatar.png', 'pngbytes', 'image/png');
    await uploadFileContentAddressed(file, { keyPrefix: 'assets', authToken: 'user-jwt' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body || '{}'));
    expect(body.file.name).toBe('avatar.png');
    expect(body.file.type).toBe('image/png');
    // base64 of "pngbytes"
    expect(body.file.data).toBe(btoa('pngbytes'));
    expect(String(body.path)).toMatch(/^\d+_avatar\.png$/);
    // authToken propagates into the Authorization header.
    const headers = (init.headers || {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer user-jwt');
    expect(headers.apikey).toBe('anon-key');
  });

  it('surfaces the error body when the edge function fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Admin access required', { status: 403 }));

    const file = makeFile('x.txt', 'x');
    await expect(uploadFileContentAddressed(file, { keyPrefix: 'assets' })).rejects.toThrow(/Admin access required/);
  });

  it('rejects non-assets prefixes (must route through upload-asset.js, no direct Run402 calls)', async () => {
    const file = makeFile('y.txt', 'y');
    await expect(uploadFileContentAddressed(file, { keyPrefix: 'resources' })).rejects.toThrow(/not supported/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards optional target field to the edge function (for brand_icon_url hint)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 'uploaded',
        url: 'https://cdn.example/blob/icon',
        path: '1779062400000_icon.png',
        warning: 'looks_like_wordmark',
        dimensions: { width: 200, height: 50 },
      }),
    );

    const file = makeFile('icon.png', 'iconbytes', 'image/png');
    const result = await uploadFileContentAddressed(file, { keyPrefix: 'assets', target: 'brand_icon_url' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body || '{}'));
    expect(body.target).toBe('brand_icon_url');
    expect(result.warning).toBe('looks_like_wordmark');
    expect(result.dimensions).toEqual({ width: 200, height: 50 });
  });
});
