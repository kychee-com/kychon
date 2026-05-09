import {
  CAPABILITY_API_COMMON_SCHEMAS,
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

  async function authHeaders(): Promise<Record<string, string>> {
    const token = typeof options.authToken === 'function' ? await options.authToken() : options.authToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
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

    const res = await fetchImpl(`${portalUrl}/functions/v1/kychon-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
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
      const res = await fetchImpl(`${portalUrl}/.well-known/kychon.json`, { headers: await authHeaders() });
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
        const res = await fetchImpl(`${portalUrl}/rest/v1/${path}`, {
          ...init,
          headers: {
            ...(init.headers || {}),
            ...(await authHeaders()),
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
