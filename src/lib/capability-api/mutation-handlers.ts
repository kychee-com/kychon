import { getOperation } from './operations.js';
import { checkOperationPermission } from './permissions.js';
import { sanitizeRichHtmlServer } from '../sanitize-html.js';
import {
  actionResult,
  auditReference,
  changedObject,
  verificationQuery,
} from './idempotency.js';
import type { CapabilityActor } from './actor.js';
import type {
  ActionPlan,
  ActionResult,
  JsonObject,
  JsonValue,
  ObjectRef,
  ObjectType,
  OperationName,
  SideEffect,
} from './types.js';

export interface CapabilityMutationDb {
  select(table: string): Promise<JsonObject[]>;
  insert(table: string, row: JsonObject): Promise<JsonObject>;
  update(table: string, id: string | number, patch: JsonObject): Promise<JsonObject | null>;
  delete(table: string, id: string | number): Promise<JsonObject | null>;
}

export interface CapabilityStorage {
  upload(kind: 'asset' | 'resource', file: JsonObject, metadata: JsonObject): Promise<JsonObject>;
}

export interface CapabilityAi {
  translateText(input: JsonObject): Promise<JsonObject>;
  translateContent(input: JsonObject): Promise<JsonObject>;
  generateNewsletter(input: JsonObject): Promise<JsonObject>;
}

export interface CapabilityJobs {
  run(name: string, input: JsonObject): Promise<JsonObject>;
}

export interface CapabilityMutationContext {
  actor: CapabilityActor;
  db: CapabilityMutationDb;
  storage?: CapabilityStorage;
  ai?: CapabilityAi;
  jobs?: CapabilityJobs;
  now?: Date;
}

export class CapabilityMutationError extends Error {
  code: string;
  detail?: JsonObject;

  constructor(code: string, message: string, detail?: JsonObject) {
    super(message);
    this.name = 'CapabilityMutationError';
    this.code = code;
    this.detail = detail;
  }
}

export async function validateCapabilityMutation(
  operationName: OperationName | string,
  input: JsonObject,
  ctx: CapabilityMutationContext,
): Promise<ActionPlan<JsonObject>> {
  const operation = getOperation(String(operationName));
  if (!operation || !operation.phases.includes('execute')) {
    throw new CapabilityMutationError('api.unsupportedPhase', `Operation ${operationName} is not executable.`);
  }
  const permission = checkOperationPermission(ctx.actor, operation);
  const requiresConfirmation = operation.confirmation === 'required';
  const semanticError = permission.allowed ? await validateMutationSemantics(String(operation.name), input, ctx) : null;
  const warnings = operation.confirmation === 'recommended'
    ? [{ code: 'confirmation.recommended', message: `${operation.name} is confirmation-recommended.` }]
    : [];
  if (semanticError) {
    warnings.push({
      code: semanticError.code,
      message: semanticError.message,
      ...(semanticError.detail ? { detail: semanticError.detail } : {}),
    });
  }

  return {
    accepted: permission.allowed && !semanticError,
    normalizedInput: normalizeMutationInput(String(operation.name), input),
    requiresConfirmation,
    permission: semanticError ? { ...permission, allowed: false, reason: semanticError.message } : permission,
    warnings,
    sideEffects: sideEffectsFor(String(operation.name), input),
    cost: operation.costClass === 'free' ? null : { class: operation.costClass, rationale: `${operation.costClass} operation.` },
  };
}

// Required-field validation for create operations, shared by the validate
// phase and the execute handlers so the two agree. Without it, `validate`
// reported accepted:true for empty input and execute then coerced the missing
// fields (title -> 'Untitled', body -> ''). (#108, #111)
function validateCreateInput(operation: string, input: JsonObject): void {
  if (operation === 'forum.topics.create') {
    requireNonEmptyString(input.title, 'forum.topics.create requires a non-empty title.');
  } else if (operation === 'events.create') {
    requireNonEmptyString(input.title, 'events.create requires a non-empty title.');
    validateEventDates(input);
    validateNonNegativeCapacity(input);
  } else if (operation === 'tiers.create') {
    requireNonEmptyString(input.name, 'tiers.create requires a non-empty name.');
  }
}

function requireNonEmptyString(value: JsonValue | undefined, message: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CapabilityMutationError('validation.failed', message, {});
  }
}

// Dates are validated only when supplied — a title-only event stays valid per
// the documented minimal create contract. An out-of-order or unparseable date
// is rejected rather than silently stored. (#111)
function validateEventDates(input: JsonObject): void {
  const starts = input.startsAt ?? input.starts_at;
  const ends = input.endsAt ?? input.ends_at;
  if (starts != null && Number.isNaN(Date.parse(String(starts)))) {
    throw new CapabilityMutationError('validation.failed', 'events.create starts_at must be a valid date.', {
      starts_at: String(starts),
    });
  }
  if (ends != null) {
    if (Number.isNaN(Date.parse(String(ends)))) {
      throw new CapabilityMutationError('validation.failed', 'events.create ends_at must be a valid date.', {
        ends_at: String(ends),
      });
    }
    if (starts != null && Date.parse(String(ends)) < Date.parse(String(starts))) {
      throw new CapabilityMutationError('validation.failed', 'events.create ends_at must be on or after starts_at.', {});
    }
  }
}

function validateNonNegativeCapacity(input: JsonObject): void {
  if (input.capacity != null) {
    const capacity = Number(input.capacity);
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new CapabilityMutationError('validation.failed', 'events.create capacity must be a non-negative integer.', {
        capacity: String(input.capacity),
      });
    }
  }
}

async function validateMutationSemantics(
  operation: string,
  input: JsonObject,
  ctx: CapabilityMutationContext,
): Promise<CapabilityMutationError | null> {
  try {
    validateCreateInput(operation, input);
    if (operation === 'members.updateProfile') {
      idForUpdate(operation, input, ctx);
    } else if (operation === 'forum.replies.create') {
      await validateForumReplyInput(input, ctx);
    } else if (operation === 'pollVotes.cast') {
      await validatePollVoteInput(input, ctx);
    } else if (operation === 'members.changeRole') {
      const role = typeof input.role === 'string' ? input.role.toLowerCase() : '';
      if (!VALID_MEMBER_ROLES.has(role)) {
        throw new CapabilityMutationError('validation.failed', 'members.changeRole requires role in member|moderator|admin.', {
          role: String(input.role ?? ''),
        });
      }
      await ensureActiveAdminRemains(operation, requiredId(input, operation), { role }, ctx);
    } else if (operation === 'members.suspend' || operation === 'members.reject') {
      await ensureActiveAdminRemains(operation, requiredId(input, operation), rowForUpdate(operation, input, ctx), ctx);
    }
    return null;
  } catch (error) {
    if (error instanceof CapabilityMutationError) return error;
    throw error;
  }
}

export async function executeCapabilityMutation(
  operationName: OperationName | string,
  input: JsonObject,
  ctx: CapabilityMutationContext,
): Promise<ActionResult<JsonValue>> {
  const operation = getOperation(String(operationName));
  if (!operation || !operation.phases.includes('execute')) {
    throw new CapabilityMutationError('api.unsupportedPhase', `Operation ${operationName} is not executable.`);
  }
  const permission = checkOperationPermission(ctx.actor, operation);
  if (!permission.allowed) {
    throw new CapabilityMutationError('permission.denied', `Permission denied for ${operation.name}.`, permission as unknown as JsonObject);
  }

  const name = String(operation.name);
  if (name === 'announcements.publish') return publishAnnouncement(input, ctx);
  if (name === 'forum.topics.create') return createForumTopic(input, ctx);
  if (name === 'forum.replies.create') return createForumReply(input, ctx);
  if (name === 'polls.create') return createPollAction(input, ctx);
  if (name === 'pollVotes.cast') return castPollVote(input, ctx);
  if (name === 'pollVotes.clearMine') return clearMinePollVotes(input, ctx);
  if (name === 'reactions.toggle') return toggleReaction(input, ctx);
  if (name === 'resources.upload') return uploadResource(input, ctx);
  if (name === 'assets.upload') return uploadAsset(input, ctx);
  if (name === 'translations.translateText') return translateText(input, ctx);
  if (name === 'translations.translateContent') return translateContent(input, ctx);
  if (name === 'newsletters.drafts.generate') return generateNewsletterDraft(input, ctx);
  if (name.startsWith('jobs.')) return runJob(name, input, ctx);
  if (name === 'rsvps.setStatus') return setRsvpStatus(input, ctx);
  if (name === 'rsvps.cancel') return cancelRsvp(input, ctx);
  if (name === 'members.changeRole') return changeMemberRole(input, ctx);
  if (name.startsWith('exports.')) notImplemented(name);

  return genericMutation(name, input, ctx);
}

function normalizeMutationInput(operation: string, input: JsonObject): JsonObject {
  if (operation === 'config.set' && typeof input.key === 'string') {
    return { key: input.key, value: input.value ?? null, category: input.category ?? 'general' };
  }
  if (operation === 'rsvps.setStatus' && input.status == null) {
    return { ...input, status: 'going' };
  }
  return input;
}

async function genericMutation(operation: string, input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const spec = mutationSpec(operation);
  if (!spec) throw new CapabilityMutationError('api.unknownOperation', `No mutation spec for ${operation}.`);

  let row: JsonObject | null;
  if (spec.action === 'create') {
    validateCreateInput(operation, input);
    row = await ctx.db.insert(spec.table, rowForCreate(operation, input, ctx));
  } else if (spec.action === 'delete') {
    row = await ctx.db.delete(spec.table, requiredId(input, operation));
  } else if (spec.action === 'upsertConfig') {
    row = await upsertConfig(input, ctx);
  } else {
    const targetId = idForUpdate(operation, input, ctx);
    const patch = rowForUpdate(operation, input, ctx);
    await ensureActiveAdminRemains(operation, targetId, patch, ctx);
    row = await ctx.db.update(spec.table, targetId, patch);
    if (!row) throw notFoundMutationError(spec.objectType, targetId);
  }

  const object = changedObject(spec.objectType, String(row?.id ?? input.id ?? input.key ?? 'unknown'));
  return actionResult(row || {}, [object], verificationFor(spec.objectType, object));
}

async function ensureActiveAdminRemains(
  operation: string,
  targetId: string | number,
  patch: JsonObject,
  ctx: CapabilityMutationContext,
  members?: JsonObject[],
  target?: JsonObject,
): Promise<JsonObject | null> {
  if (!guardsLastActiveAdmin(operation)) return target ?? null;
  const rows = members ?? await ctx.db.select('members');
  const row = target ?? rows.find((member) => String(member.id) === String(targetId));
  if (!row) throw notFoundMutationError('member', targetId);
  if (!memberPatchRemovesActiveAdmin(row, patch)) return row;

  const hasOtherActiveAdmin = rows.some((member) => String(member.id) !== String(targetId) && isActiveAdminMember(member));
  if (!hasOtherActiveAdmin) {
    throw new CapabilityMutationError('conflict.state', 'Cannot remove the last active admin.', {
      object: { type: 'member', id: String(targetId) },
    });
  }
  return row;
}

function guardsLastActiveAdmin(operation: string): boolean {
  return operation === 'members.changeRole' || operation === 'members.suspend' || operation === 'members.reject';
}

function memberPatchRemovesActiveAdmin(member: JsonObject, patch: JsonObject): boolean {
  if (!isActiveAdminMember(member)) return false;
  const nextRole = patch.role != null ? String(patch.role).toLowerCase() : String(member.role).toLowerCase();
  const nextStatus = patch.status != null ? String(patch.status).toLowerCase() : String(member.status).toLowerCase();
  return nextRole !== 'admin' || nextStatus !== 'active';
}

function isActiveAdminMember(member: JsonObject): boolean {
  return String(member.role).toLowerCase() === 'admin' && String(member.status).toLowerCase() === 'active';
}

async function publishAnnouncement(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  // Body is sanitized on write so every downstream reader (newsletter
  // generator, translation cache, CSV/RSS export) inherits the safety
  // guarantee the read-side hydrator already provides. (#29)
  const announcement = await ctx.db.insert('announcements', {
    title: input.title || 'Untitled',
    body: sanitizeRichHtmlServer(input.body || ''),
    is_pinned: input.pin === true || input.is_pinned === true,
    author_id: memberId(ctx),
  });
  const changed: ObjectRef[] = [changedObject('announcement', String(announcement.id))];

  if (isObject(input.poll)) {
    const poll = await createPoll({ ...input.poll, attached_to: 'announcement', attached_id: announcement.id }, ctx);
    changed.push(changedObject('poll', String(poll.id)));
  }

  const activity = await writeActivity(ctx, 'announcement', { title: announcement.title, announcement_id: announcement.id });
  return actionResult(announcement, changed, verificationQuery(getOperation('announcements.get')!.name, { id: announcement.id }, changed[0]), auditReference(String(activity.id), 'announcement'));
}

async function createForumTopic(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  validateCreateInput('forum.topics.create', input);
  const topic = await ctx.db.insert('forum_topics', {
    category_id: input.categoryId ?? input.category_id ?? null,
    title: input.title || 'Untitled',
    body: input.body || '',
    author_id: memberId(ctx),
    author_name: ctx.actor.member?.displayName || null,
    is_pinned: input.is_pinned === true,
    reply_count: 0,
    last_reply_at: null,
  });
  const changed: ObjectRef[] = [changedObject('forum.topic', String(topic.id))];

  if (isObject(input.poll)) {
    const poll = await createPoll({ ...input.poll, attached_to: 'forum.topic', attached_id: topic.id }, ctx);
    changed.push(changedObject('poll', String(poll.id)));
  }

  const activity = await writeActivity(ctx, 'forum_post', { title: topic.title, topic_id: topic.id });
  return actionResult(topic, changed, verificationQuery(getOperation('forum.topics.get')!.name, { id: topic.id }, changed[0]), auditReference(String(activity.id), 'forum_post'));
}

async function validateForumReplyInput(input: JsonObject, ctx: CapabilityMutationContext): Promise<void> {
  const topicId = requiredAny(input.topicId ?? input.topic_id, 'forum.replies.create requires topicId.');
  await findOpenForumTopic(topicId, ctx);
}

async function findOpenForumTopic(topicId: string | number, ctx: CapabilityMutationContext): Promise<JsonObject> {
  const topic = (await ctx.db.select('forum_topics')).find((row) => String(row.id) === String(topicId));
  if (!topic) {
    throw new CapabilityMutationError('notFound.object', 'Forum topic not found.', {
      object: { type: 'forum.topic', id: String(topicId) },
    });
  }
  if (topic.locked === true) {
    throw new CapabilityMutationError('conflict.state', 'Forum topic is locked.', {
      object: { type: 'forum.topic', id: String(topicId) },
    });
  }
  return topic;
}

async function createForumReply(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const topicId = requiredAny(input.topicId ?? input.topic_id, 'forum.replies.create requires topicId.');
  const topic = await findOpenForumTopic(topicId, ctx);

  const reply = await ctx.db.insert('forum_replies', {
    topic_id: topicId,
    body: input.body || '',
    author_id: memberId(ctx),
    author_name: ctx.actor.member?.displayName || null,
  });
  await ctx.db.update('forum_topics', topicId, {
    reply_count: Number(topic.reply_count || 0) + 1,
    last_reply_at: nowIso(ctx),
  });
  const activity = await writeActivity(ctx, 'forum_reply', { topic_id: topicId, reply_id: reply.id });
  const object = changedObject('forum.reply', String(reply.id));
  return actionResult(reply, [object, changedObject('forum.topic', String(topicId))], verificationQuery(getOperation('forum.replies.list')!.name, { topicId }, object), auditReference(String(activity.id), 'forum_reply'));
}

// De-duplicate submitted option ids so a repeated id in a multiple-choice vote
// cannot insert the same (poll, member, option) row twice and trip the UNIQUE
// constraint (which would surface as a generic 500). (#119)
function resolveVoteOptionIds(input: JsonObject): JsonValue[] {
  const raw = Array.isArray(input.optionIds)
    ? input.optionIds
    : [requiredAny(input.optionId ?? input.option_id, 'pollVotes.cast requires optionId.')];
  const seen = new Set<string>();
  const deduped: JsonValue[] = [];
  for (const value of raw) {
    const key = String(value);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(value);
    }
  }
  return deduped;
}

async function validatePollVoteInput(input: JsonObject, ctx: CapabilityMutationContext): Promise<void> {
  const pollId = requiredAny(input.pollId ?? input.poll_id, 'pollVotes.cast requires pollId.');
  const optionIds = resolveVoteOptionIds(input);
  await findOpenPoll(pollId, ctx);
  await validatePollOptionIds(pollId, optionIds, ctx);
}

async function findOpenPoll(pollId: string | number, ctx: CapabilityMutationContext): Promise<JsonObject> {
  const poll = (await ctx.db.select('polls')).find((row) => String(row.id) === String(pollId));
  if (!poll) {
    throw new CapabilityMutationError('notFound.object', 'Poll not found.', {
      object: { type: 'poll', id: String(pollId) },
    });
  }
  if (poll.is_open === false) {
    throw new CapabilityMutationError('conflict.state', 'Poll is closed.', {
      object: { type: 'poll', id: String(pollId) },
    });
  }
  return poll;
}

async function validatePollOptionIds(
  pollId: string | number,
  optionIds: JsonValue[],
  ctx: CapabilityMutationContext,
): Promise<void> {
  const options = await ctx.db.select('poll_options');
  for (const optionId of optionIds) {
    const option = options.find((row) => String(row.id) === String(optionId));
    if (!option || String(option.poll_id) !== String(pollId)) {
      throw new CapabilityMutationError('validation.failed', 'pollVotes.cast optionId must belong to pollId.', {
        object: { type: 'poll', id: String(pollId) },
        optionId: String(optionId),
      });
    }
  }
}

async function castPollVote(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const pollId = requiredAny(input.pollId ?? input.poll_id, 'pollVotes.cast requires pollId.');
  const optionIds = resolveVoteOptionIds(input);
  const poll = await findOpenPoll(pollId, ctx);
  await validatePollOptionIds(pollId, optionIds, ctx);

  const member = memberId(ctx);
  const existing = (await ctx.db.select('poll_votes')).filter((vote) => String(vote.poll_id) === String(pollId) && String(vote.member_id) === String(member));
  if (poll.poll_type !== 'multiple') {
    for (const vote of existing) await ctx.db.delete('poll_votes', requiredId(vote, 'pollVotes.cast existing vote'));
  }

  const changed: ObjectRef[] = [];
  for (const optionId of optionIds) {
    const duplicate = existing.find((vote) => String(vote.option_id) === String(optionId));
    if (poll.poll_type === 'multiple' && duplicate) {
      await ctx.db.delete('poll_votes', requiredId(duplicate, 'pollVotes.cast duplicate vote'));
      continue;
    }
    const vote = await ctx.db.insert('poll_votes', { poll_id: pollId, option_id: optionId, member_id: member });
    changed.push(changedObject('poll.vote', String(vote.id)));
  }
  const activity = await writeActivity(ctx, 'poll_vote', { poll_id: pollId });
  return actionResult({ pollId, optionIds }, changed, verificationQuery(getOperation('pollResults.get')!.name, { id: pollId }), auditReference(String(activity.id), 'poll_vote'));
}

async function createPollAction(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const poll = await createPoll(input, ctx);
  const object = changedObject('poll', String(poll.id));
  return actionResult(poll, [object], verificationQuery(getOperation('polls.get')!.name, { id: poll.id }, object));
}

async function clearMinePollVotes(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const pollId = requiredAny(input.pollId ?? input.poll_id, 'pollVotes.clearMine requires pollId.');
  const member = memberId(ctx);
  const votes = (await ctx.db.select('poll_votes')).filter((vote) => String(vote.poll_id) === String(pollId) && String(vote.member_id) === String(member));
  for (const vote of votes) await ctx.db.delete('poll_votes', requiredId(vote, 'pollVotes.clearMine vote'));
  return actionResult({ cleared: votes.length }, votes.map((vote) => changedObject('poll.vote', String(vote.id))), verificationQuery(getOperation('pollResults.get')!.name, { id: pollId }));
}

async function uploadResource(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const upload = await ctx.storage?.upload('resource', asObject(input.file), asObject(input.metadata));
  const metadata = asObject(input.metadata);
  const resource = await ctx.db.insert('resources', {
    title: metadata.title || input.title || upload?.name || 'Resource',
    description: metadata.description || null,
    category: metadata.category || null,
    file_url: upload?.url || input.fileUrl || null,
    file_type: metadata.file_type || metadata.fileType || 'file',
    is_members_only: metadata.is_members_only !== false,
    uploaded_by: memberId(ctx),
  });
  const activity = await writeActivity(ctx, 'resource_upload', { title: resource.title, resource_id: resource.id });
  const object = changedObject('resource', String(resource.id));
  return actionResult(resource, [object], verificationQuery(getOperation('resources.get')!.name, { id: resource.id }, object), auditReference(String(activity.id), 'resource_upload'));
}

async function toggleReaction(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const contentType = String(requiredAny(input.contentType ?? input.content_type, 'reactions.toggle requires contentType.'));
  const contentId = requiredAny(input.contentId ?? input.content_id, 'reactions.toggle requires contentId.');
  const emoji = String(input.emoji || 'heart');
  const member = memberId(ctx);
  const existing = (await ctx.db.select('reactions')).find(
    (row) =>
      String(row.content_type) === contentType &&
      String(row.content_id) === String(contentId) &&
      String(row.member_id) === String(member) &&
      String(row.emoji) === emoji,
  );
  if (existing) {
    await ctx.db.delete('reactions', requiredId(existing, 'reactions.toggle existing reaction'));
    return actionResult({ toggled: 'removed' }, [changedObject('reaction', String(existing.id))], null);
  }
  const reaction = await ctx.db.insert('reactions', { content_type: contentType, content_id: contentId, emoji, member_id: member });
  return actionResult({ toggled: 'added', reaction }, [changedObject('reaction', String(reaction.id))], null);
}

// Operations with no backing service on this portal raise an honest
// notImplemented error rather than returning a fake success. (#110)
function notImplemented(operation: string): never {
  throw new CapabilityMutationError('api.notImplemented', `${operation} is not implemented on this portal.`, {
    operation,
  });
}

async function uploadAsset(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  if (!ctx.storage) notImplemented('assets.upload');
  const upload = await ctx.storage.upload('asset', asObject(input.file), input);
  const object = changedObject('asset', String(upload.path || input.path || 'asset'));
  return actionResult(upload, [object], null);
}

const VALID_MEMBER_ROLES: ReadonlySet<string> = new Set(['member', 'moderator', 'admin']);

const RSVP_STATUSES = ['going', 'maybe', 'cancelled'];

// RSVP status is constrained to the documented enum — an unknown value is a
// validation error rather than a silently persisted string. A missing status
// defaults to 'going'; an empty/garbage value is rejected, not coerced. (#116)
function normalizeRsvpStatus(value: JsonValue | undefined): string {
  const status = value == null ? 'going' : value;
  if (typeof status !== 'string' || !RSVP_STATUSES.includes(status)) {
    throw new CapabilityMutationError(
      'validation.failed',
      `rsvps.setStatus status must be one of: ${RSVP_STATUSES.join(', ')}.`,
      { status: String(status) },
    );
  }
  return status;
}

// Capacity caps the number of `going` RSVPs. The member's own row is excluded so
// re-confirming or switching to going never counts the member twice. Only
// `going` is capped — `maybe`/`cancelled` are always allowed so a member can
// step back and free a seat. (#115)
function assertRsvpCapacity(eventRow: JsonObject, status: string, member: JsonValue, rsvps: JsonObject[]): void {
  if (status !== 'going' || eventRow.capacity == null) return;
  const goingCount = rsvps.filter(
    (row) =>
      String(row.event_id) === String(eventRow.id) &&
      String(row.status) === 'going' &&
      String(row.member_id) !== String(member),
  ).length;
  if (goingCount >= Number(eventRow.capacity)) {
    throw new CapabilityMutationError('conflict.state', 'Event is full.', {
      object: { type: 'event', id: String(eventRow.id) },
    });
  }
}

async function setRsvpStatus(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  // member_id is bound to the actor (admins act-as via dedicated admin paths,
  // not this capability) and an `id` from input must belong to that member —
  // otherwise an active member could update arbitrary RSVP rows. (#24)
  const member = memberId(ctx);
  const status = normalizeRsvpStatus(input.status);
  const id = input.id;
  const eventId = input.eventId ?? input.event_id;

  if (id != null) {
    const rsvps = await ctx.db.select('event_rsvps');
    const target = rsvps.find((row) => String(row.id) === String(id));
    if (!target) {
      throw new CapabilityMutationError('notFound.object', 'RSVP not found.', {
        object: { type: 'event.rsvp', id: String(id) },
      });
    }
    if (String(target.member_id) !== String(member) && !isAdminLike(ctx) && !isModeratorLike(ctx)) {
      throw new CapabilityMutationError('permission.denied', 'rsvps.setStatus can only update the active member RSVP.', {
        object: { type: 'event.rsvp', id: String(id) },
      });
    }
    const eventRow = (await ctx.db.select('events')).find((row) => String(row.id) === String(target.event_id));
    if (eventRow) assertRsvpCapacity(eventRow, status, target.member_id, rsvps);
    const row =
      (await ctx.db.update('event_rsvps', String(id), {
        status,
        member_id: target.member_id,
      })) || target;
    const object = changedObject('event.rsvp', String(row.id ?? id));
    return actionResult(
      row,
      [object],
      verificationQuery(getOperation('rsvps.listForEvent')!.name, { eventId: row.event_id ?? eventId }, object),
    );
  }

  const event = requiredAny(eventId, 'rsvps.setStatus requires eventId.');
  // Pre-validate the event so a missing FK surfaces as `notFound.object`,
  // not a generic insert failure when the DB-side FK rejects the row. (#29)
  const eventRow = (await ctx.db.select('events')).find((row) => String(row.id) === String(event));
  if (!eventRow) {
    throw new CapabilityMutationError('notFound.object', 'Event not found.', {
      object: { type: 'event', id: String(event) },
    });
  }
  const rsvps = await ctx.db.select('event_rsvps');
  assertRsvpCapacity(eventRow, status, member, rsvps);
  const existing = rsvps.find(
    (row) => String(row.event_id) === String(event) && String(row.member_id) === String(member),
  );
  const row = existing
    ? (await ctx.db.update('event_rsvps', String(existing.id), {
        status,
        member_id: member,
      })) || existing
    : await ctx.db.insert('event_rsvps', {
        event_id: event,
        member_id: member,
        status,
      });
  const object = changedObject('event.rsvp', String(row.id));
  return actionResult(
    row,
    [object],
    verificationQuery(getOperation('rsvps.listForEvent')!.name, { eventId: event }, object),
  );
}

async function cancelRsvp(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const member = memberId(ctx);
  const id = input.id;
  const eventId = input.eventId ?? input.event_id;
  // When the caller addresses by eventId, validate the event before scanning
  // rsvps — otherwise a typo collapses to a silent `cancelled: false`. (#29)
  if (id == null && eventId != null) {
    const eventRow = (await ctx.db.select('events')).find((row) => String(row.id) === String(eventId));
    if (!eventRow) {
      throw new CapabilityMutationError('notFound.object', 'Event not found.', {
        object: { type: 'event', id: String(eventId) },
      });
    }
  }
  const existing =
    id != null
      ? (await ctx.db.select('event_rsvps')).find((row) => String(row.id) === String(id))
      : (await ctx.db.select('event_rsvps')).find(
          (row) => String(row.event_id) === String(eventId) && String(row.member_id) === String(member),
        );
  if (!existing) return actionResult({ cancelled: false }, [], null);
  if (String(existing.member_id) !== String(member) && !isAdminLike(ctx) && !isModeratorLike(ctx)) {
    throw new CapabilityMutationError('permission.denied', 'rsvps.cancel can only cancel the active member RSVP.', {
      object: { type: 'event.rsvp', id: String(existing.id) },
    });
  }
  const row = (await ctx.db.update('event_rsvps', String(existing.id), { status: 'cancelled' })) || existing;
  const object = changedObject('event.rsvp', String(row.id));
  return actionResult(
    row,
    [object],
    verificationQuery(getOperation('rsvps.listForEvent')!.name, { eventId: row.event_id ?? eventId }, object),
  );
}

async function changeMemberRole(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  // Reject anything that isn't a known role. The old fall-through path
  // (`input.role || 'member'`) silently demoted on typos and let `'admin'`,
  // `'moderator'`, or arbitrary strings reach the DB unfiltered. (#29)
  const role = typeof input.role === 'string' ? input.role.toLowerCase() : '';
  if (!VALID_MEMBER_ROLES.has(role)) {
    throw new CapabilityMutationError('validation.failed', 'members.changeRole requires role in member|moderator|admin.', {
      role: String(input.role ?? ''),
    });
  }

  const targetId = requiredId(input, 'members.changeRole');
  const members = await ctx.db.select('members');
  const target = members.find((row) => String(row.id) === String(targetId));
  if (!target) {
    throw new CapabilityMutationError('notFound.object', 'Member not found.', {
      object: { type: 'member', id: String(targetId) },
    });
  }

  // Last-admin guard: role changes, suspension, and rejection all remove
  // admin availability when the target is the only active admin. (#30)
  await ensureActiveAdminRemains('members.changeRole', targetId, { role }, ctx, members, target);

  const row = (await ctx.db.update('members', String(targetId), { role })) || { ...target, role };
  const object = changedObject('member', String(row.id ?? targetId));
  return actionResult(row, [object], verificationQuery(getOperation('members.get')!.name, { id: row.id ?? targetId }, object));
}

function isAdminLike(ctx: CapabilityMutationContext): boolean {
  return ctx.actor.state === 'admin' || ctx.actor.state === 'project_admin';
}

function isModeratorLike(ctx: CapabilityMutationContext): boolean {
  return ctx.actor.state === 'moderator' || isAdminLike(ctx);
}

export { sanitizeRichHtmlServer };

async function translateText(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  if (!ctx.ai) notImplemented('translations.translateText');
  const result = await ctx.ai.translateText(input);
  return actionResult(result, [changedObject('translation', String(result.id || 'text'))], null);
}

async function translateContent(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const translated = (await ctx.ai?.translateContent(input)) || { translated_text: input.text || '' };
  const row = await ctx.db.insert('content_translations', {
    content_type: input.contentType || input.content_type || 'content',
    content_id: input.contentId || input.content_id || 0,
    language: input.language || 'en',
    field: input.field || 'body',
    translated_text: translated.translated_text || translated.translatedText || '',
  });
  return actionResult(row, [changedObject('translation', String(row.id))], verificationQuery(getOperation('translations.list')!.name, { id: row.id }));
}

async function generateNewsletterDraft(input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const generated = (await ctx.ai?.generateNewsletter(input)) || { subject: input.subject || 'Newsletter', body: input.body || '' };
  const draft = await ctx.db.insert('newsletter_drafts', {
    subject: generated.subject || 'Newsletter',
    body: generated.body || '',
    status: 'draft',
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
  });
  const object = changedObject('newsletterDraft', String(draft.id));
  return actionResult(draft, [object], verificationQuery(getOperation('newsletters.drafts.get')!.name, { id: draft.id }, object));
}

async function runJob(operation: string, input: JsonObject, ctx: CapabilityMutationContext): Promise<ActionResult<JsonValue>> {
  const name = operation.replace(/^jobs\./, '');
  if (!ctx.jobs) notImplemented(operation);
  const result = await ctx.jobs.run(name, input);
  const object = changedObject('job', String(result.id || name));
  return actionResult(result, [object], verificationQuery(getOperation('jobs.status')!.name, { id: result.id || name }, object));
}

async function createPoll(input: JsonObject, ctx: CapabilityMutationContext): Promise<JsonObject> {
  // A poll needs at least two options — validate before inserting the poll row
  // so an under-specified request never leaves an orphan poll behind. (#118)
  const options = Array.isArray(input.options) ? input.options : [];
  if (options.length < 2) {
    throw new CapabilityMutationError('validation.failed', 'A poll requires at least two options.', {
      object: { type: 'poll', id: 'new' },
    });
  }
  const poll = await ctx.db.insert('polls', {
    question: input.question || 'Poll',
    description: input.description || null,
    poll_type: input.pollType || input.poll_type || 'single',
    is_anonymous: input.isAnonymous === true || input.is_anonymous === true,
    results_visible: input.resultsVisible || input.results_visible || 'after_vote',
    is_open: input.is_open !== false,
    closes_at: input.closesAt || input.closes_at || null,
    attached_to: input.attached_to || input.attachedTo || null,
    attached_id: input.attached_id || input.attachedId || null,
    created_by: memberId(ctx),
  });
  let position = 0;
  for (const option of options) {
    const label = isObject(option) ? option.label : option;
    await ctx.db.insert('poll_options', { poll_id: poll.id, label: label || `Option ${position + 1}`, position });
    position += 1;
  }
  return poll;
}

async function upsertConfig(input: JsonObject, ctx: CapabilityMutationContext): Promise<JsonObject> {
  if (Array.isArray(input.entries)) {
    let last: JsonObject = {};
    for (const entry of input.entries) {
      if (isObject(entry)) last = await upsertConfig(entry, ctx);
    }
    return last;
  }
  const key = String(requiredAny(input.key, 'config.set requires key.'));
  const existing = (await ctx.db.select('site_config')).find((row) => row.key === key);
  if (existing?.id != null) return (await ctx.db.update('site_config', String(existing.id), configPatch(input, existing))) || existing;
  return ctx.db.insert('site_config', { key, ...configPatch(input) });
}

function rowForCreate(operation: string, input: JsonObject, ctx: CapabilityMutationContext): JsonObject {
  if (operation === 'members.updateProfile') return { ...input, id: undefined } as unknown as JsonObject;
  if (operation.startsWith('polls.')) return { ...input, created_by: memberId(ctx) };
  if (operation.startsWith('events.')) return { ...input, created_by: memberId(ctx) };
  return input;
}

function rowForUpdate(operation: string, input: JsonObject, ctx: CapabilityMutationContext): JsonObject {
  if (operation === 'members.updateProfile') return memberProfilePatch(input);
  if (operation === 'members.approve') return { status: 'active' };
  if (operation === 'members.reject') return { status: 'rejected' };
  if (operation === 'members.suspend') return { status: 'suspended' };
  if (operation === 'members.reactivate') return { status: 'active' };
  if (operation === 'members.changeTier') return { tier_id: input.tierId ?? input.tier_id ?? null };
  if (operation === 'members.changeRole') return { role: input.role || 'member' };
  if (operation === 'members.setExpiration') return { expires_at: input.expiresAt ?? input.expires_at ?? null };
  if (operation === 'members.linkUser') return { user_id: input.userId ?? input.user_id ?? null };
  if (operation === 'rsvps.setStatus') return { status: input.status || 'going', member_id: memberId(ctx) };
  if (operation === 'rsvps.cancel') return { status: 'cancelled' };
  if (operation === 'registrationOptions.disable') return { is_disabled: true };
  if (operation === 'registrationOptions.enable') return { is_disabled: false };
  if (operation === 'registrationOptions.markReviewed') return { review_state: 'reviewed' };
  if (operation === 'registrationOptions.ignore') return { review_state: 'ignored' };
  if (operation === 'events.reviewImport') return { import_review_state: input.reviewState || input.review_state || 'reviewed' };
  if (operation.endsWith('.pin')) return { is_pinned: true };
  if (operation.endsWith('.unpin')) return { is_pinned: false };
  if (operation.endsWith('.lock')) return { locked: true };
  if (operation.endsWith('.unlock')) return { locked: false };
  if (operation.endsWith('.hide')) return { hidden: true };
  if (operation.endsWith('.unhide')) return { hidden: false };
  if (operation.endsWith('.close')) return { is_open: false };
  if (operation.endsWith('.reopen')) return { is_open: true };
  if (operation === 'moderation.approve') return { action: 'approved', reviewed_by: memberId(ctx) };
  if (operation === 'moderation.hide') return { action: 'hidden', reviewed_by: memberId(ctx) };
  if (operation === 'moderation.markReviewed') return { action: 'reviewed', reviewed_by: memberId(ctx) };
  if (operation === 'insights.updateStatus') return { status: input.status || 'reviewed' };
  if (operation === 'insights.dismiss') return { status: 'dismissed' };
  if (operation === 'announcements.update') {
    const patch = stripControlFields(input);
    if (patch.body != null) patch.body = sanitizeRichHtmlServer(patch.body);
    return patch;
  }
  return stripControlFields(input);
}

function mutationSpec(operation: string): { table: string; objectType: ObjectType; action: 'create' | 'update' | 'delete' | 'upsertConfig' } | null {
  if (operation.startsWith('config.')) return { table: 'site_config', objectType: 'config.entry', action: 'upsertConfig' };
  if (operation.startsWith('pages.')) return spec('pages', 'page', operation);
  if (operation.startsWith('sections.')) return spec('sections', 'section', operation);
  if (operation.startsWith('members.')) return spec('members', 'member', operation);
  if (operation.startsWith('tiers.')) return spec('membership_tiers', 'member.tier', operation);
  if (operation.startsWith('memberFields.')) return spec('member_custom_fields', 'member.field', operation);
  if (operation.startsWith('events.')) return spec('events', 'event', operation);
  if (operation.startsWith('registrationOptions.')) return spec('event_registration_options', 'event.registrationOption', operation);
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

function spec(table: string, objectType: ObjectType, operation: string) {
  return {
    table,
    objectType,
    action: operation.endsWith('.create') || operation.endsWith('.add') || operation.endsWith('.upload') || operation.endsWith('.generate')
      ? 'create'
      : operation.endsWith('.delete') || operation.endsWith('.remove')
        ? 'delete'
        : 'update',
  } as const;
}

function sideEffectsFor(operation: string, input: JsonObject): SideEffect[] {
  const spec = mutationSpec(operation);
  if (!spec) return [];
  const action = spec.action === 'upsertConfig' ? 'update' : spec.action;
  const effectType: SideEffect['type'] = action === 'delete' ? 'delete' : action === 'create' ? 'create' : 'update';
  const effects: SideEffect[] = [
    {
      type: effectType,
      object: changedObject(spec.objectType, String(input.id ?? input.key ?? 'pending')),
      description: operation,
    },
  ];
  if (operation === 'forum.topics.create' && input.poll) effects.push({ type: 'create', object: changedObject('poll', 'pending'), description: 'attached poll' });
  if (operation === 'announcements.publish' && input.poll) effects.push({ type: 'create', object: changedObject('poll', 'pending'), description: 'attached poll' });
  return effects;
}

async function writeActivity(ctx: CapabilityMutationContext, action: string, metadata: JsonObject): Promise<JsonObject> {
  return ctx.db.insert('activity_log', { member_id: ctx.actor.member?.id ?? null, action, metadata });
}

function verificationFor(objectType: ObjectType, object: ObjectRef) {
  const operation = objectType === 'member'
    ? getOperation('members.get')?.name
    : objectType === 'event'
      ? getOperation('events.get')?.name
      : objectType === 'announcement'
        ? getOperation('announcements.get')?.name
        : objectType === 'resource'
          ? getOperation('resources.get')?.name
          : null;
  return operation ? verificationQuery(operation, { id: object.id }, object) : null;
}

function notFoundMutationError(objectType: ObjectType, id: string | number): CapabilityMutationError {
  const object = changedObject(objectType, String(id));
  return new CapabilityMutationError('notFound.object', `${objectTypeLabel(objectType)} not found.`, {
    object: {
      type: object.type,
      id: object.id,
      ...(object.label ? { label: object.label } : {}),
      ...(object.url ? { url: object.url } : {}),
    },
  });
}

function objectTypeLabel(objectType: ObjectType): string {
  if (objectType === 'member') return 'Member';
  return 'Object';
}

function configPatch(input: JsonObject, existing?: JsonObject): JsonObject {
  return {
    value: input.value ?? null,
    // Preserve the stored category when the caller omits it — a value-only edit
    // must not silently re-file the row under 'general'. (#112)
    category: (input.category as string) || (existing?.category as string) || 'general',
  };
}

function stripControlFields(input: JsonObject): JsonObject {
  const { id: _id, operation: _operation, ...rest } = input;
  return rest;
}

function memberId(ctx: CapabilityMutationContext): string | null {
  return ctx.actor.member?.id || null;
}

function nowIso(ctx: CapabilityMutationContext): string {
  return (ctx.now || new Date()).toISOString();
}

function requiredId(input: JsonObject, operation: string): string | number {
  return requiredAny(input.id, `${operation} requires id.`);
}

function idForUpdate(operation: string, input: JsonObject, ctx: CapabilityMutationContext): string | number {
  if (operation !== 'members.updateProfile') return requiredId(input, operation);

  const actorMemberId = memberId(ctx);
  if (!actorMemberId) {
    throw new CapabilityMutationError('permission.denied', 'members.updateProfile requires an active member.');
  }
  if (input.id != null && String(input.id) !== String(actorMemberId)) {
    throw new CapabilityMutationError('permission.denied', 'members.updateProfile can only update the active member profile.', {
      object: { type: 'member', id: String(input.id) },
    });
  }
  return actorMemberId;
}

function memberProfilePatch(input: JsonObject): JsonObject {
  const patch: JsonObject = {};
  for (const field of ['display_name', 'avatar_url', 'bio', 'custom_fields']) {
    const value = input[field];
    if (value !== undefined) patch[field] = value;
  }
  return patch;
}

function requiredAny(value: JsonValue | undefined, message: string): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value;
  throw new CapabilityMutationError('validation.failed', message);
}

function asObject(value: JsonValue | undefined): JsonObject {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
