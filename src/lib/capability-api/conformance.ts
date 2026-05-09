import { KYCHON_API_VERSION } from './types.js';
import { DEFAULT_RUN402_API_BASE_URL, KYCHON_CAPABILITY_FUNCTION_PATH } from './discovery.js';
import { buildCapabilityManifest, buildWellKnownKychon } from './discovery.js';
import { listOperations } from './operations.js';
import type { JsonObject } from './types.js';

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

  const wellKnown = await getJson(fetchImpl, `${portalUrl}/.well-known/kychon.json`, headers);
  checks.push(check('remote.discovery', wellKnown.api != null, 'remote discovery document is reachable'));

  const manifest = await getJson(fetchImpl, `${portalUrl}/kychon-capabilities.json`, headers);
  checks.push(check('remote.manifest', Array.isArray(manifest.operations), 'remote capability manifest is reachable'));

  const runtimeEnv = await getRuntimeEnv(fetchImpl, portalUrl);
  const apiBaseUrl = (runtimeEnv.apiBaseUrl || DEFAULT_RUN402_API_BASE_URL).replace(/\/$/, '');
  const apiEndpoint = absolutizeApiEndpoint(options.apiEndpoint || readApiEndpoint(wellKnown) || `${apiBaseUrl}${KYCHON_CAPABILITY_FUNCTION_PATH}`, portalUrl, apiBaseUrl);
  const apiKey = options.apiKey || runtimeEnv.apiKey;
  const apiHeaders = {
    ...headers,
    ...(apiKey ? { apikey: apiKey } : {}),
  };

  const version = await postEnvelope(fetchImpl, apiEndpoint, apiHeaders, 'portal.version', 'query', {});
  checks.push(check('remote.version', version.ok === true, 'portal.version succeeds'));

  const capabilities = await postEnvelope(fetchImpl, apiEndpoint, apiHeaders, 'portal.capabilities', 'query', {});
  checks.push(check('remote.capabilities', capabilities.ok === true, 'portal.capabilities succeeds'));

  const whoami = await postEnvelope(fetchImpl, apiEndpoint, apiHeaders, 'auth.whoami', 'query', {});
  checks.push(check('remote.actor', whoami.ok === true, 'auth.whoami returns actor state'));

  const search = await postEnvelope(fetchImpl, apiEndpoint, apiHeaders, 'search.query', 'query', { q: 'test' });
  checks.push(check('remote.searchVisibility', search.ok === true, 'search.query returns a visibility-filtered response'));

  const validate = await postEnvelope(fetchImpl, apiEndpoint, apiHeaders, 'events.create', 'validate', { title: 'Conformance' });
  checks.push(check('remote.validate', validate.ok === true, 'representative mutation validate succeeds or returns plan'));

  const executeMissingIdempotency = await postEnvelope(fetchImpl, apiEndpoint, apiHeaders, 'events.create', 'execute', { title: 'Conformance' });
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
  apiEndpoint: string,
  headers: Record<string, string>,
  operation: string,
  phase: string,
  input: JsonObject,
) {
  const res = await fetchImpl(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ apiVersion: KYCHON_API_VERSION, operation, phase, input }),
  });
  return (await res.json()) as JsonObject;
}

async function getRuntimeEnv(fetchImpl: typeof fetch, portalUrl: string): Promise<{ apiBaseUrl?: string; apiKey?: string }> {
  try {
    const res = await fetchImpl(`${portalUrl}/js/env.js`);
    if (!res.ok) return {};
    const source = await res.text();
    return {
      ...matchRuntimeAssignment(source, '__KYCHON_API', 'apiBaseUrl'),
      ...matchRuntimeAssignment(source, '__KYCHON_ANON_KEY', 'apiKey'),
    };
  } catch {
    return {};
  }
}

function readApiEndpoint(discovery: JsonObject): string | undefined {
  const api = discovery.api;
  if (!api || typeof api !== 'object' || Array.isArray(api)) return undefined;
  const endpoint = (api as JsonObject).endpoint;
  return typeof endpoint === 'string' ? endpoint : undefined;
}

function absolutizeApiEndpoint(endpoint: string, portalUrl: string, apiBaseUrl: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  if (endpoint.startsWith(KYCHON_CAPABILITY_FUNCTION_PATH)) return `${apiBaseUrl}${endpoint}`;
  if (endpoint.startsWith('/')) return `${portalUrl}${endpoint}`;
  return new URL(endpoint, `${portalUrl}/`).toString();
}

function matchRuntimeAssignment(
  source: string,
  name: string,
  key: 'apiBaseUrl' | 'apiKey',
): { apiBaseUrl?: string; apiKey?: string } {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*=\\s*['"]([^'"]+)['"]`));
  return match?.[1] ? { [key]: match[1] } : {};
}

function check(id: string, ok: boolean, message: string): ConformanceCheck {
  return { id, ok, message };
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
