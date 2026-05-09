import { describe, expect, it } from 'vitest';

import {
  KYCHON_API_VERSION,
  buildCapabilityManifest,
  buildWellKnownKychon,
  runCapabilityConformance,
  runLocalCapabilityConformance,
} from '../../src/lib/capability-api/index.ts';

function response(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

describe('Capability API conformance runner', () => {
  it('verifies the local contract, manifest, permissions, demo fixtures, and release version', () => {
    const report = runLocalCapabilityConformance();

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual(
      expect.arrayContaining([
        'discovery.wellKnown',
        'manifest.valid',
        'catalog.complete',
        'permissions.metadata',
        'demo.fixtures',
        'release.version',
      ]),
    );
  });

  it('runs representative remote checks against a fetch adapter', async () => {
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith('/.well-known/kychon.json')) return response(buildWellKnownKychon());
      if (href.endsWith('/kychon-capabilities.json')) return response(buildCapabilityManifest());
      const envelope = JSON.parse(String(init?.body || '{}'));
      if (envelope.phase === 'execute' && !envelope.idempotencyKey) {
        return response({
          ok: false,
          correlationId: 'conf',
          error: { code: 'request.invalidEnvelope', message: 'Missing idempotency key', retryable: false },
        });
      }
      return response({ ok: true, correlationId: 'conf', data: { apiVersion: KYCHON_API_VERSION } });
    };

    const report = await runCapabilityConformance({ portalUrl: 'https://portal.test', fetch: fakeFetch as typeof fetch });

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual(expect.arrayContaining(['remote.discovery', 'remote.idempotency']));
  });
});
