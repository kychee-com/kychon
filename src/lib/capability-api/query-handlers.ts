import { getOperation } from './operations.js';
import { checkOperationPermission } from './permissions.js';
import { buildEventResultUrl, buildPageResultUrl, buildResourceResultUrl } from '../search.js';
import type { CapabilityActor } from './actor.js';
import type { JsonObject, JsonValue, ObjectRef, OperationName } from './types.js';

export interface CapabilityQueryDb {
  select(table: string): Promise<JsonObject[]>;
}

export interface CapabilityQueryContext {
  actor: CapabilityActor;
  db: CapabilityQueryDb;
}

type QueryHandler = (input: JsonObject, ctx: CapabilityQueryContext) => Promise<JsonValue>;

const tableQueries: Record<string, QueryHandler> = {
  'config.get': (input, ctx) => tableResult(ctx, 'site_config', input, configRow),
  'pages.list': (input, ctx) => listResult(ctx, 'pages', input, (row) => visiblePage(row, ctx.actor)),
  'pages.get': (input, ctx) => oneResult(ctx, 'pages', input, (row) => visiblePage(row, ctx.actor), undefined, ['id', 'slug']),
  'sections.list': (input, ctx) => listResult(ctx, 'sections', input, (row) => visibleSection(row, ctx.actor)),
  'sections.get': (input, ctx) => oneResult(ctx, 'sections', input, (row) => visibleSection(row, ctx.actor)),
  'members.list': async (input, ctx) => {
    await assertCanListMembers(ctx);
    return listResult(ctx, 'members', input, () => true, (row) => memberRow(row, ctx.actor));
  },
  'members.get': async (input, ctx) => {
    await assertCanListMembers(ctx);
    return oneResult(ctx, 'members', input, () => true, (row) => memberRow(row, ctx.actor));
  },
  'tiers.list': (input, ctx) => listResult(ctx, 'membership_tiers', input),
  'memberFields.list': (input, ctx) => listResult(ctx, 'member_custom_fields', input, (row) => visibleMemberField(row, ctx.actor)),
  'events.list': (input, ctx) => listResult(ctx, 'events', input, (row) => visibleMembersOnly(row, ctx.actor)),
  'events.get': (input, ctx) => oneResult(ctx, 'events', input, (row) => visibleMembersOnly(row, ctx.actor)),
  'registrationOptions.list': (input, ctx) => listResult(ctx, 'event_registration_options', input),
  'rsvps.listForEvent': (input, ctx) => listResult(ctx, 'event_rsvps', input),
  'rsvps.listMine': async (input, ctx) =>
    listResult(ctx, 'event_rsvps', { ...input, memberId: ctx.actor.member?.id || '__none__' }),
  'announcements.list': (input, ctx) => listResult(ctx, 'announcements', input),
  'announcements.get': (input, ctx) => oneResult(ctx, 'announcements', input),
  'resources.list': (input, ctx) => listResult(ctx, 'resources', input, (row) => visibleMembersOnly(row, ctx.actor)),
  'resources.get': (input, ctx) => oneResult(ctx, 'resources', input, (row) => visibleMembersOnly(row, ctx.actor)),
  'forum.categories.list': (input, ctx) => listResult(ctx, 'forum_categories', input),
  'forum.categories.get': (input, ctx) => oneResult(ctx, 'forum_categories', input),
  'forum.topics.list': (input, ctx) => listResult(ctx, 'forum_topics', input, (row) => visibleForumRow(row, ctx.actor)),
  'forum.topics.get': (input, ctx) => oneResult(ctx, 'forum_topics', input, (row) => visibleForumRow(row, ctx.actor)),
  'forum.replies.list': (input, ctx) => listResult(ctx, 'forum_replies', input, (row) => visibleForumRow(row, ctx.actor)),
  'polls.list': (input, ctx) => listResult(ctx, 'polls', input, (row) => visiblePoll(row, ctx.actor)),
  'polls.get': (input, ctx) => oneResult(ctx, 'polls', input, (row) => visiblePoll(row, ctx.actor)),
  'polls.getAttached': (input, ctx) =>
    oneResult(ctx, 'polls', input, (row) => matchesAttached(row, input), undefined, ['attachedTo', 'attachedId']),
  'pollOptions.list': (input, ctx) => listResult(ctx, 'poll_options', input),
  'pollVotes.list': (input, ctx) => pollVotesList(input, ctx),
  'pollResults.get': pollResults,
  'committees.list': (input, ctx) => listResult(ctx, 'committees', input),
  'committees.get': (input, ctx) => oneResult(ctx, 'committees', input),
  'committeeMembers.list': (input, ctx) => listResult(ctx, 'committee_members', input),
  'reactions.list': (input, ctx) => listResult(ctx, 'reactions', input),
  'moderation.queue': (input, ctx) => listResult(ctx, 'moderation_log', input),
  'translations.list': (input, ctx) => listResult(ctx, 'content_translations', input),
  'newsletters.drafts.list': (input, ctx) => listResult(ctx, 'newsletter_drafts', input),
  'newsletters.drafts.get': (input, ctx) => oneResult(ctx, 'newsletter_drafts', input),
  'insights.list': (input, ctx) => listResult(ctx, 'member_insights', input),
  'activity.list': (input, ctx) => listResult(ctx, 'activity_log', input),
  'jobs.status': (input, ctx) => listResult(ctx, 'capability_executions', input),
};

export async function runCapabilityQuery(
  operationName: OperationName | string,
  input: JsonObject,
  ctx: CapabilityQueryContext,
): Promise<JsonValue> {
  const operation = getOperation(String(operationName));
  if (!operation || !operation.phases.includes('query')) {
    throw new CapabilityQueryError('api.unsupportedPhase', `Operation ${operationName} is not a query operation.`);
  }

  const permission = checkOperationPermission(ctx.actor, operation);
  if (!permission.allowed) {
    throw new CapabilityQueryError('permission.denied', `Permission denied for ${operation.name}.`, permission as unknown as JsonObject);
  }

  if (operation.name === 'search.query') return search(input, ctx, false);
  if (operation.name === 'search.suggest') return search(input, ctx, true);

  const handler = tableQueries[String(operation.name)];
  if (!handler) throw new CapabilityQueryError('internal.error', `Query handler for ${operation.name} is not implemented.`);
  return handler(input, ctx);
}

export class CapabilityQueryError extends Error {
  code: string;
  detail?: JsonObject;

  constructor(code: string, message: string, detail?: JsonObject) {
    super(message);
    this.name = 'CapabilityQueryError';
    this.code = code;
    this.detail = detail;
  }
}

async function tableResult(
  ctx: CapabilityQueryContext,
  table: string,
  input: JsonObject,
  map: (row: JsonObject) => JsonObject = (row) => row,
): Promise<JsonValue> {
  const rows = await ctx.db.select(table);
  if (typeof input.key === 'string') {
    const row = rows.find((item) => item.key === input.key);
    return row ? map(row) : null;
  }
  return { rows: rows.map(map), count: rows.length };
}

async function listResult(
  ctx: CapabilityQueryContext,
  table: string,
  input: JsonObject,
  visible: (row: JsonObject) => boolean = () => true,
  map: (row: JsonObject) => JsonObject = (row) => row,
): Promise<JsonValue> {
  const rows = (await ctx.db.select(table)).filter((row) => matchesInput(row, input)).filter(visible).map(map);
  return {
    rows,
    count: rows.length,
  };
}

async function oneResult(
  ctx: CapabilityQueryContext,
  table: string,
  input: JsonObject,
  visible: (row: JsonObject) => boolean = () => true,
  map: (row: JsonObject) => JsonObject = (row) => row,
  keys: string[] = ['id'],
): Promise<JsonValue> {
  requireGetIdentifier(keys, input, table);
  const rows = (await ctx.db.select(table)).filter((row) => matchesInput(row, input)).filter(visible);
  return rows[0] ? map(rows[0]) : null;
}

// A `*.get` must be addressed by a required identifier. Without this guard an
// empty input matched every row and returned row 0; a wrong-typed id returned
// null. Both now fail as validation.failed. (#107)
function requireGetIdentifier(keys: string[], input: JsonObject, table: string): void {
  if (!keys.some((key) => input[key] != null)) {
    throw new CapabilityQueryError('validation.failed', `${table}.get requires ${keys.join(' or ')}.`, { keys });
  }
  if (input.id != null && !Number.isInteger(Number(input.id))) {
    throw new CapabilityQueryError('validation.failed', `${table}.get id must be an integer.`, { id: String(input.id) });
  }
}

async function search(input: JsonObject, ctx: CapabilityQueryContext, suggest: boolean): Promise<JsonValue> {
  const query = normalizeSearchQuery(input.q ?? input.query ?? '');
  const type = typeof input.type === 'string' ? input.type : 'all';
  const page = suggest ? 1 : positiveInt(input.page, 1);
  const pageSize = suggest ? 5 : Math.min(positiveInt(input.pageSize ?? input.page_size, 10), 50);
  const docs = (await ctx.db.select('search_documents'))
    .filter((row) => row.published !== false)
    .filter((row) => visibleMembersOnly(row, ctx.actor))
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

  return {
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
  };
}

async function pollResults(input: JsonObject, ctx: CapabilityQueryContext): Promise<JsonValue> {
  const poll = (await ctx.db.select('polls')).find((row) => matchesInput(row, input) || row.id === input.pollId);
  if (!poll || !visiblePollResults(poll, ctx.actor, await ctx.db.select('poll_votes'))) return null;

  const options = (await ctx.db.select('poll_options')).filter((row) => String(row.poll_id) === String(poll.id));
  const votes = (await ctx.db.select('poll_votes')).filter((row) => String(row.poll_id) === String(poll.id));
  return {
    poll: objectRefJson({ type: 'poll', id: String(poll.id) }),
    totalVotes: votes.length,
    options: options.map((option) => ({
      option,
      voteCount: votes.filter((vote) => String(vote.option_id) === String(option.id)).length,
    })),
  };
}

async function pollVotesList(input: JsonObject, ctx: CapabilityQueryContext): Promise<JsonValue> {
  const votes = (await ctx.db.select('poll_votes')).filter((row) => matchesInput(row, input));
  const anonymousPollIds = new Set(
    (await ctx.db.select('polls')).filter((poll) => poll.is_anonymous === true).map((poll) => String(poll.id)),
  );
  // Anonymous polls must not expose voter identity in API responses; member_id
  // stays in the DB only to enforce vote uniqueness. Redaction is unconditional
  // — anonymity applies to every caller, admins included. (#117)
  const rows = votes.map((vote) =>
    anonymousPollIds.has(String(vote.poll_id)) ? { ...vote, member_id: null } : vote,
  );
  return { rows, count: rows.length };
}

function matchesInput(row: JsonObject, input: JsonObject): boolean {
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
  ] as const) {
    if (input[inputKey] != null && String(row[rowKey]) !== String(input[inputKey])) return false;
  }
  for (const [inputKey, value] of Object.entries(input)) {
    if (value == null || typeof value === 'object') continue;
    const rowKey = inputKey in row ? inputKey : inputKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (rowKey in row && String(row[rowKey]) !== String(value)) return false;
  }
  return true;
}

function configRow(row: JsonObject): JsonObject {
  return {
    key: row.key,
    value: row.value,
    category: row.category,
  };
}

function memberRow(row: JsonObject, actor: CapabilityActor): JsonObject {
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

function visiblePage(row: JsonObject, actor: CapabilityActor): boolean {
  if (isAdminLike(actor)) return true;
  return row.published !== false && (row.requires_auth !== true || canSeeMembersOnly(actor));
}

function visibleSection(row: JsonObject, actor: CapabilityActor): boolean {
  if (isAdminLike(actor)) return true;
  return row.visible !== false && (row.scope !== 'admin' || isAdminLike(actor));
}

function visibleMemberField(row: JsonObject, actor: CapabilityActor): boolean {
  return isAdminLike(actor) || row.visible_in_directory !== false;
}

function visibleMembersOnly(row: JsonObject, actor: CapabilityActor): boolean {
  return row.is_members_only !== true || canSeeMembersOnly(actor);
}

function visibleForumRow(row: JsonObject, actor: CapabilityActor): boolean {
  return isModeratorLike(actor) || row.hidden !== true;
}

function visiblePoll(row: JsonObject, actor: CapabilityActor): boolean {
  return isAdminLike(actor) || row.hidden !== true;
}

function visiblePollResults(poll: JsonObject, actor: CapabilityActor, votes: JsonObject[]): boolean {
  if (isAdminLike(actor)) return true;
  if (poll.results_visible === 'always') return true;
  if (poll.results_visible === 'after_close') return poll.is_open === false;
  if (poll.results_visible === 'after_vote' && actor.member) {
    return votes.some((vote) => String(vote.poll_id) === String(poll.id) && String(vote.member_id) === actor.member?.id);
  }
  return false;
}

function matchesAttached(row: JsonObject, input: JsonObject): boolean {
  return String(row.attached_to) === String(input.attachedTo) && String(row.attached_id) === String(input.attachedId);
}

function canSeeMembersOnly(actor: CapabilityActor): boolean {
  return ['active_member', 'moderator', 'admin', 'project_admin'].includes(actor.state);
}

/**
 * Gate for the `members.list` / `members.get` handlers. Allows the
 * call when EITHER:
 *   - `site_config.directory_public === true` (anyone can browse)
 *   - the actor is at least `active_member` (the historical floor;
 *     covers signed-in members + admins regardless of the flag)
 * Otherwise throws `permission.denied`, matching the registry-level
 * gate the call would have hit before this op opened up to anon.
 *
 * Reads `directory_public` per-call via `ctx.db.select('site_config')`.
 * Site config is small (typically <50 rows) and the call is rare;
 * not worth a per-context cache.
 */
async function assertCanListMembers(ctx: CapabilityQueryContext): Promise<void> {
  if (canSeeMembersOnly(ctx.actor)) return;
  const configRows = await ctx.db.select('site_config');
  const row = configRows.find((entry) => entry.key === 'directory_public');
  const directoryPublic = row?.value === true || row?.value === 'true';
  if (directoryPublic) return;
  throw new CapabilityQueryError(
    'permission.denied',
    'Permission denied for members.list.',
    { reason: 'directory_private', actorState: ctx.actor.state } as unknown as JsonObject,
  );
}

function isModeratorLike(actor: CapabilityActor): boolean {
  return ['moderator', 'admin', 'project_admin'].includes(actor.state);
}

function isAdminLike(actor: CapabilityActor): boolean {
  return ['admin', 'project_admin'].includes(actor.state);
}

function normalizeSearchQuery(value: JsonValue): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function positiveInt(value: JsonValue, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function searchTypeMatches(row: JsonObject, type: string): boolean {
  if (type === 'all') return true;
  const sourceType = type === 'pages' ? 'page' : type === 'resources' ? 'resource' : type === 'events' ? 'event' : type;
  return row.source_type === sourceType;
}

function textIncludes(value: JsonValue, query: string): boolean {
  return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function searchObjectRef(row: JsonObject): ObjectRef {
  const sourceType = String(row.source_type || '');
  const id = String(row.source_key || row.id || '');
  if (sourceType === 'page') return { type: 'page', id };
  if (sourceType === 'resource') return { type: 'resource', id };
  if (sourceType === 'event') return { type: 'event', id };
  return { type: 'portal', id: sourceType || 'unknown' };
}

function searchResultUrl(row: JsonObject): string {
  const sourceType = String(row.source_type || '');
  const sourceKey = String(row.source_key || '');
  if (sourceType === 'resource') return buildResourceResultUrl(sourceKey);
  if (sourceType === 'event') return buildEventResultUrl(sourceKey);
  if (sourceType === 'page') return buildPageResultUrl(sourceKey);
  const raw = String(row.url || '/');
  return raw.startsWith('/') ? raw : '/';
}

function objectRefJson(ref: ObjectRef): JsonObject {
  return {
    type: ref.type,
    id: ref.id,
    ...(ref.label ? { label: ref.label } : {}),
    ...(ref.url ? { url: ref.url } : {}),
  };
}
