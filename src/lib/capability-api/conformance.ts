import {
  KYCHON_API_VERSION,
  createKychonClient,
  isKychonApiError,
  type CapabilityCallOptions,
  type JsonObject,
  type OperationPhase,
} from '@kychon/sdk';
import { buildCapabilityManifest, buildWellKnownKychon } from './discovery.js';
import { listOperations } from './operations.js';

export interface ConformanceOptions {
  portalUrl: string;
  apiEndpoint?: string;
  apiKey?: string;
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
  const client = createKychonClient({
    portalUrl,
    fetch: fetchImpl,
    ...(options.apiEndpoint ? { apiEndpoint: options.apiEndpoint } : {}),
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.authToken ? { authToken: options.authToken } : {}),
  });

  const wellKnown = await getJson(fetchImpl, `${portalUrl}/.well-known/kychon.json`, headers);
  checks.push(check('remote.discovery', wellKnown.api != null, 'remote discovery document is reachable'));

  const manifest = await getJson(fetchImpl, `${portalUrl}/kychon-capabilities.json`, headers);
  checks.push(check('remote.manifest', Array.isArray(manifest.operations), 'remote capability manifest is reachable'));

  const version = await sdkEnvelope(client, 'portal.version', 'query', {});
  checks.push(check('remote.version', version.ok === true, 'portal.version succeeds'));

  const capabilities = await sdkEnvelope(client, 'portal.capabilities', 'query', {});
  checks.push(check('remote.capabilities', capabilities.ok === true, 'portal.capabilities succeeds'));

  const whoami = await sdkEnvelope(client, 'auth.whoami', 'query', {});
  checks.push(check('remote.actor', whoami.ok === true, 'auth.whoami returns actor state'));

  const search = await sdkEnvelope(client, 'search.query', 'query', { q: 'test' });
  checks.push(check('remote.searchVisibility', search.ok === true, 'search.query returns a visibility-filtered response'));

  const validate = await sdkEnvelope(client, 'events.create', 'validate', { title: 'Conformance' });
  checks.push(check('remote.validate', validate.ok === true, 'representative mutation validate succeeds or returns plan'));

  const executeMissingIdempotency = await sdkEnvelope(client, 'events.create', 'execute', { title: 'Conformance' });
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

async function sdkEnvelope(
  client: ReturnType<typeof createKychonClient>,
  operation: string,
  phase: OperationPhase,
  input: JsonObject,
  options: CapabilityCallOptions = {},
) {
  try {
    return { ok: true, data: await client.request(operation, phase, input, options) } as JsonObject;
  } catch (error) {
    if (!isKychonApiError(error)) throw error;
    const apiError: JsonObject = {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.detail ? { detail: error.detail } : {}),
    };
    return { ok: false, correlationId: error.correlationId, error: apiError } as JsonObject;
  }
}

function check(id: string, ok: boolean, message: string): ConformanceCheck {
  return { id, ok, message };
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
