// schedule: none (canonical Kychon Capability API gateway at POST /functions/v1/kychon-api)
import { adminDb, getUser } from '@run402/functions';

const API_VERSION = '2026-05-08';
const SUPPORTED_API_VERSIONS = [API_VERSION];
const API_ENDPOINT = 'https://api.run402.com/functions/v1/kychon-api';
const ENGINE_VERSION = '__KYCHON_ENGINE_VERSION__';

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
  'pollOptions.list',
  'pollVotes.list',
  'pollResults.get',
  'committees.list',
  'committees.get',
  'committeeMembers.list',
  'reactions.list',
  'moderation.queue',
  'translations.list',
  'sections.getTranslation',
  'media.list',
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
  'sections.translate',
  'media.delete',
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
  'activity.create',
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
  'events.list': { table: 'events', mode: 'list', visible: visibleMembersOnly, map: eventRow },
  'events.get': { table: 'events', mode: 'one', visible: visibleMembersOnly, map: eventRow },
  'registrationOptions.list': { table: 'event_registration_options', mode: 'list' },
  'rsvps.listForEvent': { table: 'event_rsvps', mode: 'list' },
  'rsvps.listMine': { table: 'event_rsvps', mode: 'listMine' },
  'announcements.list': { table: 'announcements', mode: 'list', map: announcementRow },
  'announcements.get': { table: 'announcements', mode: 'one', map: announcementRow },
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
  'pollOptions.list': { table: 'poll_options', mode: 'list' },
  'pollVotes.list': { table: 'poll_votes', mode: 'list' },
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

const SQL_WRITE_TABLES = new Set(['events', 'resources']);

// Site-config categories that are intentionally readable by anonymous
// callers. Anything else (future webhook URLs, integration tokens, etc.)
// requires admin. (#27 item 4)
const PUBLIC_CONFIG_CATEGORIES = new Set(['branding', 'features', 'theme', 'demo', 'general']);

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
  if (!permission.allowed) {
    // Validate-phase used to run even when the actor lacked permission so
    // the SDK could echo back required-state hints. That makes the whole
    // mutation surface a free enumeration oracle for anonymous callers
    // (and reflects their input back unmodified, which is its own probe).
    // Gate validate on the same minimum actor state as execute. (#27 item 3)
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
    const semanticError = await validateMutationSemantics(operation.name, envelope.input, actor);
    const warnings = semanticError ? [warningFromCapabilityError(semanticError)] : [];
    return successResponse(correlationId, {
      accepted: !semanticError,
      normalizedInput: envelope.input,
      requiresConfirmation: operation.confirmation === 'required',
      permission: semanticError ? { ...permission, allowed: false, reason: semanticError.message } : permission,
      warnings,
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

  return handleExecute(correlationId, envelope, operation, actor);
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

  // Reject non-object input up front rather than silently coercing
  // null/arrays into `{ value: ... }` — the schema documents `input` as a
  // plain object and silent coercion lets callers smuggle filter-bypass
  // shapes through. (#27 item 1)
  if (!body.input || typeof body.input !== 'object' || Array.isArray(body.input)) {
    return invalidEnvelope('Request envelope `input` must be a plain object.');
  }

  return {
    ok: true,
    envelope: {
      apiVersion: body.apiVersion,
      operation: body.operation,
      phase: body.phase,
      input: body.input,
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
      engineVersion: ENGINE_VERSION,
      api: {
        endpoint: API_ENDPOINT,
        transport: 'http',
        runtime: 'run402-function',
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
      engineVersion: ENGINE_VERSION,
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
    const permission = target
      ? checkPermission(actor, target)
      : { allowed: false, actorState: actor.state, reason: 'Unknown operation.' };
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
  // admin-content-management
  if (operation.name === 'sections.getTranslation') {
    return handleSectionTranslationGet(correlationId, envelope.input, actor);
  }
  if (operation.name === 'media.list') {
    return handleMediaList(correlationId, envelope.input, actor);
  }

  const tableQuery = TABLE_QUERIES[operation.name];
  if (tableQuery) {
    return handleTableQuery(correlationId, envelope.input, actor, tableQuery, operation.name);
  }

  return errorResponse(correlationId, 501, {
    code: 'internal.error',
    message: `Query handler for ${operation.name} is not implemented yet.`,
    detail: { operation: operation.name },
    retryable: false,
  });
}

async function handleTableQuery(correlationId, input, actor, spec, operationName) {
  try {
    // Per-call directory-access gate for `members.list` / `members.get`.
    // The capability registry now allows anonymous so portals with
    // `site_config.directory_public === true` (silver-pines among the
    // demos) work for unauthenticated visitors. Portals where the
    // directory is member-gated (eagles, barrio) still reject anon
    // with `permission.denied` here. Active members and admins
    // bypass the check — they had directory access regardless of the
    // public flag before this fix and still do.
    if ((operationName === 'members.list' || operationName === 'members.get') && !canSeeMembersOnly(actor)) {
      const configRows = await selectRows('site_config');
      const flag = configRows.find((row) => row.key === 'directory_public');
      const directoryPublic = flag?.value === true || flag?.value === 'true';
      if (!directoryPublic) {
        return errorResponse(correlationId, 403, {
          code: 'permission.denied',
          message: `Permission denied for ${operationName}.`,
          detail: { reason: 'directory_private', actorState: actor.state },
          retryable: false,
        });
      }
    }

    const queryInput = spec.mode === 'listMine' ? { ...input, memberId: actor.member?.id || '__none__' } : input;
    const rows = await selectRows(spec.table);
    const visible = spec.visible || (() => true);
    const map = spec.map || ((row) => row);

    if (spec.mode === 'config') {
      // Non-admin callers see only the categories that are explicitly safe to
      // publish — branding, features, theme, demo. Any other category (a
      // future webhook URL, integration token, etc.) requires admin. (#27 item 4)
      const visibleConfig = (row) => isAdminLike(actor) || PUBLIC_CONFIG_CATEGORIES.has(row.category);
      if (typeof input.key === 'string') {
        const row = rows.find((item) => item.key === input.key && visibleConfig(item));
        return successResponse(correlationId, row ? configRow(row) : null);
      }
      const mapped = rows.filter(visibleConfig).map(configRow);
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

    const filtered = rows
      .filter((row) => matchesInput(row, queryInput))
      .filter((row) => visible(row, actor))
      .map((row) => map(row, actor));
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
        url: searchResultUrl(row),
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

async function handleExecute(correlationId, envelope, operation, actor) {
  let executionRecord = null;
  try {
    const execution = await beginExecution(envelope, operation, actor, correlationId);
    if (execution.kind === 'replay') return successResponse(correlationId, execution.record.result_payload);
    if (execution.kind === 'conflict') {
      // Don't echo the prior operation name back to the caller — it's an
      // info leak about other clients' traffic and a free oracle for
      // idempotency-key enumeration. The internal correlation log still
      // captures the conflict for ops debugging. (#27 item 2)
      return errorResponse(correlationId, 409, {
        code: 'conflict.idempotencyKey',
        message: execution.reason,
        detail: {
          operation: operation.name,
          idempotencyKey: envelope.idempotencyKey,
        },
        retryable: false,
      });
    }
    if (execution.kind === 'pending') {
      return errorResponse(correlationId, 409, {
        code: 'conflict.idempotencyKey',
        message: 'A previous execution with this idempotencyKey is still in progress.',
        detail: { operation: operation.name, idempotencyKey: envelope.idempotencyKey, status: execution.record.status },
        retryable: true,
      });
    }

    executionRecord = execution.record;
    const data = await executeMutation(operation.name, envelope.input, actor);
    await completeExecution(executionRecord, data);
    return successResponse(correlationId, data);
  } catch (error) {
    if (executionRecord) await failExecution(executionRecord, executionFailurePayload(error));
    if (error?.capabilityCode) {
      return errorResponse(correlationId, mutationStatus(error.capabilityCode), {
        code: mutationErrorCode(error.capabilityCode),
        message: error.message,
        ...(error.detail ? { detail: error.detail } : {}),
        retryable: false,
      });
    }
    console.error('kychon-api execute failed:', error);
    return errorResponse(correlationId, 500, {
      code: 'internal.error',
      message: `Execution failed for ${operation.name}.`,
      retryable: true,
    });
  }
}

async function beginExecution(envelope, operation, actor, correlationId) {
  const inputDigest = await digestJson(envelope.input);
  const existing = await findExecution(envelope.apiVersion, envelope.idempotencyKey);
  if (existing) {
    if (existing.operation !== operation.name) {
      return { kind: 'conflict', record: existing, reason: 'Idempotency key was used with another operation.' };
    }
    if (existing.input_digest !== inputDigest) {
      return { kind: 'conflict', record: existing, reason: 'Idempotency key was used with different input.' };
    }
    if (existing.status === 'succeeded') return { kind: 'replay', record: existing };
    if (isStaleExecution(existing)) return { kind: 'resume', record: existing };
    return { kind: 'pending', record: existing };
  }

  const now = new Date().toISOString();
  try {
    const record = await insertRow('capability_executions', {
      api_version: envelope.apiVersion,
      operation: operation.name,
      idempotency_key: envelope.idempotencyKey,
      actor_ref: actorReference(actor),
      actor_state: actor.state,
      input_digest: inputDigest,
      status: 'started',
      result_digest: null,
      result_payload: null,
      error_payload: null,
      correlation_id: correlationId,
      created_at: now,
      updated_at: now,
    });
    return { kind: 'started', record };
  } catch (error) {
    const raced = await findExecution(envelope.apiVersion, envelope.idempotencyKey);
    if (raced) return beginExecution(envelope, operation, actor, correlationId);
    throw error;
  }
}

async function findExecution(apiVersion, idempotencyKey) {
  const rows = await adminDb()
    .from('capability_executions')
    .select('*')
    .eq('api_version', apiVersion)
    .eq('idempotency_key', idempotencyKey)
    .limit(1);
  return normalizeDbRows(rows)[0] || null;
}

async function completeExecution(record, result) {
  return updateRow('capability_executions', record.id, {
    status: 'succeeded',
    result_digest: await digestJson(result),
    result_payload: result,
    error_payload: null,
    updated_at: new Date().toISOString(),
  });
}

async function failExecution(record, errorPayload) {
  return updateRow('capability_executions', record.id, {
    status: 'failed',
    result_digest: null,
    result_payload: null,
    error_payload: errorPayload,
    updated_at: new Date().toISOString(),
  });
}

function isStaleExecution(record) {
  if (!record.updated_at) return false;
  return Date.now() - new Date(record.updated_at).getTime() > 5 * 60 * 1000;
}

function executionFailurePayload(error) {
  if (error?.capabilityCode) {
    return {
      code: mutationErrorCode(error.capabilityCode),
      message: error.message,
      ...(error.detail ? { detail: error.detail } : {}),
    };
  }
  return { code: 'internal.error', message: error instanceof Error ? error.message : 'Execution failed.' };
}

function actorReference(actor) {
  if (actor.member) {
    return {
      type: 'member',
      id: actor.member.id,
      ...(actor.member.email ? { email: actor.member.email } : {}),
    };
  }
  if (actor.user) {
    return {
      type: 'user',
      id: actor.user.id,
      ...(actor.user.email ? { email: actor.user.email } : {}),
    };
  }
  return { type: 'anonymous' };
}

async function digestJson(value) {
  const bytes = new TextEncoder().encode(stableJsonStringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stableJsonStringify(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
    .join(',')}}`;
}

async function executeMutation(name, input, actor) {
  if (name === 'announcements.publish') return publishAnnouncement(input, actor);
  if (name === 'forum.topics.create') return createForumTopic(input, actor);
  if (name === 'forum.replies.create') return createForumReply(input, actor);
  if (name === 'polls.create') return createPollAction(input, actor);
  if (name === 'pollVotes.cast') return castPollVote(input, actor);
  if (name === 'pollVotes.clearMine') return clearMinePollVotes(input, actor);
  if (name === 'reactions.toggle') return toggleReaction(input, actor);
  if (name === 'resources.upload') return uploadResource(input, actor);
  if (name === 'assets.upload')
    return actionResult(
      { status: 'uploaded', path: input.path || null },
      [changedObject('asset', input.path || 'asset')],
      null,
    );
  if (name === 'translations.translateText')
    return actionResult({ translatedText: input.text || '' }, [changedObject('translation', 'text')], null);
  if (name === 'translations.translateContent') return translateContent(input);
  if (name === 'newsletters.drafts.generate') return generateNewsletterDraft(input);
  if (name.startsWith('jobs.'))
    return actionResult({ status: 'queued', job: name.replace(/^jobs\./, '') }, [changedObject('job', name)], null);
  if (name === 'rsvps.setStatus') return setRsvpStatus(input, actor);
  if (name === 'rsvps.cancel') return cancelRsvp(input, actor);
  if (name === 'members.changeRole') return changeMemberRole(input, actor);
  // admin-content-management: custom page handlers with nav side-effects
  if (name === 'pages.create') return createPageWithNav(input, actor);
  if (name === 'pages.delete') return deletePageWithCascade(input, actor);
  // admin-content-management: media library wrappers + section_translations
  if (name === 'media.delete') return deleteMediaAsset(input, actor);
  if (name === 'sections.translate') return upsertSectionTranslation(input, actor);
  return genericMutation(name, input, actor);
}

const VALID_MEMBER_ROLES = new Set(['member', 'moderator', 'admin']);

async function validateMutationSemantics(operation, input, actor) {
  try {
    if (operation === 'members.updateProfile') {
      idForUpdate(operation, input, actor);
    } else if (operation === 'forum.replies.create') {
      await validateForumReplyInput(input);
    } else if (operation === 'pollVotes.cast') {
      await validatePollVoteInput(input);
    } else if (operation === 'members.changeRole') {
      const role = typeof input.role === 'string' ? input.role.toLowerCase() : '';
      if (!VALID_MEMBER_ROLES.has(role)) {
        throw capabilityError('validation.failed', 'members.changeRole requires role in member|moderator|admin.', {
          role: String(input.role ?? ''),
        });
      }
      await ensureActiveAdminRemains(operation, requiredId(input, operation), { role });
    } else if (operation === 'members.suspend' || operation === 'members.reject') {
      await ensureActiveAdminRemains(operation, requiredId(input, operation), rowForUpdate(operation, input, actor));
    }
    return null;
  } catch (error) {
    if (error?.capabilityCode) return error;
    throw error;
  }
}

function warningFromCapabilityError(error) {
  return {
    code: error.capabilityCode,
    message: error.message,
    ...(error.detail ? { detail: error.detail } : {}),
  };
}

async function changeMemberRole(input, _actor) {
  // Reject anything that isn't a known role. The old fall-through path
  // (`input.role || 'member'`) silently demoted on typos and let `'admin'`,
  // `'moderator'`, or arbitrary strings reach the DB unfiltered. (#29)
  const role = typeof input.role === 'string' ? input.role.toLowerCase() : '';
  if (!VALID_MEMBER_ROLES.has(role)) {
    throw capabilityError('validation.failed', 'members.changeRole requires role in member|moderator|admin.', {
      role: String(input.role ?? ''),
    });
  }

  const targetId = requiredId(input, 'members.changeRole');
  const members = await selectRows('members');
  const target = members.find((row) => String(row.id) === String(targetId));
  if (!target) {
    throw capabilityError('notFound.object', 'Member not found.', {
      object: { type: 'member', id: String(targetId) },
    });
  }

  // Last-admin guard: role changes, suspension, and rejection all remove
  // admin availability when the target is the only active admin. (#30)
  await ensureActiveAdminRemains('members.changeRole', targetId, { role }, members, target);

  const row = await updateRow('members', targetId, { role });
  const object = changedObject('member', row?.id ?? targetId);
  return actionResult(
    row || { ...target, role },
    [object],
    verification('members.get', { id: row?.id ?? targetId }, object),
  );
}

async function ensureActiveAdminRemains(operation, targetId, patch, members, target) {
  if (!guardsLastActiveAdmin(operation)) return target ?? null;
  const rows = members ?? (await selectRows('members'));
  const row = target ?? rows.find((member) => String(member.id) === String(targetId));
  if (!row) {
    throw capabilityError('notFound.object', 'Member not found.', {
      object: { type: 'member', id: String(targetId) },
    });
  }
  if (!memberPatchRemovesActiveAdmin(row, patch)) return row;

  const hasOtherActiveAdmin = rows.some(
    (member) => String(member.id) !== String(targetId) && isActiveAdminMember(member),
  );
  if (!hasOtherActiveAdmin) {
    throw capabilityError('conflict.state', 'Cannot remove the last active admin.', {
      object: { type: 'member', id: String(targetId) },
    });
  }
  return row;
}

function guardsLastActiveAdmin(operation) {
  return operation === 'members.changeRole' || operation === 'members.suspend' || operation === 'members.reject';
}

function memberPatchRemovesActiveAdmin(member, patch) {
  if (!isActiveAdminMember(member)) return false;
  const nextRole = patch.role != null ? String(patch.role).toLowerCase() : String(member.role).toLowerCase();
  const nextStatus = patch.status != null ? String(patch.status).toLowerCase() : String(member.status).toLowerCase();
  return nextRole !== 'admin' || nextStatus !== 'active';
}

function isActiveAdminMember(member) {
  return String(member.role).toLowerCase() === 'admin' && String(member.status).toLowerCase() === 'active';
}

async function genericMutation(operation, input, actor) {
  const spec = mutationSpec(operation);
  if (!spec) throw capabilityError('api.unknownOperation', `No mutation spec for ${operation}.`);

  let row = null;
  if (spec.action === 'create') {
    row = await insertRow(spec.table, rowForCreate(operation, input, actor));
  } else if (spec.action === 'delete') {
    row = await deleteRow(spec.table, requiredId(input, `${operation} delete`));
  } else if (spec.action === 'upsertConfig') {
    row = await upsertConfig(input);
  } else {
    const targetId = idForUpdate(operation, input, actor);
    const patch = rowForUpdate(operation, input, actor);
    await ensureActiveAdminRemains(operation, targetId, patch);
    row = await updateRow(spec.table, targetId, patch);
    if (!row) {
      throw capabilityError('notFound.object', `${objectTypeLabel(spec.objectType)} not found.`, {
        object: changedObject(spec.objectType, targetId),
      });
    }
  }

  const object = changedObject(spec.objectType, row?.id ?? input.id ?? input.key ?? 'unknown');
  return actionResult(row || {}, [object], verificationFor(spec.objectType, object));
}

async function publishAnnouncement(input, actor) {
  // author_id is bound to the acting admin — never honored from input. The
  // dedicated `announcements.update` operation is the path for any later
  // attribution change. (#24)
  //
  // Body is sanitized on write so every downstream reader (newsletter
  // generator, translation cache, CSV/RSS export) inherits the safety
  // guarantee the read-side hydrator already provides. (#29)
  const announcement = await insertRow('announcements', {
    title: input.title || 'Untitled',
    body: sanitizeRichHtmlServer(input.body || ''),
    is_pinned: input.pin === true || input.is_pinned === true,
    author_id: memberId(actor),
  });
  const changed = [changedObject('announcement', announcement.id)];
  if (isPlainObject(input.poll)) {
    const poll = await createPoll({ ...input.poll, attached_to: 'announcement', attached_id: announcement.id }, actor);
    changed.push(changedObject('poll', poll.id));
  }
  const activity = await writeActivity(actor, 'announcement', {
    title: announcement.title,
    announcement_id: announcement.id,
  });
  return actionResult(
    announcement,
    changed,
    verification('announcements.get', { id: announcement.id }, changed[0]),
    auditReference(activity.id, 'announcement'),
  );
}

async function createForumTopic(input, actor) {
  // author_id / author_name come from the actor only — caller-supplied values
  // would let any active member impersonate another member or admin. Pinning a
  // topic at create time is reserved for moderators via `forum.topics.pin`. (#24)
  const topic = await insertRow('forum_topics', {
    category_id: input.categoryId ?? input.category_id ?? null,
    title: input.title || 'Untitled',
    body: input.body || '',
    author_id: memberId(actor),
    author_name: actor.member?.displayName ?? null,
    is_pinned: false,
    reply_count: 0,
    last_reply_at: null,
  });
  const changed = [changedObject('forum.topic', topic.id)];
  if (isPlainObject(input.poll)) {
    const poll = await createPoll({ ...input.poll, attached_to: 'forum_topic', attached_id: topic.id }, actor);
    changed.push(changedObject('poll', poll.id));
  }
  const activity = await writeActivity(actor, 'forum_post', { title: topic.title, topic_id: topic.id });
  return actionResult(
    topic,
    changed,
    verification('forum.topics.get', { id: topic.id }, changed[0]),
    auditReference(activity.id, 'forum_post'),
  );
}

async function validateForumReplyInput(input) {
  const topicId = requiredAny(input.topicId ?? input.topic_id, 'forum.replies.create requires topicId.');
  await findOpenForumTopic(topicId);
}

async function findOpenForumTopic(topicId) {
  const topic = (await selectRows('forum_topics')).find((row) => String(row.id) === String(topicId));
  if (!topic)
    throw capabilityError('notFound.object', 'Forum topic not found.', {
      object: { type: 'forum.topic', id: String(topicId) },
    });
  if (topic.locked === true)
    throw capabilityError('conflict.state', 'Forum topic is locked.', {
      object: { type: 'forum.topic', id: String(topicId) },
    });
  return topic;
}

async function createForumReply(input, actor) {
  const topicId = requiredAny(input.topicId ?? input.topic_id, 'forum.replies.create requires topicId.');
  const topic = await findOpenForumTopic(topicId);

  // author_id / author_name come from the actor only. (#24)
  const reply = await insertRow('forum_replies', {
    topic_id: topicId,
    body: input.body || '',
    author_id: memberId(actor),
    author_name: actor.member?.displayName ?? null,
  });
  await updateRow('forum_topics', topicId, {
    reply_count: Number(topic.reply_count || 0) + 1,
    last_reply_at: new Date().toISOString(),
  });
  const activity = await writeActivity(actor, 'forum_reply', { topic_id: topicId, reply_id: reply.id });
  const object = changedObject('forum.reply', reply.id);
  return actionResult(
    reply,
    [object, changedObject('forum.topic', topicId)],
    verification('forum.replies.list', { topicId }, object),
    auditReference(activity.id, 'forum_reply'),
  );
}

async function createPollAction(input, actor) {
  const poll = await createPoll(input, actor);
  const object = changedObject('poll', poll.id);
  return actionResult(poll, [object], verification('polls.get', { id: poll.id }, object));
}

async function createPoll(input, actor) {
  // created_by is bound to the actor — never honored from input. (#24)
  const poll = await insertRow('polls', {
    question: input.question || 'Poll',
    description: input.description || null,
    poll_type: input.pollType || input.poll_type || 'single',
    is_anonymous: input.isAnonymous === true || input.is_anonymous === true,
    results_visible: input.resultsVisible || input.results_visible || 'after_vote',
    is_open: input.is_open !== false,
    closes_at: input.closesAt || input.closes_at || null,
    attached_to: input.attached_to || input.attachedTo || null,
    attached_id: input.attached_id || input.attachedId || null,
    created_by: memberId(actor),
  });
  const options = Array.isArray(input.options) ? input.options : [];
  let position = 0;
  for (const option of options) {
    const label = isPlainObject(option) ? option.label : option;
    await insertRow('poll_options', { poll_id: poll.id, label: label || `Option ${position + 1}`, position });
    position += 1;
  }
  return poll;
}

async function validatePollVoteInput(input) {
  const pollId = requiredAny(input.pollId ?? input.poll_id, 'pollVotes.cast requires pollId.');
  const optionIds = Array.isArray(input.optionIds)
    ? input.optionIds
    : [requiredAny(input.optionId ?? input.option_id, 'pollVotes.cast requires optionId.')];
  await findOpenPoll(pollId);
  await validatePollOptionIds(pollId, optionIds);
}

async function findOpenPoll(pollId) {
  const poll = (await selectRows('polls')).find((row) => String(row.id) === String(pollId));
  if (!poll)
    throw capabilityError('notFound.object', 'Poll not found.', { object: { type: 'poll', id: String(pollId) } });
  if (poll.is_open === false)
    throw capabilityError('conflict.state', 'Poll is closed.', { object: { type: 'poll', id: String(pollId) } });
  return poll;
}

async function validatePollOptionIds(pollId, optionIds) {
  const validOptionIds = new Set(
    (await selectRows('poll_options'))
      .filter((option) => String(option.poll_id) === String(pollId))
      .map((option) => String(option.id)),
  );
  for (const optionId of optionIds) {
    if (!validOptionIds.has(String(optionId))) {
      throw capabilityError(
        'validation.failed',
        `pollVotes.cast optionId ${optionId} does not belong to poll ${pollId}.`,
        { object: { type: 'poll.option', id: String(optionId) } },
      );
    }
  }
}

async function castPollVote(input, actor) {
  const pollId = requiredAny(input.pollId ?? input.poll_id, 'pollVotes.cast requires pollId.');
  const optionIds = Array.isArray(input.optionIds)
    ? input.optionIds
    : [requiredAny(input.optionId ?? input.option_id, 'pollVotes.cast requires optionId.')];
  const poll = await findOpenPoll(pollId);
  await validatePollOptionIds(pollId, optionIds);

  const member = memberId(actor);
  const existing = (await selectRows('poll_votes')).filter(
    (vote) => String(vote.poll_id) === String(pollId) && String(vote.member_id) === String(member),
  );
  if (poll.poll_type !== 'multiple') {
    for (const vote of existing) await deleteRow('poll_votes', requiredId(vote, 'pollVotes.cast existing vote'));
  }

  const changed = [];
  for (const optionId of optionIds) {
    const duplicate = existing.find((vote) => String(vote.option_id) === String(optionId));
    if (poll.poll_type === 'multiple' && duplicate) {
      await deleteRow('poll_votes', requiredId(duplicate, 'pollVotes.cast duplicate vote'));
      changed.push(changedObject('poll.vote', duplicate.id));
      continue;
    }
    const vote = await insertRow('poll_votes', { poll_id: pollId, option_id: optionId, member_id: member });
    changed.push(changedObject('poll.vote', vote.id));
  }
  const activity = await writeActivity(actor, 'poll_vote', { poll_id: pollId });
  return actionResult(
    { pollId, optionIds },
    changed,
    verification('pollResults.get', { id: pollId }),
    auditReference(activity.id, 'poll_vote'),
  );
}

async function clearMinePollVotes(input, actor) {
  const pollId = requiredAny(input.pollId ?? input.poll_id, 'pollVotes.clearMine requires pollId.');
  const member = memberId(actor);
  const votes = (await selectRows('poll_votes')).filter(
    (vote) => String(vote.poll_id) === String(pollId) && String(vote.member_id) === String(member),
  );
  for (const vote of votes) await deleteRow('poll_votes', requiredId(vote, 'pollVotes.clearMine vote'));
  return actionResult(
    { cleared: votes.length },
    votes.map((vote) => changedObject('poll.vote', vote.id)),
    verification('pollResults.get', { id: pollId }),
  );
}

async function setRsvpStatus(input, actor) {
  // member_id is bound to the actor (admins act-as via dedicated admin paths,
  // not this capability) and an `id` from input must belong to that member —
  // otherwise an active member could update arbitrary RSVP rows. (#24)
  const member = memberId(actor);
  const id = input.id;
  const eventId = input.eventId ?? input.event_id;

  if (id != null) {
    const target = (await selectRows('event_rsvps')).find((row) => String(row.id) === String(id));
    if (!target)
      throw capabilityError('notFound.object', 'RSVP not found.', { object: { type: 'event.rsvp', id: String(id) } });
    if (String(target.member_id) !== String(member) && !isAdminLike(actor) && !isModeratorLike(actor)) {
      throw capabilityError('permission.denied', 'rsvps.setStatus can only update the active member RSVP.', {
        object: { type: 'event.rsvp', id: String(id) },
      });
    }
    const row = await updateRow('event_rsvps', id, { status: input.status || 'going', member_id: target.member_id });
    const object = changedObject('event.rsvp', row.id ?? id);
    return actionResult(
      row,
      [object],
      verification('rsvps.listForEvent', { eventId: row.event_id ?? eventId }, object),
    );
  }

  const event = requiredAny(eventId, 'rsvps.setStatus requires eventId.');
  // Pre-validate the event so a missing FK surfaces as `notFound.object`,
  // not the generic `internal.error` we'd get when the DB-side FK rejects
  // the insert. (#29)
  const eventRow = (await selectRows('events')).find((row) => String(row.id) === String(event));
  if (!eventRow) {
    throw capabilityError('notFound.object', 'Event not found.', {
      object: { type: 'event', id: String(event) },
    });
  }
  const existing = (await selectRows('event_rsvps')).find(
    (row) => String(row.event_id) === String(event) && String(row.member_id) === String(member),
  );
  const row = existing
    ? await updateRow('event_rsvps', existing.id, { status: input.status || 'going', member_id: member })
    : await insertRow('event_rsvps', { event_id: event, member_id: member, status: input.status || 'going' });
  const object = changedObject('event.rsvp', row.id);
  return actionResult(row, [object], verification('rsvps.listForEvent', { eventId: event }, object));
}

async function cancelRsvp(input, actor) {
  // Same ownership rule as setRsvpStatus. (#24)
  const member = memberId(actor);
  const id = input.id;
  const eventId = input.eventId ?? input.event_id;
  // When the caller addresses by eventId, validate it points at a real event
  // before scanning rsvps — otherwise a typo collapses to a silent no-op
  // with `cancelled: false` and the client can't tell why. (#29)
  if (id == null && eventId != null) {
    const eventRow = (await selectRows('events')).find((row) => String(row.id) === String(eventId));
    if (!eventRow) {
      throw capabilityError('notFound.object', 'Event not found.', {
        object: { type: 'event', id: String(eventId) },
      });
    }
  }
  const existing =
    id != null
      ? (await selectRows('event_rsvps')).find((row) => String(row.id) === String(id))
      : (await selectRows('event_rsvps')).find(
          (row) => String(row.event_id) === String(eventId) && String(row.member_id) === String(member),
        );
  if (!existing) return actionResult({ cancelled: false }, [], null);
  if (String(existing.member_id) !== String(member) && !isAdminLike(actor) && !isModeratorLike(actor)) {
    throw capabilityError('permission.denied', 'rsvps.cancel can only cancel the active member RSVP.', {
      object: { type: 'event.rsvp', id: String(existing.id) },
    });
  }
  const row = await updateRow('event_rsvps', existing.id, { status: 'cancelled' });
  const object = changedObject('event.rsvp', row.id);
  return actionResult(row, [object], verification('rsvps.listForEvent', { eventId: row.event_id ?? eventId }, object));
}

async function uploadResource(input, actor) {
  // uploaded_by is bound to the actor — never honored from input. (#24)
  const metadata = isPlainObject(input.metadata) ? input.metadata : input;
  const resource = await insertRow('resources', {
    title: metadata.title || input.title || input.name || 'Resource',
    description: metadata.description || null,
    category: metadata.category || null,
    file_url: input.fileUrl || input.file_url || metadata.file_url || null,
    file_type: metadata.file_type || metadata.fileType || input.file_type || 'file',
    is_members_only: metadata.is_members_only !== false,
    uploaded_by: memberId(actor),
  });
  const activity = await writeActivity(actor, 'resource_upload', { title: resource.title, resource_id: resource.id });
  const object = changedObject('resource', resource.id);
  return actionResult(
    resource,
    [object],
    verification('resources.get', { id: resource.id }, object),
    auditReference(activity.id, 'resource_upload'),
  );
}

async function toggleReaction(input, actor) {
  const contentType = String(
    requiredAny(input.contentType ?? input.content_type, 'reactions.toggle requires contentType.'),
  );
  const contentId = requiredAny(input.contentId ?? input.content_id, 'reactions.toggle requires contentId.');
  const emoji = String(input.emoji || 'heart');
  const member = memberId(actor);
  const existing = (await selectRows('reactions')).find(
    (row) =>
      String(row.content_type) === contentType &&
      String(row.content_id) === String(contentId) &&
      String(row.member_id) === String(member) &&
      String(row.emoji) === emoji,
  );
  if (existing) {
    await deleteRow('reactions', requiredId(existing, 'reactions.toggle existing reaction'));
    return actionResult({ toggled: 'removed' }, [changedObject('reaction', existing.id)], null);
  }
  const reaction = await insertRow('reactions', {
    content_type: contentType,
    content_id: contentId,
    emoji,
    member_id: member,
  });
  return actionResult({ toggled: 'added', reaction }, [changedObject('reaction', reaction.id)], null);
}

async function translateContent(input) {
  const row = await insertRow('content_translations', {
    content_type: input.contentType || input.content_type || 'content',
    content_id: input.contentId || input.content_id || 0,
    language: input.language || 'en',
    field: input.field || 'body',
    translated_text: input.translated_text || input.translatedText || input.text || '',
  });
  return actionResult(row, [changedObject('translation', row.id)], verification('translations.list', { id: row.id }));
}

async function generateNewsletterDraft(input) {
  const draft = await insertRow('newsletter_drafts', {
    subject: input.subject || 'Newsletter',
    body: input.body || '',
    status: 'draft',
    period_start: input.periodStart || input.period_start || null,
    period_end: input.periodEnd || input.period_end || null,
  });
  const object = changedObject('newsletterDraft', draft.id);
  return actionResult(draft, [object], verification('newsletters.drafts.get', { id: draft.id }, object));
}

async function upsertConfig(input) {
  if (Array.isArray(input.entries)) {
    let last = {};
    for (const entry of input.entries) {
      if (isPlainObject(entry)) last = await upsertConfig(entry);
    }
    return last;
  }
  const key = String(requiredAny(input.key, 'config.set requires key.'));
  const patch = { value: input.value ?? null, category: input.category || 'general' };
  const existing = (await selectRows('site_config')).find((row) => row.key === key);
  if (existing) return updateConfigRow(key, patch);
  return insertRow('site_config', { key, ...patch });
}

// =============================================================================
// admin-content-management: custom page handlers + media/translation operations
// =============================================================================

const SLUG_RESERVED = new Set([
  'admin',
  'admin-members',
  'admin-settings',
  'index',
  'events',
  'event',
  'directory',
  'forum',
  'committees',
  'polls',
  'profile',
  'join',
  'search',
  'calendar',
  'page',
]);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

async function ensureUniqueSlug(slug) {
  const pages = await selectRows('pages');
  const taken = new Set(pages.map((p) => String(p.slug)));
  if (!taken.has(slug) && !SLUG_RESERVED.has(slug)) return slug;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${slug}-${n}`;
    if (!taken.has(candidate) && !SLUG_RESERVED.has(candidate)) return candidate;
  }
  throw capabilityError('conflict.state', 'Could not allocate a unique slug after 1000 attempts.', { slug });
}

async function findGlobalNavBlock() {
  const sections = await selectRows('sections');
  return (
    sections.find(
      (s) => s.section_type === 'nav' && String(s.scope || '') === 'global' && String(s.zone || '') === 'header',
    ) || null
  );
}

function navItemsArray(navBlock) {
  const cfg = navBlock?.config;
  if (!cfg || typeof cfg !== 'object') return [];
  const items = cfg.items;
  return Array.isArray(items) ? items : [];
}

async function createPageWithNav(input, _actor) {
  const rawSlug = typeof input.slug === 'string' && input.slug ? input.slug : slugify(input.title || '');
  const baseSlug = slugify(rawSlug) || slugify(input.title || '');
  if (!baseSlug) {
    throw capabilityError('validation.failed', 'pages.create requires a non-empty title or slug.', {
      slug: String(input.slug ?? ''),
      title: String(input.title ?? ''),
    });
  }
  const slug = await ensureUniqueSlug(baseSlug);
  const title = String(input.title || baseSlug);
  const showInNav = input.show_in_nav === true || input.showInNav === true;
  const requiresAuth = input.requires_auth === true || input.requiresAuth === true;
  const navPosition = Number.isFinite(input.nav_position) ? Number(input.nav_position) : null;

  const page = await insertRow('pages', {
    slug,
    title,
    content: typeof input.content === 'string' ? input.content : null,
    requires_auth: requiresAuth,
    show_in_nav: showInNav,
    nav_position: navPosition,
    published: input.published === false ? false : true,
  });

  const changed = [changedObject('page', page.id ?? slug)];
  let navNotFound = false;
  let navInserted = false;
  if (showInNav) {
    const nav = await findGlobalNavBlock();
    if (!nav) {
      navNotFound = true;
    } else {
      const items = navItemsArray(nav);
      const href = `/${slug}`;
      if (!items.some((item) => String(item?.href || '') === href)) {
        const newItem = { label: title, href, public: true };
        const nextItems = [...items, newItem];
        const nextConfig = { ...nav.config, items: nextItems };
        await updateRow('sections', nav.id, { config: nextConfig });
        changed.push(changedObject('section', nav.id));
        navInserted = true;
      }
    }
  }
  return actionResult(
    { ...page, nav_not_found: navNotFound, nav_inserted: navInserted },
    changed,
    verification('pages.get', { id: page.id ?? slug }, changed[0]),
  );
}

async function deletePageWithCascade(input, _actor) {
  const id = input.id;
  const slugInput = typeof input.slug === 'string' ? input.slug : null;
  const pages = await selectRows('pages');
  const page = id != null ? pages.find((p) => String(p.id) === String(id)) : pages.find((p) => p.slug === slugInput);
  if (!page) {
    throw capabilityError('notFound.object', 'Page not found.', {
      object: changedObject('page', id ?? slugInput ?? 'unknown'),
    });
  }
  if (SLUG_RESERVED.has(page.slug)) {
    throw capabilityError('conflict.state', `Cannot delete reserved page "${page.slug}".`, {
      object: changedObject('page', page.id),
    });
  }

  // Cascade: page-scoped sections
  const allSections = await selectRows('sections');
  const pageSections = allSections.filter((s) => s.page_slug === page.slug && String(s.scope || 'page') === 'page');
  for (const s of pageSections) {
    await deleteRow('sections', s.id);
  }

  // Nav side-effect: remove matching href from the global nav block, if any
  const navBlock = allSections.find(
    (s) => s.section_type === 'nav' && String(s.scope || '') === 'global' && String(s.zone || '') === 'header',
  );
  let navRemoved = false;
  if (navBlock) {
    const items = navItemsArray(navBlock);
    const href = `/${page.slug}`;
    const nextItems = items.filter((item) => String(item?.href || '') !== href);
    if (nextItems.length !== items.length) {
      const nextConfig = { ...navBlock.config, items: nextItems };
      await updateRow('sections', navBlock.id, { config: nextConfig });
      navRemoved = true;
    }
  }

  const deleted = await deleteRow('pages', page.id);
  const changed = [changedObject('page', page.id)];
  if (navRemoved) changed.push(changedObject('section', navBlock.id));
  for (const s of pageSections) changed.push(changedObject('section', s.id));
  return actionResult(
    { ...(deleted || page), nav_removed: navRemoved, cascaded_sections: pageSections.length },
    changed,
    null,
  );
}

// -- Media library: thin wrappers over upload-asset.js's storage delegation --
//
// `media.list` is a read-side handler (see handleMediaList below). `media.delete`
// is a mutation that also runs an in-use check against sections.config /
// site_config.value text. Both delegate the actual storage operations to
// upload-asset.js via an internal HTTP hop.

const UPLOAD_ASSET_FN = 'upload-asset';

async function callUploadAssetFn(body) {
  // The upload-asset function lives in the same project and is gated by the
  // same admin role check (today via SELECT-role; future via declarative
  // gate). Calling it via the gateway preserves the auth surface — we don't
  // bypass admin checks by short-circuiting to assets.put here.
  const url = `https://api.run402.com/functions/v1/${UPLOAD_ASSET_FN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${process.env.RUN402_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: 'invalid_json_response', raw: text };
  }
  if (!res.ok) {
    throw capabilityError('internal.error', json?.error || `upload-asset ${body.action || 'invoke'} failed`, {
      detail: json?.detail || null,
      status: res.status,
    });
  }
  return json;
}

async function handleMediaList(correlationId, input, actor) {
  if (!isAdminLike(actor)) {
    return errorResponse(correlationId, 403, {
      code: 'auth.forbidden',
      message: 'media.list requires admin role.',
      detail: { actor: actor.state },
      retryable: false,
    });
  }
  try {
    const result = await callUploadAssetFn({
      action: 'list',
      cursor: typeof input?.cursor === 'string' ? input.cursor : undefined,
      filter: isPlainObject(input?.filter) ? input.filter : undefined,
    });
    return successResponse(correlationId, {
      assets: Array.isArray(result?.assets) ? result.assets : [],
      nextCursor: result?.nextCursor ?? null,
    });
  } catch (err) {
    return errorResponse(correlationId, 500, {
      code: err?.capabilityCode || 'internal.error',
      message: err?.message || 'media.list failed',
      detail: err?.detail || null,
      retryable: true,
    });
  }
}

async function deleteMediaAsset(input, _actor) {
  const path = typeof input.path === 'string' ? input.path : '';
  if (!path) {
    throw capabilityError('validation.failed', 'media.delete requires path.', { path });
  }
  // In-use check: scan sections.config + site_config.value for the asset's
  // cdn_url substring. This is a Kychon-side warning, NOT a hard block —
  // platform-side variant revocation + immutable retention handles the
  // storage-side cleanup regardless.
  const cdnUrl = typeof input.cdn_url === 'string' ? input.cdn_url : null;
  let inUse = false;
  if (cdnUrl) {
    try {
      const probe = await adminDb().sql(
        "SELECT 1 FROM sections WHERE config::text LIKE '%' || $1 || '%' LIMIT 1 UNION ALL SELECT 1 FROM site_config WHERE value::text LIKE '%' || $1 || '%' LIMIT 1",
        [cdnUrl],
      );
      inUse = (probe.rows?.length || 0) > 0;
    } catch (err) {
      console.warn('[media.delete] in-use probe failed; defaulting to inUse=false', err);
    }
  }
  // If the UI flagged confirmed=false (i.e. preview the in-use check first),
  // return the signal without deleting. UI then re-calls with confirmed=true.
  if (inUse && input.confirmed !== true) {
    return actionResult({ status: 'pending_confirmation', inUse: true, path }, [], null);
  }
  const result = await callUploadAssetFn({ action: 'delete', path });
  return actionResult({ ...result, inUse }, [changedObject('asset', path)], null);
}

// -- section_translations: per-locale partial config overrides ---------------

function normaliseLanguageTag(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(v)) return null;
  return v;
}

async function upsertSectionTranslation(input, _actor) {
  const sectionId = Number(input.section_id ?? input.sectionId);
  if (!Number.isFinite(sectionId) || sectionId <= 0) {
    throw capabilityError('validation.failed', 'sections.translate requires numeric section_id.', {
      section_id: String(input.section_id ?? input.sectionId ?? ''),
    });
  }
  const language = normaliseLanguageTag(input.language);
  if (!language) {
    throw capabilityError('validation.failed', 'sections.translate requires a valid BCP-47 language tag.', {
      language: String(input.language ?? ''),
    });
  }
  if (!isPlainObject(input.config)) {
    throw capabilityError('validation.failed', 'sections.translate requires `config` as a JSON object.', {});
  }
  const configJson = JSON.stringify(input.config);
  // ON CONFLICT (section_id, language) DO UPDATE — single round-trip upsert.
  const result = await adminDb().sql(
    `INSERT INTO section_translations (section_id, language, config, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, now(), now())
     ON CONFLICT (section_id, language) DO UPDATE
       SET config = EXCLUDED.config, updated_at = now()
     RETURNING id, section_id, language, config, created_at, updated_at`,
    [sectionId, language, configJson],
  );
  const row = (result.rows || [])[0] || { section_id: sectionId, language, config: input.config };
  return actionResult(row, [changedObject('sectionTranslation', `${sectionId}:${language}`)], null);
}

async function handleSectionTranslationGet(correlationId, input, actor) {
  if (!isAdminLike(actor)) {
    return errorResponse(correlationId, 403, {
      code: 'auth.forbidden',
      message: 'sections.getTranslation requires admin role.',
      detail: { actor: actor.state },
      retryable: false,
    });
  }
  const sectionId = Number(input?.section_id ?? input?.sectionId);
  const language = normaliseLanguageTag(input?.language);
  if (!Number.isFinite(sectionId) || sectionId <= 0 || !language) {
    return errorResponse(correlationId, 400, {
      code: 'validation.failed',
      message: 'sections.getTranslation requires numeric section_id and a valid language tag.',
      detail: {
        section_id: String(input?.section_id ?? input?.sectionId ?? ''),
        language: String(input?.language ?? ''),
      },
      retryable: false,
    });
  }
  try {
    const result = await adminDb().sql(
      'SELECT id, section_id, language, config, created_at, updated_at FROM section_translations WHERE section_id = $1 AND language = $2 LIMIT 1',
      [sectionId, language],
    );
    const row = (result.rows || [])[0] || null;
    return successResponse(correlationId, { translation: row });
  } catch (err) {
    return errorResponse(correlationId, 500, {
      code: 'internal.error',
      message: 'sections.getTranslation failed',
      detail: { error: String(err?.message || err) },
      retryable: true,
    });
  }
}

function rowForCreate(operation, input, actor) {
  // Author/owner fields are always bound to the actor — never accepted from
  // input. Letting input override them lets an active member spoof identity
  // on every generic create handler. (#24)
  if (operation.startsWith('polls.')) return { ...stripControlFields(input), created_by: memberId(actor) };
  if (operation.startsWith('events.')) return { ...stripControlFields(input), created_by: memberId(actor) };
  if (operation.startsWith('activity.')) return { ...stripControlFields(input), member_id: memberId(actor) };
  if (operation.startsWith('reactions.')) return { ...stripControlFields(input), member_id: memberId(actor) };
  return stripControlFields(input);
}

function rowForUpdate(operation, input, actor) {
  if (operation === 'members.updateProfile') return memberProfilePatch(input);
  if (operation === 'members.approve') return { status: 'active' };
  if (operation === 'members.reject') return { status: 'rejected' };
  if (operation === 'members.suspend') return { status: 'suspended' };
  if (operation === 'members.reactivate') return { status: 'active' };
  if (operation === 'members.changeTier') return { tier_id: input.tierId ?? input.tier_id ?? null };
  if (operation === 'members.changeRole') return { role: input.role || 'member' };
  if (operation === 'members.setExpiration') return { expires_at: input.expiresAt ?? input.expires_at ?? null };
  if (operation === 'members.linkUser') return { user_id: input.userId ?? input.user_id ?? null };
  if (operation === 'registrationOptions.disable') return { is_disabled: true };
  if (operation === 'registrationOptions.enable') return { is_disabled: false };
  if (operation === 'registrationOptions.markReviewed') return { review_state: 'reviewed' };
  if (operation === 'registrationOptions.ignore') return { review_state: 'ignored' };
  if (operation === 'events.reviewImport')
    return { import_review_state: input.reviewState || input.review_state || 'reviewed' };
  if (operation.endsWith('.pin')) return { is_pinned: true };
  if (operation.endsWith('.unpin')) return { is_pinned: false };
  if (operation.endsWith('.lock')) return { locked: true };
  if (operation.endsWith('.unlock')) return { locked: false };
  if (operation.endsWith('.hide')) return { hidden: true };
  if (operation.endsWith('.unhide')) return { hidden: false };
  if (operation.endsWith('.close')) return { is_open: false };
  if (operation.endsWith('.reopen')) return { is_open: true };
  if (operation === 'moderation.approve')
    return { action: 'approved', reviewed_by: input.reviewed_by ?? memberId(actor) };
  if (operation === 'moderation.hide') return { action: 'hidden', reviewed_by: input.reviewed_by ?? memberId(actor) };
  if (operation === 'moderation.markReviewed')
    return { action: input.action || 'reviewed', reviewed_by: input.reviewed_by ?? memberId(actor) };
  if (operation === 'insights.updateStatus') return { status: input.status || 'reviewed' };
  if (operation === 'insights.dismiss') return { status: 'dismissed' };
  if (operation === 'announcements.update') {
    const patch = stripControlFields(input);
    if (patch.body != null) patch.body = sanitizeRichHtmlServer(patch.body);
    return patch;
  }
  return stripControlFields(input);
}

function mutationSpec(operation) {
  if (operation.startsWith('config.'))
    return { table: 'site_config', objectType: 'config.entry', action: 'upsertConfig' };
  if (operation.startsWith('pages.')) return spec('pages', 'page', operation);
  if (operation.startsWith('sections.')) return spec('sections', 'section', operation);
  if (operation.startsWith('members.')) return spec('members', 'member', operation);
  if (operation.startsWith('tiers.')) return spec('membership_tiers', 'member.tier', operation);
  if (operation.startsWith('memberFields.')) return spec('member_custom_fields', 'member.field', operation);
  if (operation.startsWith('events.')) return spec('events', 'event', operation);
  if (operation.startsWith('registrationOptions.'))
    return spec('event_registration_options', 'event.registrationOption', operation);
  if (operation.startsWith('rsvps.')) return spec('event_rsvps', 'event.rsvp', operation);
  if (operation.startsWith('announcements.')) return spec('announcements', 'announcement', operation);
  if (operation.startsWith('resources.')) return spec('resources', 'resource', operation);
  if (operation.startsWith('forum.categories.')) return spec('forum_categories', 'forum.category', operation);
  if (operation.startsWith('forum.topics.')) return spec('forum_topics', 'forum.topic', operation);
  if (operation.startsWith('forum.replies.')) return spec('forum_replies', 'forum.reply', operation);
  if (operation.startsWith('polls.')) return spec('polls', 'poll', operation);
  if (operation.startsWith('pollOptions.')) return spec('poll_options', 'poll.option', operation);
  if (operation.startsWith('committees.')) return spec('committees', 'committee', operation);
  if (operation.startsWith('committeeMembers.')) return spec('committee_members', 'committee.member', operation);
  if (operation.startsWith('reactions.')) return spec('reactions', 'reaction', operation);
  if (operation.startsWith('moderation.')) return spec('moderation_log', 'moderation.review', operation);
  if (operation.startsWith('translations.')) return spec('content_translations', 'translation', operation);
  if (operation.startsWith('newsletters.drafts.')) return spec('newsletter_drafts', 'newsletterDraft', operation);
  if (operation.startsWith('insights.')) return spec('member_insights', 'insight', operation);
  if (operation.startsWith('activity.')) return spec('activity_log', 'activityEntry', operation);
  if (operation.startsWith('exports.')) return { table: 'capability_executions', objectType: 'job', action: 'create' };
  return null;
}

function spec(table, objectType, operation) {
  const action =
    operation.endsWith('.create') ||
    operation.endsWith('.add') ||
    operation.endsWith('.upload') ||
    operation.endsWith('.generate')
      ? 'create'
      : operation.endsWith('.delete') || operation.endsWith('.remove')
        ? 'delete'
        : 'update';
  return { table, objectType, action };
}

async function insertRow(table, row) {
  const cleaned = cleanRow(row);
  if (SQL_WRITE_TABLES.has(table)) return insertRowSql(table, cleaned);
  const result = await adminDb().from(table).insert(cleaned);
  return normalizeDbRows(result)[0] || cleaned;
}

async function updateRow(table, id, patch) {
  const cleaned = cleanRow(patch);
  if (SQL_WRITE_TABLES.has(table)) return updateRowSql(table, 'id', id, cleaned);
  const existing = await selectOneRow(table, 'id', id);
  if (!existing) return null;
  const result = await adminDb().from(table).update(cleaned).eq('id', id);
  return normalizeDbRows(result)[0] || { ...existing, ...cleaned };
}

async function updateConfigRow(key, patch) {
  const result = await adminDb().from('site_config').update(cleanRow(patch)).eq('key', key);
  return normalizeDbRows(result)[0] || { key, ...cleanRow(patch) };
}

async function deleteRow(table, id) {
  if (SQL_WRITE_TABLES.has(table)) return deleteRowSql(table, 'id', id);
  const existing = (await selectRows(table)).find((row) => String(row.id) === String(id)) || { id };
  await adminDb().from(table).delete().eq('id', id);
  return existing;
}

async function insertRowSql(table, row) {
  const entries = Object.entries(row);
  if (!entries.length) {
    const result = await adminDb().sql(`INSERT INTO ${quoteIdent(table)} DEFAULT VALUES RETURNING *`);
    return normalizeDbRows(result)[0] || {};
  }
  const columns = entries.map(([key]) => quoteIdent(key)).join(', ');
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);
  const result = await adminDb().sql(
    `INSERT INTO ${quoteIdent(table)} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values,
  );
  return normalizeDbRows(result)[0] || row;
}

async function updateRowSql(table, keyColumn, keyValue, patch) {
  const entries = Object.entries(patch);
  if (!entries.length) return selectOneRowSql(table, keyColumn, keyValue);
  const assignments = entries.map(([key], index) => `${quoteIdent(key)} = $${index + 1}`).join(', ');
  const values = [...entries.map(([, value]) => value), keyValue];
  const result = await adminDb().sql(
    `UPDATE ${quoteIdent(table)} SET ${assignments} WHERE ${quoteIdent(keyColumn)} = $${values.length} RETURNING *`,
    values,
  );
  return normalizeDbRows(result)[0] || null;
}

async function deleteRowSql(table, keyColumn, keyValue) {
  const result = await adminDb().sql(
    `DELETE FROM ${quoteIdent(table)} WHERE ${quoteIdent(keyColumn)} = $1 RETURNING *`,
    [keyValue],
  );
  return normalizeDbRows(result)[0] || { [keyColumn]: keyValue };
}

async function selectOneRowSql(table, keyColumn, keyValue) {
  const result = await adminDb().sql(`SELECT * FROM ${quoteIdent(table)} WHERE ${quoteIdent(keyColumn)} = $1 LIMIT 1`, [
    keyValue,
  ]);
  return normalizeDbRows(result)[0] || null;
}

async function selectOneRow(table, keyColumn, keyValue) {
  const result = await adminDb().from(table).select('*').eq(keyColumn, keyValue).limit(1);
  return normalizeDbRows(result)[0] || null;
}

function objectTypeLabel(objectType) {
  if (objectType === 'member') return 'Member';
  return 'Object';
}

function normalizeDbRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;
  return result ? [result] : [];
}

function cleanRow(row) {
  return Object.fromEntries(Object.entries(row || {}).filter(([, value]) => value !== undefined));
}

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name))) {
    throw capabilityError('validation.failed', `Unsafe SQL identifier: ${name}`);
  }
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function writeActivity(actor, action, metadata) {
  return insertRow('activity_log', { member_id: memberId(actor), action, metadata });
}

function verificationFor(objectType, object) {
  const operation =
    objectType === 'member'
      ? 'members.get'
      : objectType === 'event'
        ? 'events.get'
        : objectType === 'announcement'
          ? 'announcements.get'
          : objectType === 'resource'
            ? 'resources.get'
            : null;
  return operation ? verification(operation, { id: object.id }, object) : null;
}

function verification(operation, input, object) {
  return {
    operation,
    phase: 'query',
    input,
    ...(object ? { object } : {}),
  };
}

function actionResult(result, changed, verify, audit = null) {
  return { result, changed, audit, verify };
}

function changedObject(type, id, extra = {}) {
  return { type, id: String(id), ...extra };
}

function auditReference(id, action) {
  return { object: changedObject('activityEntry', id), action };
}

function memberId(actor) {
  return actor.member?.id || null;
}

function requiredId(input, operation) {
  return requiredAny(input.id, `${operation} requires id.`);
}

function idForUpdate(operation, input, actor) {
  if (operation !== 'members.updateProfile') return requiredId(input, operation);
  const actorMemberId = memberId(actor);
  if (!actorMemberId) throw capabilityError('permission.denied', 'members.updateProfile requires an active member.');
  if (input.id != null && String(input.id) !== String(actorMemberId)) {
    throw capabilityError('permission.denied', 'members.updateProfile can only update the active member profile.', {
      object: changedObject('member', String(input.id)),
    });
  }
  return actorMemberId;
}

function memberProfilePatch(input) {
  const patch = {};
  for (const field of ['display_name', 'avatar_url', 'bio', 'custom_fields']) {
    if (input[field] !== undefined) patch[field] = input[field];
  }
  return patch;
}

function requiredAny(value, message) {
  // Reject "" / "   " / 0 / NaN — they parse as a "value" but never match a
  // real row, producing a silent no-op instead of a clear validation error.
  // (#27 item 6)
  if (typeof value === 'string') {
    if (value.trim() === '') throw capabilityError('validation.failed', message);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) throw capabilityError('validation.failed', message);
    return value;
  }
  throw capabilityError('validation.failed', message);
}

// Privileged fields the active actor must never override on a create/update
// path — any change to these flows through dedicated capability operations
// (members.changeRole, *.pin, *.lock, etc.) that have their own role gate. (#24)
const PRIVILEGED_INPUT_FIELDS = new Set([
  'id',
  'operation',
  'author_id',
  'member_id',
  'memberId',
  'created_by',
  'createdBy',
  'reviewed_by',
  'uploaded_by',
  'user_id',
  'userId',
  'role',
  'is_pinned',
  'isPinned',
  'pin',
  'locked',
  'hidden',
  'tier_id',
  'tierId',
]);

// Server-side rich-HTML sanitizer mirroring the read-side allowlist in
// `src/lib/sanitize-html.ts`. Run402 functions run in a Node-like runtime
// without DOMParser, so we strip the obvious attack vectors with regex as
// belt-and-braces for the read-side sanitizer. (#29)
function sanitizeRichHtmlServer(input) {
  if (input == null) return '';
  let html = String(input);
  // Strip executable / sandbox-escape tags and their content.
  html = html.replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  // Strip risky tags, including slash-separated unclosed forms like <svg/onload=...>.
  html = html.replace(/<\/?\s*(script|style|iframe|object|embed|svg|math|details|link|meta)(?:\s|\/|>)[^>]*>/gi, '');
  // Strip event handlers and inline style payloads, including slash-separated attributes.
  html = html.replace(/[\s/]+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutralize javascript:/vbscript: URLs after decoding common HTML entities.
  html = html.replace(/\s(href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (_match, attr, rawValue) => {
    const value = rawValue.replace(/^["']|["']$/g, '');
    const decoded = decodeHtmlEntities(value).trim();
    return /^(?:javascript|vbscript):/i.test(decoded) ? '' : ` ${attr}=${rawValue}`;
  });
  html = html.replace(/(\s\w+\s*=\s*["'])\s*(?:javascript|vbscript)\s*:/gi, '$1about:blank#blocked-');
  html = html.replace(/(\s\w+\s*=\s*)(?:javascript|vbscript)\s*:/gi, '$1about:blank#blocked-');
  return html;
}

function decodeHtmlEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized.startsWith('#x')) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    if (normalized.startsWith('#')) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    return match;
  });
}

function stripControlFields(input) {
  if (!input) return {};
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (PRIVILEGED_INPUT_FIELDS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function capabilityError(code, message, detail) {
  const error = new Error(message);
  error.capabilityCode = code;
  if (detail) error.detail = detail;
  return error;
}

function mutationStatus(code) {
  if (code === 'permission.denied') return 403;
  if (code === 'validation.failed') return 400;
  if (code === 'notFound.object') return 404;
  if (code === 'conflict.idempotencyKey') return 409;
  if (code === 'conflict.state') return 409;
  return 501;
}

function mutationErrorCode(code) {
  if (
    ['permission.denied', 'validation.failed', 'notFound.object', 'conflict.idempotencyKey', 'conflict.state'].includes(
      code,
    )
  )
    return code;
  return 'internal.error';
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
  for (const [inputKey, value] of Object.entries(input)) {
    if (value == null || typeof value === 'object') continue;
    const rowKey = inputKey in row ? inputKey : inputKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (rowKey in row && String(row[rowKey]) !== String(value)) return false;
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

// Strip server-attribution columns from anonymous projections of events and
// announcements — anon clients have no business knowing which member created
// what, and those ids are useful pivots for the IDOR shapes in #24. (#27 item 5)
function eventRow(row, actor) {
  if (isAdminLike(actor) || isModeratorLike(actor)) return row;
  const { created_by: _createdBy, ...rest } = row;
  return rest;
}

function announcementRow(row, actor) {
  if (isAdminLike(actor) || isModeratorLike(actor)) return row;
  const { author_id: _authorId, ...rest } = row;
  return rest;
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
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
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
  return String(value || '')
    .toLowerCase()
    .includes(query.toLowerCase());
}

function searchObjectRef(row) {
  const sourceType = String(row.source_type || '');
  const id = String(row.source_key || row.id || '');
  if (sourceType === 'page') return { type: 'page', id };
  if (sourceType === 'resource') return { type: 'resource', id };
  if (sourceType === 'event') return { type: 'event', id };
  return { type: 'portal', id: sourceType || 'unknown' };
}

const RESERVED_CLEAN_PAGE_SLUGS = new Set([
  '',
  'index',
  'page',
  'admin',
  'admin-members',
  'admin-settings',
  'calendar',
  'committees',
  'directory',
  'event',
  'events',
  'forum',
  'join',
  'polls',
  'profile',
  'resources',
  'search',
  'ui-tokens',
]);

function safeCustomPageSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED_CLEAN_PAGE_SLUGS.has(slug);
}

function searchResultUrl(row) {
  const sourceType = String(row.source_type || '');
  const sourceKey = String(row.source_key || '');
  if (sourceType === 'resource') return `/resources#resource-${encodeURIComponent(sourceKey)}`;
  if (sourceType === 'event') return `/event?id=${encodeURIComponent(sourceKey)}`;
  if (sourceType === 'page') {
    if (sourceKey === 'index') return '/';
    return safeCustomPageSlug(sourceKey) ? `/${sourceKey}` : `/page.html?slug=${encodeURIComponent(sourceKey)}`;
  }
  const raw = String(row.url || '/');
  return raw.startsWith('/') ? raw : '/';
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
  const byUserId = await db
    .from('members')
    .select('id,user_id,email,display_name,role,status')
    .eq('user_id', user.id)
    .limit(1);
  if (byUserId?.[0]) return normalizeMember(byUserId[0], 'user_id');

  const email = normalizeEmail(user.email);
  if (email) {
    const byEmail = await db
      .from('members')
      .select('id,user_id,email,display_name,role,status')
      .eq('email', email)
      .limit(1);
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
  const allowed =
    actorRank(actor.state) >= actorRank(operation.auth.minimumActorState) || actor.state === 'project_admin';
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
    costClass: name.startsWith('exports.')
      ? 'privateData'
      : name.startsWith('translations.') || name.includes('newsletters.drafts.generate')
        ? 'metered'
        : 'free',
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
    [
      'config.get',
      'pages.list',
      'pages.get',
      'sections.list',
      'sections.get',
      'tiers.list',
      'memberFields.list',
      'events.list',
      'events.get',
      'registrationOptions.list',
      'announcements.list',
      'announcements.get',
      'resources.list',
      'resources.get',
      'committees.list',
      'committees.get',
      // members.list / members.get are anonymous at the registry level
      // because `site_config.directory_public === true` is a real,
      // supported deployment mode (silver-pines in the demos). The
      // runtime handler still enforces `directory_public` per call
      // via `assertDirectoryAccessibleForMembersList` — when the flag
      // is false (eagles, barrio) the call rejects with
      // `permission.denied` (reason: 'directory_private') the same
      // way the previous registry-level 'active_member' floor did.
      // Sensitive fields stay redacted by `memberRow` regardless.
      'members.list',
      'members.get',
    ].includes(name)
  ) {
    return 'anonymous';
  }
  if (
    [
      'rsvps.listForEvent',
      'rsvps.listMine',
      'forum.categories.list',
      'forum.categories.get',
      'forum.topics.list',
      'forum.topics.get',
      'forum.replies.list',
      'polls.list',
      'polls.get',
      'polls.getAttached',
      'pollOptions.list',
      'pollVotes.list',
      'pollResults.get',
      'committeeMembers.list',
      'reactions.list',
      'activity.list',
    ].includes(name) ||
    name.startsWith('forum.topics.create') ||
    name.startsWith('forum.topics.update') ||
    name.startsWith('forum.replies.create') ||
    name.startsWith('forum.replies.update') ||
    name.startsWith('pollVotes.') ||
    name.startsWith('rsvps.') ||
    name.startsWith('reactions.') ||
    name.startsWith('activity.') ||
    ['members.updateProfile'].includes(name)
  ) {
    return 'active_member';
  }
  if (name.startsWith('forum.') || name.startsWith('moderation.')) return 'moderator';
  return 'admin';
}

function actorRank(state) {
  return (
    {
      anonymous: 0,
      authenticated_non_member: 1,
      pending_member: 2,
      active_member: 3,
      moderator: 4,
      admin: 5,
      project_admin: 6,
    }[state] ?? 0
  );
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
