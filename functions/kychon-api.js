// schedule: none (canonical Kychon Capability API gateway at POST /functions/v1/kychon-api)
import { adminDb, getUser } from '@run402/functions';

const API_VERSION = '2026-05-08';
const SUPPORTED_API_VERSIONS = [API_VERSION];
const API_ENDPOINT = 'https://api.run402.com/functions/v1/kychon-api';

const READ_OPERATIONS = [
  'portal.discover',
  'portal.capabilities',
  'portal.health',
  'portal.version',
  'auth.whoami',
  'auth.permissions',
  'auth.explainDenied',
  'search.query',
  'search.suggest',
  'config.get',
  'pages.list',
  'pages.get',
  'sections.list',
  'sections.get',
  'members.list',
  'members.get',
  'tiers.list',
  'memberFields.list',
  'events.list',
  'events.get',
  'registrationOptions.list',
  'rsvps.listForEvent',
  'rsvps.listMine',
  'announcements.list',
  'announcements.get',
  'resources.list',
  'resources.get',
  'forum.categories.list',
  'forum.categories.get',
  'forum.topics.list',
  'forum.topics.get',
  'forum.replies.list',
  'polls.list',
  'polls.get',
  'polls.getAttached',
  'pollResults.get',
  'committees.list',
  'committees.get',
  'committeeMembers.list',
  'reactions.list',
  'moderation.queue',
  'translations.list',
  'newsletters.drafts.list',
  'newsletters.drafts.get',
  'insights.list',
  'activity.list',
  'jobs.status',
];

const MUTATION_OPERATIONS = [
  'config.set',
  'config.setMany',
  'config.branding.update',
  'config.theme.update',
  'config.general.update',
  'config.eventDisplay.update',
  'config.featureFlags.set',
  'pages.create',
  'pages.update',
  'pages.publish',
  'pages.unpublish',
  'pages.delete',
  'sections.create',
  'sections.updateConfig',
  'sections.reorder',
  'sections.setVisibility',
  'sections.setScope',
  'sections.setColumnSpan',
  'sections.delete',
  'members.updateProfile',
  'members.approve',
  'members.reject',
  'members.suspend',
  'members.reactivate',
  'members.changeTier',
  'members.changeRole',
  'members.setExpiration',
  'members.linkUser',
  'tiers.create',
  'tiers.update',
  'tiers.delete',
  'tiers.setDefault',
  'tiers.reorder',
  'memberFields.create',
  'memberFields.update',
  'memberFields.delete',
  'memberFields.reorder',
  'events.create',
  'events.update',
  'events.delete',
  'events.setTimezone',
  'events.reviewImport',
  'registrationOptions.create',
  'registrationOptions.update',
  'registrationOptions.markReviewed',
  'registrationOptions.ignore',
  'registrationOptions.disable',
  'registrationOptions.enable',
  'rsvps.setStatus',
  'rsvps.cancel',
  'announcements.publish',
  'announcements.update',
  'announcements.pin',
  'announcements.unpin',
  'announcements.delete',
  'resources.upload',
  'resources.update',
  'resources.delete',
  'assets.upload',
  'forum.categories.create',
  'forum.categories.update',
  'forum.categories.reorder',
  'forum.categories.delete',
  'forum.topics.create',
  'forum.topics.update',
  'forum.topics.pin',
  'forum.topics.unpin',
  'forum.topics.lock',
  'forum.topics.unlock',
  'forum.topics.hide',
  'forum.topics.unhide',
  'forum.topics.delete',
  'forum.replies.create',
  'forum.replies.update',
  'forum.replies.hide',
  'forum.replies.unhide',
  'forum.replies.delete',
  'polls.create',
  'polls.update',
  'polls.attach',
  'polls.detach',
  'polls.close',
  'polls.reopen',
  'polls.delete',
  'pollOptions.add',
  'pollOptions.update',
  'pollOptions.reorder',
  'pollOptions.delete',
  'pollVotes.cast',
  'pollVotes.clearMine',
  'committees.create',
  'committees.update',
  'committees.delete',
  'committeeMembers.add',
  'committeeMembers.changeRole',
  'committeeMembers.remove',
  'reactions.add',
  'reactions.remove',
  'reactions.toggle',
  'moderation.approve',
  'moderation.hide',
  'moderation.markReviewed',
  'translations.translateText',
  'translations.translateContent',
  'translations.delete',
  'newsletters.drafts.generate',
  'newsletters.drafts.update',
  'newsletters.drafts.delete',
  'insights.updateStatus',
  'insights.dismiss',
  'exports.membersCsv',
  'exports.eventsCsv',
  'exports.portalData',
  'jobs.checkExpirations',
  'jobs.sendEventReminders',
  'jobs.generateNewsletter',
];

const CONFIRMATION_REQUIRED = new Set([
  'pages.delete',
  'sections.delete',
  'members.reject',
  'members.suspend',
  'members.changeRole',
  'members.linkUser',
  'tiers.delete',
  'memberFields.delete',
  'events.delete',
  'announcements.publish',
  'announcements.delete',
  'resources.delete',
  'forum.categories.delete',
  'forum.topics.delete',
  'forum.replies.delete',
  'polls.delete',
  'pollOptions.delete',
  'committees.delete',
  'committeeMembers.remove',
  'translations.delete',
  'newsletters.drafts.delete',
  'exports.membersCsv',
  'exports.portalData',
  'jobs.sendEventReminders',
  'jobs.generateNewsletter',
]);

const OPERATION_CATALOG = [
  ...READ_OPERATIONS.map((name) => operationEntry(name, ['query'])),
  ...MUTATION_OPERATIONS.map((name) => operationEntry(name, ['validate', 'execute'])),
];

const OPERATIONS = new Map(OPERATION_CATALOG.map((entry) => [entry.name, entry]));

const TABLE_QUERIES = {
  'config.get': { table: 'site_config', mode: 'config' },
  'pages.list': { table: 'pages', mode: 'list', visible: visiblePage },
  'pages.get': { table: 'pages', mode: 'one', visible: visiblePage },
  'sections.list': { table: 'sections', mode: 'list', visible: visibleSection },
  'sections.get': { table: 'sections', mode: 'one', visible: visibleSection },
  'members.list': { table: 'members', mode: 'list', map: memberRow },
  'members.get': { table: 'members', mode: 'one', map: memberRow },
  'tiers.list': { table: 'membership_tiers', mode: 'list' },
  'memberFields.list': { table: 'member_custom_fields', mode: 'list', visible: visibleMemberField },
  'events.list': { table: 'events', mode: 'list', visible: visibleMembersOnly },
  'events.get': { table: 'events', mode: 'one', visible: visibleMembersOnly },
  'registrationOptions.list': { table: 'event_registration_options', mode: 'list' },
  'rsvps.listForEvent': { table: 'event_rsvps', mode: 'list' },
  'rsvps.listMine': { table: 'event_rsvps', mode: 'listMine' },
  'announcements.list': { table: 'announcements', mode: 'list' },
  'announcements.get': { table: 'announcements', mode: 'one' },
  'resources.list': { table: 'resources', mode: 'list', visible: visibleMembersOnly },
  'resources.get': { table: 'resources', mode: 'one', visible: visibleMembersOnly },
  'forum.categories.list': { table: 'forum_categories', mode: 'list' },
  'forum.categories.get': { table: 'forum_categories', mode: 'one' },
  'forum.topics.list': { table: 'forum_topics', mode: 'list', visible: visibleForumRow },
  'forum.topics.get': { table: 'forum_topics', mode: 'one', visible: visibleForumRow },
  'forum.replies.list': { table: 'forum_replies', mode: 'list', visible: visibleForumRow },
  'polls.list': { table: 'polls', mode: 'list', visible: visiblePoll },
  'polls.get': { table: 'polls', mode: 'one', visible: visiblePoll },
  'polls.getAttached': { table: 'polls', mode: 'attached' },
  'committees.list': { table: 'committees', mode: 'list' },
  'committees.get': { table: 'committees', mode: 'one' },
  'committeeMembers.list': { table: 'committee_members', mode: 'list' },
  'reactions.list': { table: 'reactions', mode: 'list' },
  'moderation.queue': { table: 'moderation_log', mode: 'list' },
  'translations.list': { table: 'content_translations', mode: 'list' },
  'newsletters.drafts.list': { table: 'newsletter_drafts', mode: 'list' },
  'newsletters.drafts.get': { table: 'newsletter_drafts', mode: 'one' },
  'insights.list': { table: 'member_insights', mode: 'list' },
  'activity.list': { table: 'activity_log', mode: 'list' },
  'jobs.status': { table: 'capability_executions', mode: 'list' },
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  Vary: 'Authorization',
};

export default async (req) => {
  const correlationId = req.headers.get('x-correlation-id') || req.headers.get('x-request-id') || crypto.randomUUID();
  const parsed = await parseEnvelope(req);
  if (!parsed.ok) return errorResponse(correlationId, parsed.status, parsed.error);

  const envelope = parsed.envelope;
  if (!SUPPORTED_API_VERSIONS.includes(envelope.apiVersion)) {
    return errorResponse(correlationId, 400, {
      code: 'api.unsupportedVersion',
      message: `Unsupported Kychon Capability API version: ${envelope.apiVersion}`,
      detail: { supportedApiVersions: SUPPORTED_API_VERSIONS },
      retryable: false,
    });
  }

  const operation = OPERATIONS.get(envelope.operation);
  if (!operation) {
    return errorResponse(correlationId, 404, {
      code: 'api.unknownOperation',
      message: `Unknown Kychon Capability API operation: ${envelope.operation}`,
      detail: { operation: envelope.operation },
      retryable: false,
    });
  }

  if (!operation.phases.includes(envelope.phase)) {
    return errorResponse(correlationId, 400, {
      code: 'api.unsupportedPhase',
      message: `Operation ${operation.name} does not support phase ${envelope.phase}.`,
      detail: { operation: operation.name, supportedPhases: operation.phases },
      retryable: false,
    });
  }

  if (envelope.phase === 'execute' && !envelope.idempotencyKey) {
    return errorResponse(correlationId, 400, {
      code: 'request.invalidEnvelope',
      message: `Executing ${operation.name} requires an idempotencyKey.`,
      detail: { operation: operation.name },
      retryable: false,
    });
  }

  const actor = await resolveActor(req);
  const permission = checkPermission(actor, operation);
  if (!permission.allowed && envelope.phase !== 'validate') {
    return errorResponse(correlationId, 403, {
      code: 'permission.denied',
      message: `Permission denied for ${operation.name}.`,
      detail: permission,
      retryable: false,
    });
  }

  if (envelope.phase === 'query') {
    return handleQuery(correlationId, envelope, operation, actor);
  }

  if (envelope.phase === 'validate') {
    return successResponse(correlationId, {
      accepted: permission.allowed,
      normalizedInput: envelope.input,
      requiresConfirmation: operation.confirmation === 'required',
      permission,
      warnings: [],
      sideEffects: [],
      cost: operation.costClass === 'free' ? null : { class: operation.costClass },
    });
  }

  if (operation.confirmation === 'required' && envelope.confirmed !== true) {
    return errorResponse(correlationId, 409, {
      code: 'confirmation.required',
      message: `Executing ${operation.name} requires confirmed: true.`,
      detail: { operation: operation.name },
      retryable: false,
    });
  }

  return errorResponse(correlationId, 501, {
    code: 'internal.error',
    message: `Execution handler for ${operation.name} is not implemented yet.`,
    detail: { operation: operation.name },
    retryable: false,
  });
};

async function parseEnvelope(req) {
  let body;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      status: 400,
      error: { code: 'request.invalidJson', message: 'Request body must be valid JSON.', retryable: false },
    };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return invalidEnvelope('Request body must be a JSON object.');
  }
  if (
    typeof body.apiVersion !== 'string' ||
    typeof body.operation !== 'string' ||
    !['query', 'validate', 'execute'].includes(body.phase) ||
    body.input === undefined
  ) {
    return invalidEnvelope('Request envelope requires apiVersion, operation, phase, and input.');
  }

  return {
    ok: true,
    envelope: {
      apiVersion: body.apiVersion,
      operation: body.operation,
      phase: body.phase,
      input: body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? body.input : { value: body.input },
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      confirmed: typeof body.confirmed === 'boolean' ? body.confirmed : undefined,
    },
  };
}

function invalidEnvelope(message) {
  return {
    ok: false,
    status: 400,
    error: { code: 'request.invalidEnvelope', message, retryable: false },
  };
}

function handleQuery(correlationId, envelope, operation, actor) {
  if (operation.name === 'portal.discover') {
    return successResponse(correlationId, {
      product: 'Kychon',
      engineVersion: '0.1.0',
      api: {
        endpoint: API_ENDPOINT,
        transport: 'run402-functions',
        currentVersion: API_VERSION,
        supportedVersions: SUPPORTED_API_VERSIONS,
        authHeaders: { apiKey: 'apikey', bearerToken: 'Authorization' },
        publicKeySource: '/js/env.js',
      },
      schemaVersion: API_VERSION,
      sdk: { package: '@kychon/sdk', preferred: true },
      cli: { command: 'kychon', thinWrapperOverSdk: true },
      auth: { bearerToken: true, actorResolution: 'server' },
      manifest: '/kychon-capabilities.json',
      docs: ['/llms.txt', '/docs/kychon-api.md'],
    });
  }
  if (operation.name === 'portal.capabilities') {
    return successResponse(correlationId, { apiVersion: API_VERSION, operations: OPERATION_CATALOG });
  }
  if (operation.name === 'portal.health') {
    return successResponse(correlationId, { ok: true, apiVersion: API_VERSION });
  }
  if (operation.name === 'portal.version') {
    return successResponse(correlationId, {
      engineVersion: '0.1.0',
      apiCurrentVersion: API_VERSION,
      apiSupportedVersions: SUPPORTED_API_VERSIONS,
      apiDeprecatedVersions: [],
      schemaVersion: API_VERSION,
      minimumSdkVersion: '0.1.0',
      recommendedSdkVersion: '0.1.0',
    });
  }
  if (operation.name === 'auth.whoami') {
    return successResponse(correlationId, { actor });
  }
  if (operation.name === 'auth.permissions') {
    return successResponse(correlationId, {
      actorState: actor.state,
      operations: OPERATION_CATALOG.filter((entry) => checkPermission(actor, entry).allowed),
    });
  }
  if (operation.name === 'auth.explainDenied') {
    const target = OPERATIONS.get(String(envelope.input.operation || ''));
    const permission = target ? checkPermission(actor, target) : { allowed: false, actorState: actor.state, reason: 'Unknown operation.' };
    return successResponse(correlationId, {
      operation: envelope.input.operation || '',
      ...permission,
    });
  }
  if (operation.name === 'search.query') {
    return handleSearchQuery(correlationId, envelope.input, actor, false);
  }
  if (operation.name === 'search.suggest') {
    return handleSearchQuery(correlationId, envelope.input, actor, true);
  }
  if (operation.name === 'pollResults.get') {
    return handlePollResultsQuery(correlationId, envelope.input, actor);
  }

  const tableQuery = TABLE_QUERIES[operation.name];
  if (tableQuery) {
    return handleTableQuery(correlationId, envelope.input, actor, tableQuery);
  }

  return errorResponse(correlationId, 501, {
    code: 'internal.error',
    message: `Query handler for ${operation.name} is not implemented yet.`,
    detail: { operation: operation.name },
    retryable: false,
  });
}

async function handleTableQuery(correlationId, input, actor, spec) {
  try {
    const queryInput = spec.mode === 'listMine' ? { ...input, memberId: actor.member?.id || '__none__' } : input;
    const rows = await selectRows(spec.table);
    const visible = spec.visible || (() => true);
    const map = spec.map || ((row) => row);

    if (spec.mode === 'config') {
      if (typeof input.key === 'string') {
        const row = rows.find((item) => item.key === input.key);
        return successResponse(correlationId, row ? configRow(row) : null);
      }
      const mapped = rows.map(configRow);
      return successResponse(correlationId, { rows: mapped, count: mapped.length });
    }

    if (spec.mode === 'one') {
      const row = rows.find((item) => matchesInput(item, queryInput) && visible(item, actor));
      return successResponse(correlationId, row ? map(row, actor) : null);
    }

    if (spec.mode === 'attached') {
      const row = rows.find((item) => matchesAttached(item, queryInput) && visiblePoll(item, actor));
      return successResponse(correlationId, row || null);
    }

    const filtered = rows.filter((row) => matchesInput(row, queryInput)).filter((row) => visible(row, actor)).map((row) => map(row, actor));
    return successResponse(correlationId, { rows: filtered, count: filtered.length });
  } catch (error) {
    console.error('kychon-api table query failed:', error);
    return errorResponse(correlationId, 500, {
      code: 'internal.error',
      message: `Query failed for ${spec.table}.`,
      retryable: true,
    });
  }
}

async function handleSearchQuery(correlationId, input, actor, suggest) {
  try {
    const query = normalizeSearchQuery(input.q ?? input.query ?? '');
    const type = typeof input.type === 'string' ? input.type : 'all';
    const page = suggest ? 1 : positiveInt(input.page, 1);
    const pageSize = suggest ? 5 : Math.min(positiveInt(input.pageSize ?? input.page_size, 10), 50);
    const docs = (await selectRows('search_documents'))
      .filter((row) => row.published !== false)
      .filter((row) => visibleMembersOnly(row, actor))
      .filter((row) => searchTypeMatches(row, type))
      .filter((row) => !query || textIncludes(row.title, query) || textIncludes(row.body, query));
    const offset = (page - 1) * pageSize;
    const pageRows = docs.slice(offset, offset + pageSize);
    const facets = {
      all: docs.length,
      pages: docs.filter((row) => row.source_type === 'page').length,
      resources: docs.filter((row) => row.source_type === 'resource').length,
      events: docs.filter((row) => row.source_type === 'event').length,
    };
    return successResponse(correlationId, {
      query,
      type,
      page,
      page_size: pageSize,
      total: docs.length,
      has_next: offset + pageRows.length < docs.length,
      facets,
      results: pageRows.map((row) => ({
        id: `${row.source_type}:${row.source_key}`,
        type: String(row.source_type || ''),
        object: objectRefJson(searchObjectRef(row)),
        title: String(row.title || 'Untitled'),
        url: String(row.url || '/'),
        snippet: suggest ? '' : String(row.body || '').slice(0, 180),
      })),
    });
  } catch (error) {
    console.error('kychon-api search failed:', error);
    return errorResponse(correlationId, 500, {
      code: 'internal.error',
      message: 'Search query failed.',
      retryable: true,
    });
  }
}

async function handlePollResultsQuery(correlationId, input, actor) {
  try {
    const polls = await selectRows('polls');
    const poll = polls.find((row) => matchesInput(row, input) || String(row.id) === String(input.pollId));
    const votes = await selectRows('poll_votes');
    if (!poll || !visiblePollResults(poll, actor, votes)) return successResponse(correlationId, null);

    const options = (await selectRows('poll_options')).filter((row) => String(row.poll_id) === String(poll.id));
    const pollVotes = votes.filter((row) => String(row.poll_id) === String(poll.id));
    return successResponse(correlationId, {
      poll: objectRefJson({ type: 'poll', id: String(poll.id) }),
      totalVotes: pollVotes.length,
      options: options.map((option) => ({
        option,
        voteCount: pollVotes.filter((vote) => String(vote.option_id) === String(option.id)).length,
      })),
    });
  } catch (error) {
    console.error('kychon-api poll results failed:', error);
    return errorResponse(correlationId, 500, {
      code: 'internal.error',
      message: 'Poll results query failed.',
      retryable: true,
    });
  }
}

async function selectRows(table) {
  const rows = await adminDb().from(table).select('*');
  return Array.isArray(rows) ? rows : rows?.data || rows?.rows || [];
}

function matchesInput(row, input) {
  for (const [inputKey, rowKey] of [
    ['id', 'id'],
    ['slug', 'slug'],
    ['eventId', 'event_id'],
    ['topicId', 'topic_id'],
    ['pollId', 'poll_id'],
    ['committeeId', 'committee_id'],
    ['memberId', 'member_id'],
    ['contentType', 'content_type'],
    ['contentId', 'content_id'],
  ]) {
    if (input[inputKey] != null && String(row[rowKey]) !== String(input[inputKey])) return false;
  }
  return true;
}

function matchesAttached(row, input) {
  return String(row.attached_to) === String(input.attachedTo) && String(row.attached_id) === String(input.attachedId);
}

function configRow(row) {
  return { key: row.key, value: row.value, category: row.category };
}

function memberRow(row, actor) {
  if (isAdminLike(actor)) return row;
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    tier_id: row.tier_id,
    role: row.role,
  };
}

function visiblePage(row, actor) {
  if (isAdminLike(actor)) return true;
  return row.published !== false && (row.requires_auth !== true || canSeeMembersOnly(actor));
}

function visibleSection(row, actor) {
  if (isAdminLike(actor)) return true;
  return row.visible !== false && (row.scope !== 'admin' || isAdminLike(actor));
}

function visibleMemberField(row, actor) {
  return isAdminLike(actor) || row.visible_in_directory !== false;
}

function visibleMembersOnly(row, actor) {
  return row.is_members_only !== true || canSeeMembersOnly(actor);
}

function visibleForumRow(row, actor) {
  return isModeratorLike(actor) || row.hidden !== true;
}

function visiblePoll(row, actor) {
  return isAdminLike(actor) || row.hidden !== true;
}

function visiblePollResults(poll, actor, votes) {
  if (isAdminLike(actor)) return true;
  if (poll.results_visible === 'always') return true;
  if (poll.results_visible === 'after_close') return poll.is_open === false;
  if (poll.results_visible === 'after_vote' && actor.member) {
    return votes.some((vote) => String(vote.poll_id) === String(poll.id) && String(vote.member_id) === actor.member.id);
  }
  return false;
}

function canSeeMembersOnly(actor) {
  return ['active_member', 'moderator', 'admin', 'project_admin'].includes(actor.state);
}

function isModeratorLike(actor) {
  return ['moderator', 'admin', 'project_admin'].includes(actor.state);
}

function isAdminLike(actor) {
  return ['admin', 'project_admin'].includes(actor.state);
}

function normalizeSearchQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function searchTypeMatches(row, type) {
  if (type === 'all') return true;
  const sourceType = type === 'pages' ? 'page' : type === 'resources' ? 'resource' : type === 'events' ? 'event' : type;
  return row.source_type === sourceType;
}

function textIncludes(value, query) {
  return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function searchObjectRef(row) {
  const sourceType = String(row.source_type || '');
  const id = String(row.source_key || row.id || '');
  if (sourceType === 'page') return { type: 'page', id };
  if (sourceType === 'resource') return { type: 'resource', id };
  if (sourceType === 'event') return { type: 'event', id };
  return { type: 'portal', id: sourceType || 'unknown' };
}

function objectRefJson(ref) {
  return {
    type: ref.type,
    id: ref.id,
    ...(ref.label ? { label: ref.label } : {}),
    ...(ref.url ? { url: ref.url } : {}),
  };
}

async function resolveActor(req) {
  let user = null;
  try {
    user = await getUser(req);
  } catch {
    user = null;
  }
  if (!user?.id) return { state: 'anonymous', authenticated: false, user: null, member: null, authority: {} };

  const projectAdmin = isProjectAdmin(user);
  const member = await findMember(user);
  const state = actorState(member, projectAdmin);
  return {
    state,
    authenticated: true,
    user: { id: user.id, email: normalizeEmail(user.email) || null },
    member,
    authority: {
      projectAdmin,
      activeMemberAdmin: member?.status === 'active' && member.role === 'admin',
    },
  };
}

async function findMember(user) {
  const db = adminDb();
  const byUserId = await db.from('members').select('id,user_id,email,display_name,role,status').eq('user_id', user.id).limit(1);
  if (byUserId?.[0]) return normalizeMember(byUserId[0], 'user_id');

  const email = normalizeEmail(user.email);
  if (email) {
    const byEmail = await db.from('members').select('id,user_id,email,display_name,role,status').eq('email', email).limit(1);
    if (byEmail?.[0]) return normalizeMember(byEmail[0], 'email');
  }
  return null;
}

function normalizeMember(row, lookup) {
  const id = String(row.id);
  const displayName = row.display_name ? String(row.display_name) : null;
  return {
    id,
    ref: { type: 'member', id, ...(displayName ? { label: displayName } : {}) },
    userId: row.user_id || null,
    email: normalizeEmail(row.email) || null,
    displayName,
    role: String(row.role || 'member').toLowerCase(),
    status: String(row.status || 'pending').toLowerCase(),
    lookup,
  };
}

function actorState(member, projectAdmin) {
  if (projectAdmin) return 'project_admin';
  if (!member) return 'authenticated_non_member';
  if (member.status === 'pending') return 'pending_member';
  if (member.status !== 'active') return 'authenticated_non_member';
  if (member.role === 'admin') return 'admin';
  if (member.role === 'moderator') return 'moderator';
  return 'active_member';
}

function isProjectAdmin(user) {
  return (
    user.is_admin === true ||
    user.role === 'project_admin' ||
    user.app_metadata?.role === 'project_admin' ||
    user.app_metadata?.is_admin === true
  );
}

function checkPermission(actor, operation) {
  const allowed = actorRank(actor.state) >= actorRank(operation.auth.minimumActorState) || actor.state === 'project_admin';
  return {
    allowed,
    actorState: actor.state,
    requiredState: operation.auth.minimumActorState,
    permission: operation.auth.permission,
    ...(allowed ? {} : { reason: `Requires ${operation.auth.minimumActorState}.` }),
  };
}

function operationEntry(name, phases) {
  const isMutation = phases.includes('execute');
  return {
    name,
    phases,
    auth: {
      minimumActorState: minimumActorState(name),
      permission: isMutation ? `${name}:execute` : undefined,
      allowAnonymous: minimumActorState(name) === 'anonymous',
    },
    confirmation: CONFIRMATION_REQUIRED.has(name) ? 'required' : 'never',
    costClass: name.startsWith('exports.') ? 'privateData' : name.startsWith('translations.') || name.includes('newsletters.drafts.generate') ? 'metered' : 'free',
    inputSchema: `kychon.capabilityApi.v1.operations.${name}.input`,
    outputSchema: `kychon.capabilityApi.v1.operations.${name}.output`,
    deprecation: { deprecated: false },
  };
}

function minimumActorState(name) {
  if (
    name.startsWith('portal.') ||
    name.startsWith('auth.') ||
    name.startsWith('search.') ||
    ['config.get', 'pages.list', 'pages.get', 'sections.list', 'sections.get', 'tiers.list', 'memberFields.list', 'events.list', 'events.get', 'registrationOptions.list', 'announcements.list', 'announcements.get', 'resources.list', 'resources.get', 'committees.list', 'committees.get'].includes(name)
  ) {
    return 'anonymous';
  }
  if (
    ['members.list', 'members.get', 'rsvps.listForEvent', 'rsvps.listMine', 'forum.categories.list', 'forum.categories.get', 'forum.topics.list', 'forum.topics.get', 'forum.replies.list', 'polls.list', 'polls.get', 'polls.getAttached', 'pollResults.get', 'committeeMembers.list', 'reactions.list', 'activity.list'].includes(name) ||
    name.startsWith('forum.topics.create') ||
    name.startsWith('forum.topics.update') ||
    name.startsWith('forum.replies.create') ||
    name.startsWith('forum.replies.update') ||
    name.startsWith('pollVotes.') ||
    name.startsWith('rsvps.') ||
    name.startsWith('reactions.') ||
    ['members.updateProfile'].includes(name)
  ) {
    return 'active_member';
  }
  if (name.startsWith('forum.') || name.startsWith('moderation.')) return 'moderator';
  return 'admin';
}

function actorRank(state) {
  return {
    anonymous: 0,
    authenticated_non_member: 1,
    pending_member: 2,
    active_member: 3,
    moderator: 4,
    admin: 5,
    project_admin: 6,
  }[state] ?? 0;
}

function successResponse(correlationId, data, status = 200) {
  return new Response(JSON.stringify({ ok: true, correlationId, data }), { status, headers: JSON_HEADERS });
}

function errorResponse(correlationId, status, error) {
  return new Response(JSON.stringify({ ok: false, correlationId, error }), { status, headers: JSON_HEADERS });
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
