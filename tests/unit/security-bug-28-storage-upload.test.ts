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
  vi.setSystemTime(new Date('2026-05-11T00:00:00Z'));
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

describe('bug #28 — uploadFileContentAddressed uses the post-v1.32 endpoint shape', () => {
  it('calls /storage/v1/uploads (init) then PUTs each part then /complete — never the retired /upload/{key}', async () => {
    fetchMock
      .mockResolvedValueOnce(
        // init
        jsonResponse({
          upload_id: 'upload-123',
          mode: 'multipart',
          parts: [{ part_number: 1, url: 'https://s3.example/part1', byte_start: 0, byte_end: 4 }],
        }),
      )
      .mockResolvedValueOnce(
        // PUT part1
        new Response(null, { status: 200, headers: { etag: '"abc123"' } }),
      )
      .mockResolvedValueOnce(
        // complete
        jsonResponse({ cdn_immutable_url: 'https://cdn.example/blob/abc' }),
      );

    const file = makeFile('hello.txt', 'hello');
    const result = await uploadFileContentAddressed(file, { keyPrefix: 'resources' });

    expect(result.url).toBe('https://cdn.example/blob/abc');

    const urls = fetchMock.mock.calls.map((args) => String(args[0]));
    expect(urls[0]).toBe('https://api.run402.example/storage/v1/uploads');
    expect(urls[1]).toBe('https://s3.example/part1');
    expect(urls[2]).toBe('https://api.run402.example/storage/v1/uploads/upload-123/complete');
    // Make sure we never hit the retired single-shot endpoint.
    expect(urls.some((u) => u.includes('/storage/v1/upload/'))).toBe(false);
  });

  it('includes sha256 + size_bytes + content_type in the init body', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ upload_id: 'u', mode: 'single', parts: [] }))
      .mockResolvedValueOnce(jsonResponse({ cdn_immutable_url: '/storage/x' }));

    const file = makeFile('avatar.png', 'pngbytes', 'image/png');
    await uploadFileContentAddressed(file, { keyPrefix: 'avatars/42', authToken: 'user-jwt' });

    const initCall = fetchMock.mock.calls[0];
    expect(initCall[0]).toBe('https://api.run402.example/storage/v1/uploads');
    const initBody = JSON.parse(String(initCall[1]?.body || '{}'));
    expect(initBody.content_type).toBe('image/png');
    expect(initBody.size_bytes).toBe('pngbytes'.length);
    expect(typeof initBody.sha256).toBe('string');
    expect(initBody.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(String(initBody.key)).toMatch(/^avatars\/42\/\d+_avatar\.png$/);
    // authToken propagates into the Authorization header.
    expect(initCall[1]?.headers?.Authorization).toBe('Bearer user-jwt');
  });

  it('surfaces an error when the init step fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('sha256 is required (every blob is content-addressed post-v1.32)', {
        status: 400,
      }),
    );

    const file = makeFile('x.txt', 'x');
    await expect(uploadFileContentAddressed(file, { keyPrefix: 'resources' })).rejects.toThrow(/content-addressed/);
  });
});
