import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock browser globals
const mockFetch = vi.fn();
global.fetch = mockFetch;
global.window = { __KYCHON_API: 'https://api.test', __KYCHON_ANON_KEY: 'test_key' };
global.atob = (value) => Buffer.from(value, 'base64').toString('binary');
global.localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = v;
  },
  removeItem(k) {
    delete this._data[k];
  },
};

const {
  get,
  post,
  patch,
  del,
  count,
  createEventRegistrationOption,
  updateEventRegistrationOption,
  updateEventTimezone,
} = await import('../../src/lib/api.ts');

function tokenWithClaims(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.sig`;
}

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
      }),
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

  it('refreshes once on 403 when a stored session has a refresh token', async () => {
    localStorage.setItem('wl_session', JSON.stringify({
      access_token: tokenWithClaims({ role: 'project_admin' }),
      refresh_token: 'ref123',
    }));

    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new_tok', refresh_token: 'new_ref' }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[{"id":1}]') });

    await patch('sections?id=eq.1', { title: 'Fresh' });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[1][0]).toContain('/auth/v1/token?grant_type=refresh_token');
    expect(mockFetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new_tok');
  });

  it('does not refresh 403 responses without a refresh token', async () => {
    localStorage.setItem('wl_session', JSON.stringify({
      access_token: tokenWithClaims({ role: 'authenticated' }),
    }));
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Forbidden' }),
    });

    await expect(patch('sections?id=eq.1', { title: 'Fresh' })).rejects.toThrow('API PATCH sections?id=eq.1: 403');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on non-401 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    });
    await expect(get('bad')).rejects.toThrow('API GET bad: 500');
  });

  it('count parses Content-Range header', async () => {
    mockFetch.mockResolvedValueOnce({
      headers: { get: (h) => (h === 'Content-Range' ? '0-0/42' : null) },
    });
    const c = await count('members?status=eq.active');
    expect(c).toBe(42);
  });

  it('persists new event registration options through the registration table', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[{"id":7}]') });
    await createEventRegistrationOption({ event_id: 1, label: 'Member', review_state: 'needs_review' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/rest/v1/event_registration_options');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toMatchObject({ event_id: 1, label: 'Member' });
  });

  it('persists registration review edits through the registration table', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[{"id":7}]') });
    await updateEventRegistrationOption(7, { review_state: 'reviewed', is_disabled: true });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/rest/v1/event_registration_options?id=eq.7');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toMatchObject({ review_state: 'reviewed', is_disabled: true });
  });

  it('persists event timezone overrides through the events table', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('[{"id":3}]') });
    await updateEventTimezone(3, { source_timezone: 'Australia/Sydney', time_display_mode: 'source' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/rest/v1/events?id=eq.3');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toMatchObject({
      source_timezone: 'Australia/Sydney',
      time_display_mode: 'source',
    });
  });
});
