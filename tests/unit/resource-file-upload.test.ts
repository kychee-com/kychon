import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadResourceFile } from '../../src/lib/resource-upload.ts';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-18T00:00:00Z'));
  vi.stubGlobal('window', {
    __KYCHON_API: 'https://api.run402.example',
    __KYCHON_ANON_KEY: 'anon-key',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Resources page file upload', () => {
  it('uploads the file through the upload-asset function instead of throwing', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'uploaded', url: 'https://cdn.example/blob/handbook', path: 'p' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const file = new File(['%PDF-1.7'], 'Member Handbook.pdf', { type: 'application/pdf' });
    const url = await uploadResourceFile(file, 'admin-jwt');

    expect(url).toBe('https://cdn.example/blob/handbook');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('https://api.run402.example/functions/v1/upload-asset');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer admin-jwt');

    const body = JSON.parse(String(init.body));
    // Resource files are recognizable among the media library's assets.
    expect(body.file.name).toBe('resource-Member-Handbook.pdf');
    expect(body.file.type).toBe('application/pdf');
    expect(body.path).toBe('1779062400000_resource-Member-Handbook.pdf');
  });

  it('surfaces the upload-asset error (for example a non-admin caller)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"Admin access required"}', { status: 403 }));

    const file = new File(['x'], 'notes.docx');
    await expect(uploadResourceFile(file, 'member-jwt')).rejects.toThrow(/Admin access required/);
  });
});
