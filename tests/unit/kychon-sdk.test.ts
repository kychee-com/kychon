import { describe, expect, it, vi } from 'vitest';

import {
  DEMO_PORTAL_FIXTURES,
  SDK_EXAMPLES,
  createIdempotencyKey,
  createKychonClient,
  isKychonApiError,
} from '../../src/sdk/index.ts';
import { KYCHON_API_VERSION, handleCapabilityApiRequest, type JsonObject } from '../../src/lib/capability-api/index.ts';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('@kychon/sdk client', () => {
  it('performs product operations over POST /functions/v1/kychon-api', async () => {
    const mockFetch = vi.fn(async () => jsonResponse({ ok: true, correlationId: 'corr', data: { rows: [] } }));
    const client = createKychonClient({ portalUrl: 'https://portal.test/', authToken: 'tok', fetch: mockFetch as typeof fetch });

    await client.events.list({ limit: 5 });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://portal.test/functions/v1/kychon-api',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    );
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.list',
      phase: 'query',
      input: { limit: 5 },
    });
  });

  it('supports validate and execute helpers with generated idempotency keys', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, correlationId: 'corr-1', data: { accepted: true } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, correlationId: 'corr-2', data: { result: { id: 1 } } }));
    const client = createKychonClient({ portalUrl: 'https://portal.test', fetch: mockFetch as typeof fetch });

    await client.announcements.publish.validate({ title: 'News' });
    await client.announcements.publish.execute({ title: 'News' }, { confirmed: true });

    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toMatchObject({
      operation: 'announcements.publish',
      phase: 'validate',
    });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1]?.body))).toMatchObject({
      operation: 'announcements.publish',
      phase: 'execute',
      confirmed: true,
    });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1]?.body)).idempotencyKey).toContain('announcements-publish-');
  });

  it('throws typed API errors and exposes an error discriminator', async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse({
        ok: false,
        correlationId: 'corr-err',
        error: {
          code: 'permission.denied',
          message: 'Denied',
          retryable: false,
          detail: { requiredState: 'admin' },
        },
      }),
    );
    const client = createKychonClient({ portalUrl: 'https://portal.test', fetch: mockFetch as typeof fetch });

    await expect(client.config.set.execute({ key: 'site_name', value: 'Club' })).rejects.toMatchObject({
      code: 'permission.denied',
      correlationId: 'corr-err',
      detail: { requiredState: 'admin' },
    });

    try {
      await client.config.set.execute({ key: 'site_name', value: 'Club' });
    } catch (error) {
      expect(isKychonApiError(error)).toBe(true);
    }
  });

  it('discovers well-known metadata before falling back to portal.discover', async () => {
    const mockFetch = vi.fn(async (url: string) =>
      url.endsWith('/.well-known/kychon.json')
        ? jsonResponse({ product: { name: 'Kychon' } })
        : jsonResponse({ ok: true, correlationId: 'corr', data: {} }),
    );
    const client = createKychonClient({ portalUrl: 'https://portal.test', fetch: mockFetch as typeof fetch });

    await expect(client.discover()).resolves.toMatchObject({ product: { name: 'Kychon' } });
    expect(mockFetch).toHaveBeenCalledWith('https://portal.test/.well-known/kychon.json', { headers: {} });
  });

  it('exposes helpers across the required domain namespaces and keeps raw access separate', () => {
    const client = createKychonClient({ portalUrl: 'https://portal.test', fetch: vi.fn() as typeof fetch });

    expect(client.auth.whoami).toBeTypeOf('function');
    expect(client.search.query).toBeTypeOf('function');
    expect(client.members.approve.execute).toBeTypeOf('function');
    expect(client.forum.topics.create.validate).toBeTypeOf('function');
    expect(client.polls.votes.cast.execute).toBeTypeOf('function');
    expect(client.committeeMembers.add.execute).toBeTypeOf('function');
    expect(client.translations.translateText.validate).toBeTypeOf('function');
    expect(client.newsletters.drafts.generate.execute).toBeTypeOf('function');
    expect(client.raw.capability).toBeTypeOf('function');
    expect(client.raw.postgrest).toBeTypeOf('function');
  });

  it('ships SDK examples and demo compatibility fixtures', () => {
    expect(SDK_EXAMPLES.createEvent.operation).toBe('events.create');
    expect(SDK_EXAMPLES.approveMember.operation).toBe('members.approve');
    expect(SDK_EXAMPLES.publishAnnouncement.operation).toBe('announcements.publish');
    expect(SDK_EXAMPLES.forumTopicCreate.operation).toBe('forum.topics.create');
    expect(SDK_EXAMPLES.pollVote.operation).toBe('pollVotes.cast');
    expect(SDK_EXAMPLES.resourceUpload.operation).toBe('resources.upload');
    expect(SDK_EXAMPLES.exportMembers.operation).toBe('exports.membersCsv');
    expect(DEMO_PORTAL_FIXTURES.map((fixture) => fixture.key)).toEqual(['eagles', 'silver-pines', 'barrio-unido']);
  });

  it('generates idempotency keys with a caller-provided prefix', () => {
    expect(createIdempotencyKey('events-create')).toMatch(/^events-create-/);
  });

  it('can run through the API gateway harness', async () => {
    const gatewayFetch = async (url: string | URL | Request, init?: RequestInit) =>
      handleCapabilityApiRequest(new Request(url, init), {
        createCorrelationId: () => 'sdk-gateway',
        getUser: async () => null,
        adminDb: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({ limit: () => [] }),
            }),
          }),
        }),
        queryDb: {
          async select(table: string) {
            const rows: Record<string, JsonObject[]> = {
              resources: [{ id: 1, title: 'Guide', is_members_only: false }],
            };
            return rows[table] || [];
          },
        },
      });
    const client = createKychonClient({ portalUrl: 'https://portal.test', fetch: gatewayFetch as typeof fetch });

    await expect(client.resources.list()).resolves.toMatchObject({ rows: [{ title: 'Guide' }] });
  });
});
