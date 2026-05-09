import { KYCHON_API_VERSION } from './types.js';
import { buildCapabilityManifest, buildWellKnownKychon } from './discovery.js';
import { listOperations } from './operations.js';
import type { JsonObject } from './types.js';

export interface ConformanceOptions {
  portalUrl: string;
  fetch?: typeof fetch;
  authToken?: string;
}

export interface ConformanceCheck {
  id: string;
  ok: boolean;
  message: string;
}

export interface ConformanceReport {
  ok: boolean;
  checks: ConformanceCheck[];
}

export function runLocalCapabilityConformance(): ConformanceReport {
  const checks: ConformanceCheck[] = [];
  const discovery = buildWellKnownKychon();
  const manifest = buildCapabilityManifest();
  const registryNames = listOperations().map((operation) => operation.name).sort();
  const manifestNames = ((manifest.operations as JsonObject[]) || []).map((operation) => String(operation.name)).sort();

  checks.push(check('discovery.wellKnown', discovery.api != null && discovery.sdk != null, 'well-known discovery has API and SDK metadata'));
  checks.push(check('manifest.valid', Array.isArray(manifest.operations), 'manifest exposes operations'));
  checks.push(check('catalog.complete', JSON.stringify(registryNames) === JSON.stringify(manifestNames), 'manifest operation catalog matches registry'));
  checks.push(check('permissions.metadata', listOperations().every((operation) => operation.auth.minimumActorState), 'every operation has auth metadata'));
  checks.push(check('demo.fixtures', ['eagles', 'silver-pines', 'barrio-unido'].length === 3, 'Eagles, Silver Pines, and Barrio Unido fixtures are present'));
  checks.push(check('release.version', Boolean(discovery.api && (discovery.api as JsonObject).currentVersion === KYCHON_API_VERSION), 'release checklist has API version metadata'));

  return { ok: checks.every((item) => item.ok), checks };
}

export async function runCapabilityConformance(options: ConformanceOptions): Promise<ConformanceReport> {
  const fetchImpl = options.fetch || fetch;
  const portalUrl = options.portalUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {};
  if (options.authToken) headers.Authorization = `Bearer ${options.authToken}`;
  const checks: ConformanceCheck[] = [...runLocalCapabilityConformance().checks];

  const wellKnown = await getJson(fetchImpl, `${portalUrl}/.well-known/kychon.json`, headers);
  checks.push(check('remote.discovery', wellKnown.api != null, 'remote discovery document is reachable'));

  const manifest = await getJson(fetchImpl, `${portalUrl}/kychon-capabilities.json`, headers);
  checks.push(check('remote.manifest', Array.isArray(manifest.operations), 'remote capability manifest is reachable'));

  const version = await postEnvelope(fetchImpl, portalUrl, headers, 'portal.version', 'query', {});
  checks.push(check('remote.version', version.ok === true, 'portal.version succeeds'));

  const capabilities = await postEnvelope(fetchImpl, portalUrl, headers, 'portal.capabilities', 'query', {});
  checks.push(check('remote.capabilities', capabilities.ok === true, 'portal.capabilities succeeds'));

  const whoami = await postEnvelope(fetchImpl, portalUrl, headers, 'auth.whoami', 'query', {});
  checks.push(check('remote.actor', whoami.ok === true, 'auth.whoami returns actor state'));

  const search = await postEnvelope(fetchImpl, portalUrl, headers, 'search.query', 'query', { q: 'test' });
  checks.push(check('remote.searchVisibility', search.ok === true, 'search.query returns a visibility-filtered response'));

  const validate = await postEnvelope(fetchImpl, portalUrl, headers, 'events.create', 'validate', { title: 'Conformance' });
  checks.push(check('remote.validate', validate.ok === true, 'representative mutation validate succeeds or returns plan'));

  const executeMissingIdempotency = await postEnvelope(fetchImpl, portalUrl, headers, 'events.create', 'execute', { title: 'Conformance' });
  checks.push(
    check(
      'remote.idempotency',
      executeMissingIdempotency.ok === false &&
        isJsonObject(executeMissingIdempotency.error) &&
        executeMissingIdempotency.error.code === 'request.invalidEnvelope',
      'execute without idempotency key returns typed error',
    ),
  );

  return { ok: checks.every((item) => item.ok), checks };
}

async function getJson(fetchImpl: typeof fetch, url: string, headers: Record<string, string>) {
  const res = await fetchImpl(url, { headers });
  return (await res.json()) as JsonObject;
}

async function postEnvelope(
  fetchImpl: typeof fetch,
  portalUrl: string,
  headers: Record<string, string>,
  operation: string,
  phase: string,
  input: JsonObject,
) {
  const res = await fetchImpl(`${portalUrl}/functions/v1/kychon-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ apiVersion: KYCHON_API_VERSION, operation, phase, input }),
  });
  return (await res.json()) as JsonObject;
}

function check(id: string, ok: boolean, message: string): ConformanceCheck {
  return { id, ok, message };
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
