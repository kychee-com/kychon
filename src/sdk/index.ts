import {
  CAPABILITY_API_COMMON_SCHEMAS,
  DEFAULT_RUN402_API_BASE_URL,
  KYCHON_CAPABILITY_FUNCTION_PATH,
  KYCHON_API_VERSION,
  type ActionPlan,
  type ActionResult,
  type CapabilityError,
  type CapabilityRequestEnvelope,
  type CapabilityResponseEnvelope,
  type JsonObject,
  type JsonValue,
  type OperationPhase,
} from '../lib/capability-api/index.js';
import { KYCHON_DEMO_PORTALS } from '../lib/demo-portals.js';

export interface KychonClientOptions {
  portalUrl: string;
  apiBaseUrl?: string;
  apiEndpoint?: string;
  apiKey?: string | (() => string | Promise<string | null> | null);
  apiVersion?: string;
  authToken?: string | (() => string | Promise<string | null> | null);
  fetch?: typeof fetch;
}

export interface CapabilityCallOptions {
  idempotencyKey?: string;
  confirmed?: boolean;
}

export class KychonApiError extends Error {
  code: string;
  correlationId: string;
  detail?: JsonObject;
  retryable: boolean;

  constructor(correlationId: string, error: CapabilityError) {
    super(error.message);
    this.name = 'KychonApiError';
    this.code = error.code;
    this.correlationId = correlationId;
    this.detail = error.detail;
    this.retryable = error.retryable;
  }
}

export function isKychonApiError(error: unknown): error is KychonApiError {
  return error instanceof KychonApiError;
}

export function createIdempotencyKey(prefix = 'kychon'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createKychonClient(options: KychonClientOptions) {
  const apiVersion = options.apiVersion || KYCHON_API_VERSION;
  const fetchImpl = options.fetch || fetch;
  const portalUrl = options.portalUrl.replace(/\/$/, '');
  let transportPromise: Promise<KychonTransport> | undefined;
  let discoveryPromise: Promise<JsonObject | undefined> | undefined;
  let runtimeEnvPromise: Promise<RuntimeEnv> | undefined;

  async function authTokenHeader(): Promise<Record<string, string>> {
    const token = typeof options.authToken === 'function' ? await options.authToken() : options.authToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiKeyHeader(): Promise<Record<string, string>> {
    const transport = await resolveTransport();
    return transport.apiKey ? { apikey: transport.apiKey } : {};
  }

  async function requestHeaders(includeContentType = false): Promise<Record<string, string>> {
    return {
      ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
      ...(await apiKeyHeader()),
      ...(await authTokenHeader()),
    };
  }

  async function fetchDiscovery(): Promise<JsonObject | undefined> {
    discoveryPromise ||= (async () => {
      try {
        const res = await fetchImpl(`${portalUrl}/.well-known/kychon.json`);
        if (!res.ok) return undefined;
        const body = (await res.json()) as JsonObject;
        return body && typeof body === 'object' ? body : undefined;
      } catch {
        return undefined;
      }
    })();
    return discoveryPromise;
  }

  async function fetchRuntimeEnv(): Promise<RuntimeEnv> {
    runtimeEnvPromise ||= (async () => {
      const fromWindow = readBrowserRuntimeEnv();
      if (fromWindow.apiBaseUrl || fromWindow.apiKey) return fromWindow;

      try {
        const res = await fetchImpl(`${portalUrl}/js/env.js`);
        if (!res.ok) return {};
        return parseRuntimeEnv(await res.text());
      } catch {
        return {};
      }
    })();
    return runtimeEnvPromise;
  }

  async function resolveTransport(): Promise<KychonTransport> {
    transportPromise ||= (async () => {
      const browserEnv = readBrowserRuntimeEnv();
      const needsDiscovery = !options.apiEndpoint;
      const needsRuntimeEnv = !options.apiKey || (!options.apiEndpoint && !options.apiBaseUrl && !browserEnv.apiBaseUrl);
      const [discovery, runtimeEnv] = await Promise.all([
        needsDiscovery ? fetchDiscovery() : Promise.resolve(undefined),
        needsRuntimeEnv ? fetchRuntimeEnv() : Promise.resolve(browserEnv),
      ]);
      const apiBaseUrl = (
        options.apiBaseUrl ||
        runtimeEnv.apiBaseUrl ||
        browserEnv.apiBaseUrl ||
        DEFAULT_RUN402_API_BASE_URL
      ).replace(/\/$/, '');
      const discoveredEndpoint = readApiEndpoint(discovery);
      const endpoint = absolutizeApiEndpoint(
        options.apiEndpoint ||
          (browserEnv.apiBaseUrl ? `${browserEnv.apiBaseUrl}${KYCHON_CAPABILITY_FUNCTION_PATH}` : undefined) ||
          discoveredEndpoint ||
          `${apiBaseUrl}${KYCHON_CAPABILITY_FUNCTION_PATH}`,
        portalUrl,
        apiBaseUrl,
      );
      const rawApiKey = typeof options.apiKey === 'function' ? await options.apiKey() : options.apiKey;
      const apiKey = rawApiKey || runtimeEnv.apiKey || browserEnv.apiKey;
      return { apiBaseUrl, endpoint, apiKey: apiKey || undefined };
    })();
    return transportPromise;
  }

  async function call<Data = JsonValue>(
    operation: string,
    phase: OperationPhase,
    input: JsonObject = {},
    callOptions: CapabilityCallOptions = {},
  ): Promise<Data> {
    const envelope: CapabilityRequestEnvelope = {
      apiVersion,
      operation,
      phase,
      input,
      ...(callOptions.idempotencyKey ? { idempotencyKey: callOptions.idempotencyKey } : {}),
      ...(callOptions.confirmed != null ? { confirmed: callOptions.confirmed } : {}),
    };
    const transport = await resolveTransport();

    const res = await fetchImpl(transport.endpoint, {
      method: 'POST',
      headers: await requestHeaders(true),
      body: JSON.stringify(envelope),
    });
    const body = (await res.json()) as CapabilityResponseEnvelope<Data>;
    if (!body.ok) throw new KychonApiError(body.correlationId, body.error);
    return body.data;
  }

  const query = <Data = JsonValue>(operation: string, input: JsonObject = {}) => call<Data>(operation, 'query', input);
  const validate = <Data = ActionPlan<JsonObject>>(operation: string, input: JsonObject = {}) =>
    call<Data>(operation, 'validate', input);
  const execute = <Data = ActionResult<JsonValue>>(
    operation: string,
    input: JsonObject = {},
    executeOptions: CapabilityCallOptions = {},
  ) =>
    call<Data>(operation, 'execute', input, {
      ...executeOptions,
      idempotencyKey: executeOptions.idempotencyKey || createIdempotencyKey(operation.replace(/\./g, '-')),
    });

  const mutation = (operation: string) => ({
    validate: (input: JsonObject = {}) => validate(operation, input),
    execute: (input: JsonObject = {}, executeOptions: CapabilityCallOptions = {}) => execute(operation, input, executeOptions),
  });

  return {
    apiVersion,
    portalUrl,
    schemas: CAPABILITY_API_COMMON_SCHEMAS,
    request: call,
    query,
    validate,
    execute,
    discover: async () => {
      const headers = await authTokenHeader();
      const res = await fetchImpl(`${portalUrl}/.well-known/kychon.json`, { headers });
      if (res.ok) return res.json() as Promise<JsonObject>;
      return query<JsonObject>('portal.discover', { portalUrl });
    },
    capabilities: () => query<JsonObject>('portal.capabilities'),
    portal: {
      discover: () => query<JsonObject>('portal.discover', { portalUrl }),
      capabilities: () => query<JsonObject>('portal.capabilities'),
      health: () => query<JsonObject>('portal.health'),
      version: () => query<JsonObject>('portal.version'),
    },
    auth: {
      whoami: () => query<JsonObject>('auth.whoami'),
      permissions: () => query<JsonObject>('auth.permissions'),
      explainDenied: (input: JsonObject) => query<JsonObject>('auth.explainDenied', input),
    },
    search: {
      query: (input: JsonObject) => query<JsonObject>('search.query', input),
      suggest: (input: JsonObject) => query<JsonObject>('search.suggest', input),
    },
    config: {
      get: (input: JsonObject = {}) => query<JsonObject>('config.get', input),
      set: mutation('config.set'),
      setMany: mutation('config.setMany'),
      branding: { update: mutation('config.branding.update') },
      theme: { update: mutation('config.theme.update') },
      general: { update: mutation('config.general.update') },
      eventDisplay: { update: mutation('config.eventDisplay.update') },
      featureFlags: { set: mutation('config.featureFlags.set') },
    },
    pages: domain('pages', ['list', 'get'], ['create', 'update', 'publish', 'unpublish', 'delete'], query, mutation),
    sections: domain('sections', ['list', 'get'], ['create', 'updateConfig', 'reorder', 'setVisibility', 'setScope', 'setColumnSpan', 'delete'], query, mutation),
    members: domain('members', ['list', 'get'], ['updateProfile', 'approve', 'reject', 'suspend', 'reactivate', 'changeTier', 'changeRole', 'setExpiration', 'linkUser'], query, mutation),
    tiers: domain('tiers', ['list'], ['create', 'update', 'delete', 'setDefault', 'reorder'], query, mutation),
    memberFields: domain('memberFields', ['list'], ['create', 'update', 'delete', 'reorder'], query, mutation),
    events: domain('events', ['list', 'get'], ['create', 'update', 'delete', 'setTimezone', 'reviewImport'], query, mutation),
    registrationOptions: domain('registrationOptions', ['list'], ['create', 'update', 'markReviewed', 'ignore', 'disable', 'enable'], query, mutation),
    rsvps: domain('rsvps', ['listForEvent', 'listMine'], ['setStatus', 'cancel'], query, mutation),
    announcements: domain('announcements', ['list', 'get'], ['publish', 'update', 'pin', 'unpin', 'delete'], query, mutation),
    resources: domain('resources', ['list', 'get'], ['upload', 'update', 'delete'], query, mutation),
    assets: {
      upload: mutation('assets.upload'),
    },
    forum: {
      categories: domain('forum.categories', ['list', 'get'], ['create', 'update', 'reorder', 'delete'], query, mutation),
      topics: domain('forum.topics', ['list', 'get'], ['create', 'update', 'pin', 'unpin', 'lock', 'unlock', 'hide', 'unhide', 'delete'], query, mutation),
      replies: domain('forum.replies', ['list'], ['create', 'update', 'hide', 'unhide', 'delete'], query, mutation),
    },
    polls: {
      ...domain('polls', ['list', 'get', 'getAttached'], ['create', 'update', 'attach', 'detach', 'close', 'reopen', 'delete'], query, mutation),
      options: domain('pollOptions', [], ['add', 'update', 'reorder', 'delete'], query, mutation),
      votes: domain('pollVotes', [], ['cast', 'clearMine'], query, mutation),
      results: { get: (input: JsonObject) => query<JsonObject>('pollResults.get', input) },
    },
    committees: domain('committees', ['list', 'get'], ['create', 'update', 'delete'], query, mutation),
    committeeMembers: domain('committeeMembers', ['list'], ['add', 'changeRole', 'remove'], query, mutation),
    reactions: domain('reactions', ['list'], ['add', 'remove', 'toggle'], query, mutation),
    moderation: domain('moderation', ['queue'], ['approve', 'hide', 'markReviewed'], query, mutation),
    translations: domain('translations', ['list'], ['translateText', 'translateContent', 'delete'], query, mutation),
    newsletters: {
      drafts: domain('newsletters.drafts', ['list', 'get'], ['generate', 'update', 'delete'], query, mutation),
    },
    insights: domain('insights', ['list'], ['updateStatus', 'dismiss'], query, mutation),
    exports: {
      membersCsv: mutation('exports.membersCsv'),
      eventsCsv: mutation('exports.eventsCsv'),
      portalData: mutation('exports.portalData'),
    },
    activity: {
      list: (input: JsonObject = {}) => query<JsonObject>('activity.list', input),
    },
    jobs: {
      checkExpirations: mutation('jobs.checkExpirations'),
      sendEventReminders: mutation('jobs.sendEventReminders'),
      generateNewsletter: mutation('jobs.generateNewsletter'),
      status: (input: JsonObject = {}) => query<JsonObject>('jobs.status', input),
    },
    raw: {
      capability: call,
      postgrest: async (path: string, init: RequestInit = {}) => {
        const transport = await resolveTransport();
        const res = await fetchImpl(`${transport.apiBaseUrl}/rest/v1/${path}`, {
          ...init,
          headers: {
            ...(init.headers || {}),
            ...(await requestHeaders()),
          },
        });
        return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
      },
    },
  };
}

type MutationHelper = {
  validate: (input?: JsonObject) => Promise<ActionPlan<JsonObject>>;
  execute: (input?: JsonObject, options?: CapabilityCallOptions) => Promise<ActionResult<JsonValue>>;
};

type DomainNamespace<Reads extends readonly string[], Mutations extends readonly string[]> = {
  [Key in Reads[number]]: (input?: JsonObject) => Promise<JsonObject>;
} & {
  [Key in Mutations[number]]: MutationHelper;
};

function domain<const Reads extends readonly string[], const Mutations extends readonly string[]>(
  prefix: string,
  reads: Reads,
  mutations: Mutations,
  query: <Data = JsonValue>(operation: string, input?: JsonObject) => Promise<Data>,
  mutation: (operation: string) => MutationHelper,
): DomainNamespace<Reads, Mutations> {
  const out: Record<string, unknown> = {};
  for (const read of reads) out[read] = (input: JsonObject = {}) => query<JsonObject>(`${prefix}.${read}`, input);
  for (const verb of mutations) out[verb] = mutation(`${prefix}.${verb}`);
  return out as DomainNamespace<Reads, Mutations>;
}

export const SDK_EXAMPLES = {
  discovery: { operation: 'portal.discover', phase: 'query', input: {} },
  auth: { operation: 'auth.whoami', phase: 'query', input: {} },
  search: { operation: 'search.query', phase: 'query', input: { q: 'budget' } },
  createEvent: { operation: 'events.create', phase: 'validate', input: { title: 'Board meeting' } },
  approveMember: { operation: 'members.approve', phase: 'validate', input: { id: 'member-1' } },
  publishAnnouncement: { operation: 'announcements.publish', phase: 'validate', input: { title: 'News', body: 'Hello' } },
  forumTopicCreate: { operation: 'forum.topics.create', phase: 'validate', input: { title: 'Welcome', body: 'Hi' } },
  pollVote: { operation: 'pollVotes.cast', phase: 'validate', input: { pollId: 'poll-1', optionId: 'option-1' } },
  resourceUpload: { operation: 'resources.upload', phase: 'validate', input: { metadata: { title: 'Guide' } } },
  exportMembers: { operation: 'exports.membersCsv', phase: 'validate', input: {} },
} as const;

export const DEMO_PORTAL_FIXTURES = KYCHON_DEMO_PORTALS;

interface RuntimeEnv {
  apiBaseUrl?: string;
  apiKey?: string;
}

interface KychonTransport {
  apiBaseUrl: string;
  endpoint: string;
  apiKey?: string;
}

function readApiEndpoint(discovery?: JsonObject): string | undefined {
  const api = discovery?.api;
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

function readBrowserRuntimeEnv(): RuntimeEnv {
  const maybeWindow = (globalThis as typeof globalThis & {
    window?: { __KYCHON_API?: string; __KYCHON_ANON_KEY?: string };
  }).window;
  return {
    ...(typeof maybeWindow?.__KYCHON_API === 'string' ? { apiBaseUrl: maybeWindow.__KYCHON_API } : {}),
    ...(typeof maybeWindow?.__KYCHON_ANON_KEY === 'string' ? { apiKey: maybeWindow.__KYCHON_ANON_KEY } : {}),
  };
}

function parseRuntimeEnv(source: string): RuntimeEnv {
  return {
    ...matchRuntimeAssignment(source, '__KYCHON_API', 'apiBaseUrl'),
    ...matchRuntimeAssignment(source, '__KYCHON_ANON_KEY', 'apiKey'),
  };
}

function matchRuntimeAssignment(source: string, name: string, key: keyof RuntimeEnv): RuntimeEnv {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*=\\s*['"]([^'"]+)['"]`));
  return match?.[1] ? { [key]: match[1] } : {};
}
