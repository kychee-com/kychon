import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock browser globals
const mockFetch = vi.fn();
global.fetch = mockFetch;
global.atob = (value) => Buffer.from(value, 'base64').toString('binary');
const localStorageMock = {
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
global.localStorage = localStorageMock;
global.window = {
  __KYCHON_API: 'https://api.test',
  __KYCHON_ANON_KEY: 'test_key',
  localStorage: localStorageMock,
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

function capabilityOk(data) {
  return {
    ok: true,
    json: () => Promise.resolve({ ok: true, correlationId: 'test-correlation', data }),
  };
}

function capabilityError(code, message = 'Denied') {
  return {
    ok: false,
    status: code === 'permission.denied' ? 403 : 500,
    json: () =>
      Promise.resolve({
        ok: false,
        correlationId: 'test-correlation',
        error: { code, message, retryable: false },
      }),
  };
}

function callEnvelope(index = 0) {
  return JSON.parse(mockFetch.mock.calls[index][1].body);
}

describe('api.js', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock._data = {};
  });

  it('GET calls the Capability API with the anon key', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ rows: [], count: 0 }));
    await get('members');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/kychon'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'test_key' }),
      }),
    );
    expect(callEnvelope()).toMatchObject({ operation: 'members.list', phase: 'query', input: {} });
  });

  it('POST maps table creation to a named mutation', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ result: { id: 1 }, changed: [], audit: null, verify: null }));
    const result = await post('events', { title: 'Test', starts_at: '2026-06-01T10:00:00Z' });
    const envelope = callEnvelope();
    expect(envelope).toMatchObject({
      operation: 'events.create',
      phase: 'execute',
      confirmed: true,
      input: { title: 'Test', starts_at: '2026-06-01T10:00:00Z' },
    });
    expect(envelope.idempotencyKey).toMatch(/^events-create-/);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('PATCH maps path ids to named mutations', async () => {
    mockFetch.mockResolvedValueOnce(
      capabilityOk({ result: { id: 1, title: 'Fresh' }, changed: [], audit: null, verify: null }),
    );
    await patch('sections?id=eq.1', { title: 'Fresh' });
    expect(callEnvelope()).toMatchObject({
      operation: 'sections.updateConfig',
      phase: 'execute',
      input: { id: 1, title: 'Fresh' },
    });
  });

  it('DELETE maps path ids to named mutations', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ result: { id: 1 }, changed: [], audit: null, verify: null }));
    await del('events?id=eq.1');
    expect(callEnvelope()).toMatchObject({
      operation: 'events.delete',
      phase: 'execute',
      confirmed: true,
      input: { id: 1 },
    });
  });

  it('sends the anon key with same-origin cookie credentials and no bearer token', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ rows: [], count: 0 }));
    await get('members');
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers.apikey).toBe('test_key');
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.credentials).toBe('same-origin');
  });

  it('throws permission.denied without retrying (cookie sessions need no client refresh)', async () => {
    mockFetch.mockResolvedValueOnce(capabilityError('permission.denied', 'Forbidden'));

    await expect(patch('sections?id=eq.1', { title: 'Fresh' })).rejects.toThrow('Forbidden');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on capability errors', async () => {
    mockFetch.mockResolvedValueOnce(capabilityError('internal.error', 'Server error'));
    await expect(get('members')).rejects.toThrow('Server error');
  });

  it('count uses capability query row counts', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ rows: [{ id: 1 }, { id: 2 }], count: 2 }));
    const c = await count('members?status=eq.active');
    expect(c).toBe(2);
  });

  it('persists new event registration options through a named mutation', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ result: { id: 7 }, changed: [], audit: null, verify: null }));
    await createEventRegistrationOption({ event_id: 1, label: 'Member', review_state: 'needs_review' });
    expect(callEnvelope()).toMatchObject({
      operation: 'registrationOptions.create',
      input: { event_id: 1, label: 'Member' },
    });
  });

  it('persists registration review edits through a named mutation', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ result: { id: 7 }, changed: [], audit: null, verify: null }));
    await updateEventRegistrationOption(7, { review_state: 'reviewed', is_disabled: true });
    expect(callEnvelope()).toMatchObject({
      operation: 'registrationOptions.update',
      input: { id: 7, review_state: 'reviewed', is_disabled: true },
    });
  });

  it('persists event timezone overrides through a named mutation', async () => {
    mockFetch.mockResolvedValueOnce(capabilityOk({ result: { id: 3 }, changed: [], audit: null, verify: null }));
    await updateEventTimezone(3, { source_timezone: 'Australia/Sydney', time_display_mode: 'source' });
    expect(callEnvelope()).toMatchObject({
      operation: 'events.update',
      input: {
        id: 3,
        source_timezone: 'Australia/Sydney',
        time_display_mode: 'source',
      },
    });
  });
});
