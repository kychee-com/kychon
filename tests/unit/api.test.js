import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser globals
const mockFetch = vi.fn();
global.fetch = mockFetch;
global.window = { __WILDLYCHEE_API: 'https://api.test', __WILDLYCHEE_ANON_KEY: 'test_key' };
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; },
};

const { get, post, patch, del, count } = await import('../../site/js/api.js');

describe('api.js', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage._data = {};
  });

  it('GET includes apikey header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[]') });
    await get('members');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/rest/v1/members',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ apikey: 'test_key' }),
      })
    );
  });

  it('POST sends body and Prefer header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[{"id":1}]') });
    const result = await post('items', { title: 'Test' });
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(call[1].headers.Prefer).toBe('return=representation');
    expect(JSON.parse(call[1].body)).toEqual({ title: 'Test' });
    expect(result).toEqual([{ id: 1 }]);
  });

  it('PATCH sends body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[{"id":1,"done":true}]') });
    await patch('items?id=eq.1', { done: true });
    expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
  });

  it('DELETE calls with correct method', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await del('items?id=eq.1');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('includes Authorization header when session exists', async () => {
    localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok123', refresh_token: 'ref123' }));
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[]') });
    await get('members');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok123');
  });

  it('attempts token refresh on 401', async () => {
    localStorage.setItem('wl_session', JSON.stringify({ access_token: 'expired', refresh_token: 'ref123' }));

    // First call returns 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    // Refresh call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new_tok', refresh_token: 'new_ref' }),
    });
    // Retry succeeds
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[]') });

    await get('members');

    // Should have made 3 calls: original, refresh, retry
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // Refresh endpoint
    expect(mockFetch.mock.calls[1][0]).toContain('/auth/v1/token?grant_type=refresh_token');
  });

  it('throws on non-401 error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({ message: 'Server error' }) });
    await expect(get('bad')).rejects.toThrow('API GET bad: 500');
  });

  it('count parses Content-Range header', async () => {
    mockFetch.mockResolvedValueOnce({
      method: 'HEAD',
      headers: { get: (h) => h === 'Content-Range' ? '0-9/42' : null },
    });
    const c = await count('members?status=eq.active');
    expect(c).toBe(42);
  });
});
