import type {
  ActorState,
  ConfirmationPolicy,
  CostClass,
  OperationName,
  OperationRegistryEntry,
  OperationPhase,
} from './types.js';

export const OPERATION_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){1,2}$/;
export const OBJECT_TYPE_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
export const ERROR_CODE_PATTERN =
  /^(request|api|auth|permission|validation|conflict|notFound|confirmation|rateLimit|cost|internal)\.[a-z][a-zA-Z0-9]*$/;

const QUERY_PHASES = ['query'] as const satisfies readonly OperationPhase[];
const MUTATION_PHASES = ['validate', 'execute'] as const satisfies readonly OperationPhase[];

type ReadDefinition = readonly [name: string, minimumActorState: ActorState, summary: string];
type MutationDefinition = readonly [
  name: string,
  minimumActorState: ActorState,
  summary: string,
  confirmation?: ConfirmationPolicy,
  costClass?: CostClass,
];

function operationName(name: string): OperationName {
  if (!OPERATION_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid Kychon Capability API operation name: ${name}`);
  }
  return name as OperationName;
}

function schemaRef(name: string, side: 'input' | 'output'): string {
  return `kychon.capabilityApi.v1.operations.${name}.${side}`;
}

function read([name, minimumActorState, summary]: ReadDefinition): OperationRegistryEntry {
  return {
    name: operationName(name),
    phases: QUERY_PHASES,
    auth: {
      minimumActorState,
      allowAnonymous: minimumActorState === 'anonymous',
    },
    confirmation: 'never',
    costClass: 'free',
    inputSchema: schemaRef(name, 'input'),
    outputSchema: schemaRef(name, 'output'),
    deprecation: { deprecated: false },
    summary,
  };
}

function mutate([
  name,
  minimumActorState,
  summary,
  confirmation = 'never',
  costClass = 'free',
]: MutationDefinition): OperationRegistryEntry {
  return {
    name: operationName(name),
    phases: MUTATION_PHASES,
    auth: {
      minimumActorState,
      permission: `${name}:execute`,
      allowAnonymous: false,
    },
    confirmation,
    costClass,
    inputSchema: schemaRef(name, 'input'),
    outputSchema: schemaRef(name, 'output'),
    deprecation: { deprecated: false },
    summary,
  };
}

const readDefinitions: readonly ReadDefinition[] = [
  ['portal.discover', 'anonymous', 'Return the public discovery document for this Kychon portal.'],
  ['portal.capabilities', 'anonymous', 'Return the operation catalog and capability metadata for an API version.'],
  ['portal.health', 'anonymous', 'Return portal health and readiness metadata.'],
  ['portal.version', 'anonymous', 'Return engine, schema, API, SDK, and CLI version metadata.'],
  ['auth.whoami', 'anonymous', 'Return the server-derived actor context for the current request.'],
  ['auth.permissions', 'anonymous', 'Return operations and permissions available to the current actor.'],
  ['auth.explainDenied', 'anonymous', 'Explain why an operation would be denied for the current actor.'],
  ['search.query', 'anonymous', 'Search content visible to the current actor.'],
  ['search.suggest', 'anonymous', 'Return visibility-safe search suggestions.'],
  ['config.get', 'anonymous', 'Read portal configuration visible to the current actor.'],
  ['pages.list', 'anonymous', 'List visible pages.'],
  ['pages.get', 'anonymous', 'Read one visible page.'],
  ['sections.list', 'anonymous', 'List visible page sections.'],
  ['sections.get', 'anonymous', 'Read one visible page section.'],
  ['members.list', 'active_member', 'List members according to directory visibility rules.'],
  ['members.get', 'active_member', 'Read one member profile according to visibility rules.'],
  ['tiers.list', 'anonymous', 'List membership tiers.'],
  ['memberFields.list', 'anonymous', 'List member profile field definitions visible to the caller.'],
  ['events.list', 'anonymous', 'List visible events.'],
  ['events.get', 'anonymous', 'Read one visible event.'],
  ['registrationOptions.list', 'anonymous', 'List visible registration options for events.'],
  ['rsvps.listForEvent', 'active_member', 'List RSVP summaries for an event.'],
  ['rsvps.listMine', 'active_member', 'List RSVPs for the current actor.'],
  ['announcements.list', 'anonymous', 'List visible announcements.'],
  ['announcements.get', 'anonymous', 'Read one visible announcement.'],
  ['resources.list', 'anonymous', 'List visible resources.'],
  ['resources.get', 'anonymous', 'Read one visible resource.'],
  ['forum.categories.list', 'active_member', 'List forum categories visible to the current actor.'],
  ['forum.categories.get', 'active_member', 'Read one forum category.'],
  ['forum.topics.list', 'active_member', 'List forum topics visible to the current actor.'],
  ['forum.topics.get', 'active_member', 'Read one forum topic.'],
  ['forum.replies.list', 'active_member', 'List replies visible to the current actor.'],
  ['polls.list', 'active_member', 'List polls visible to the current actor.'],
  ['polls.get', 'active_member', 'Read one poll visible to the current actor.'],
  ['polls.getAttached', 'active_member', 'Read a poll attached to another domain object.'],
  ['pollResults.get', 'active_member', 'Read poll results according to result visibility rules.'],
  ['committees.list', 'anonymous', 'List visible committees.'],
  ['committees.get', 'anonymous', 'Read one visible committee.'],
  ['committeeMembers.list', 'active_member', 'List committee members visible to the current actor.'],
  ['reactions.list', 'active_member', 'List reactions for a visible domain object.'],
  ['moderation.queue', 'moderator', 'List content requiring moderation review.'],
  ['translations.list', 'admin', 'List translation records and status.'],
  ['newsletters.drafts.list', 'admin', 'List newsletter drafts.'],
  ['newsletters.drafts.get', 'admin', 'Read one newsletter draft.'],
  ['insights.list', 'admin', 'List AI insights and their workflow status.'],
  ['activity.list', 'active_member', 'List activity entries visible to the current actor.'],
  ['jobs.status', 'admin', 'Read scheduled or async job status.'],
] as const;

const mutationDefinitions: readonly MutationDefinition[] = [
  ['config.set', 'admin', 'Set one configuration entry.'],
  ['config.setMany', 'admin', 'Set multiple configuration entries atomically.'],
  ['config.branding.update', 'admin', 'Update portal brand configuration.'],
  ['config.theme.update', 'admin', 'Update portal theme configuration.'],
  ['config.general.update', 'admin', 'Update general portal settings.'],
  ['config.eventDisplay.update', 'admin', 'Update event display settings.'],
  ['config.featureFlags.set', 'admin', 'Set portal feature flags.'],
  ['pages.create', 'admin', 'Create a page.'],
  ['pages.update', 'admin', 'Update a page.'],
  ['pages.publish', 'admin', 'Publish a page.', 'recommended'],
  ['pages.unpublish', 'admin', 'Unpublish a page.', 'recommended'],
  ['pages.delete', 'admin', 'Delete a page.', 'required'],
  ['sections.create', 'admin', 'Create a page section.'],
  ['sections.updateConfig', 'admin', 'Update a page section configuration.'],
  ['sections.reorder', 'admin', 'Reorder page sections.'],
  ['sections.setVisibility', 'admin', 'Set a page section visibility.'],
  ['sections.setScope', 'admin', 'Set a page section scope.'],
  ['sections.setColumnSpan', 'admin', 'Set a page section column span.'],
  ['sections.delete', 'admin', 'Delete a page section.', 'required'],
  ['members.updateProfile', 'active_member', 'Update a member profile.'],
  ['members.approve', 'admin', 'Approve a pending member.', 'recommended'],
  ['members.reject', 'admin', 'Reject a pending member.', 'required'],
  ['members.suspend', 'admin', 'Suspend a member.', 'required'],
  ['members.reactivate', 'admin', 'Reactivate a suspended member.', 'recommended'],
  ['members.changeTier', 'admin', 'Change a member tier.', 'recommended'],
  ['members.changeRole', 'admin', 'Change a member role.', 'required'],
  ['members.setExpiration', 'admin', 'Set membership expiration.'],
  ['members.linkUser', 'admin', 'Link a member row to an authenticated user.', 'required'],
  ['tiers.create', 'admin', 'Create a membership tier.'],
  ['tiers.update', 'admin', 'Update a membership tier.'],
  ['tiers.delete', 'admin', 'Delete a membership tier.', 'required'],
  ['tiers.setDefault', 'admin', 'Set the default membership tier.', 'recommended'],
  ['tiers.reorder', 'admin', 'Reorder membership tiers.'],
  ['memberFields.create', 'admin', 'Create a custom member field.'],
  ['memberFields.update', 'admin', 'Update a custom member field.'],
  ['memberFields.delete', 'admin', 'Delete a custom member field.', 'required'],
  ['memberFields.reorder', 'admin', 'Reorder custom member fields.'],
  ['events.create', 'admin', 'Create an event.'],
  ['events.update', 'admin', 'Update an event.'],
  ['events.delete', 'admin', 'Delete an event.', 'required'],
  ['events.setTimezone', 'admin', 'Set event timezone display metadata.'],
  ['events.reviewImport', 'admin', 'Review imported event metadata.'],
  ['registrationOptions.create', 'admin', 'Create an event registration option.'],
  ['registrationOptions.update', 'admin', 'Update an event registration option.'],
  ['registrationOptions.markReviewed', 'admin', 'Mark a registration option reviewed.'],
  ['registrationOptions.ignore', 'admin', 'Ignore an imported registration option.', 'recommended'],
  ['registrationOptions.disable', 'admin', 'Disable an event registration option.', 'recommended'],
  ['registrationOptions.enable', 'admin', 'Enable an event registration option.'],
  ['rsvps.setStatus', 'active_member', 'Set RSVP status for the current actor.'],
  ['rsvps.cancel', 'active_member', 'Cancel an RSVP.', 'recommended'],
  ['announcements.publish', 'admin', 'Publish an announcement, optionally pinned or poll-backed.', 'required'],
  ['announcements.update', 'admin', 'Update an announcement.'],
  ['announcements.pin', 'admin', 'Pin an announcement.', 'recommended'],
  ['announcements.unpin', 'admin', 'Unpin an announcement.'],
  ['announcements.delete', 'admin', 'Delete an announcement.', 'required'],
  ['resources.upload', 'admin', 'Upload a resource and create its product record.', 'recommended'],
  ['resources.update', 'admin', 'Update a resource.'],
  ['resources.delete', 'admin', 'Delete a resource.', 'required'],
  ['assets.upload', 'admin', 'Upload an asset and return its reference.', 'recommended'],
  ['forum.categories.create', 'moderator', 'Create a forum category.'],
  ['forum.categories.update', 'moderator', 'Update a forum category.'],
  ['forum.categories.reorder', 'moderator', 'Reorder forum categories.'],
  ['forum.categories.delete', 'moderator', 'Delete a forum category.', 'required'],
  ['forum.topics.create', 'active_member', 'Create a forum topic, optionally with an attached poll.'],
  ['forum.topics.update', 'active_member', 'Update a forum topic.'],
  ['forum.topics.pin', 'moderator', 'Pin a forum topic.', 'recommended'],
  ['forum.topics.unpin', 'moderator', 'Unpin a forum topic.'],
  ['forum.topics.lock', 'moderator', 'Lock a forum topic.', 'recommended'],
  ['forum.topics.unlock', 'moderator', 'Unlock a forum topic.'],
  ['forum.topics.hide', 'moderator', 'Hide a forum topic.', 'recommended'],
  ['forum.topics.unhide', 'moderator', 'Unhide a forum topic.'],
  ['forum.topics.delete', 'moderator', 'Delete a forum topic.', 'required'],
  ['forum.replies.create', 'active_member', 'Create a forum reply and update topic counters.'],
  ['forum.replies.update', 'active_member', 'Update a forum reply.'],
  ['forum.replies.hide', 'moderator', 'Hide a forum reply.', 'recommended'],
  ['forum.replies.unhide', 'moderator', 'Unhide a forum reply.'],
  ['forum.replies.delete', 'moderator', 'Delete a forum reply.', 'required'],
  ['polls.create', 'admin', 'Create a poll.'],
  ['polls.update', 'admin', 'Update a poll.'],
  ['polls.attach', 'admin', 'Attach a poll to a domain object.'],
  ['polls.detach', 'admin', 'Detach a poll from a domain object.', 'recommended'],
  ['polls.close', 'admin', 'Close a poll.', 'recommended'],
  ['polls.reopen', 'admin', 'Reopen a poll.'],
  ['polls.delete', 'admin', 'Delete a poll.', 'required'],
  ['pollOptions.add', 'admin', 'Add a poll option.'],
  ['pollOptions.update', 'admin', 'Update a poll option.'],
  ['pollOptions.reorder', 'admin', 'Reorder poll options.'],
  ['pollOptions.delete', 'admin', 'Delete a poll option.', 'required'],
  ['pollVotes.cast', 'active_member', 'Cast or toggle the current actor poll vote.'],
  ['pollVotes.clearMine', 'active_member', 'Clear the current actor poll vote.', 'recommended'],
  ['committees.create', 'admin', 'Create a committee.'],
  ['committees.update', 'admin', 'Update a committee.'],
  ['committees.delete', 'admin', 'Delete a committee.', 'required'],
  ['committeeMembers.add', 'admin', 'Add a committee member.'],
  ['committeeMembers.changeRole', 'admin', 'Change a committee member role.', 'recommended'],
  ['committeeMembers.remove', 'admin', 'Remove a committee member.', 'required'],
  ['reactions.add', 'active_member', 'Add a reaction to a visible object.'],
  ['reactions.remove', 'active_member', 'Remove a reaction from a visible object.'],
  ['reactions.toggle', 'active_member', 'Toggle a reaction on a visible object.'],
  ['moderation.approve', 'moderator', 'Approve content in the moderation queue.', 'recommended'],
  ['moderation.hide', 'moderator', 'Hide content from the moderation queue.', 'recommended'],
  ['moderation.markReviewed', 'moderator', 'Mark moderation content reviewed.'],
  ['translations.translateText', 'admin', 'Translate ad hoc text.', 'recommended', 'metered'],
  ['translations.translateContent', 'admin', 'Translate product content.', 'recommended', 'metered'],
  ['translations.delete', 'admin', 'Delete a translation record.', 'required'],
  ['newsletters.drafts.generate', 'admin', 'Generate a newsletter draft.', 'recommended', 'metered'],
  ['newsletters.drafts.update', 'admin', 'Update a newsletter draft.'],
  ['newsletters.drafts.delete', 'admin', 'Delete a newsletter draft.', 'required'],
  ['insights.updateStatus', 'admin', 'Update AI insight status.'],
  ['insights.dismiss', 'admin', 'Dismiss an AI insight.', 'recommended'],
  ['exports.membersCsv', 'admin', 'Export private member CSV data.', 'required', 'privateData'],
  ['exports.eventsCsv', 'admin', 'Export event CSV data.', 'recommended', 'privateData'],
  ['exports.portalData', 'admin', 'Export portal data without secrets.', 'required', 'privateData'],
  ['jobs.checkExpirations', 'admin', 'Run the membership expiration check job.', 'recommended'],
  ['jobs.sendEventReminders', 'admin', 'Send event reminders.', 'required', 'external'],
  ['jobs.generateNewsletter', 'admin', 'Run newsletter generation.', 'required', 'metered'],
] as const;

export const V1_OPERATION_CATALOG = [...readDefinitions.map(read), ...mutationDefinitions.map(mutate)] as const;

const operationByName = new Map<string, OperationRegistryEntry>(V1_OPERATION_CATALOG.map((entry) => [entry.name, entry]));

export function isOperationName(value: string): value is OperationName {
  return OPERATION_NAME_PATTERN.test(value);
}

export function hasRegisteredOperation(value: string): value is OperationName {
  return operationByName.has(value);
}

export function getOperation(value: string): OperationRegistryEntry | undefined {
  return operationByName.get(value);
}

export function listOperations(): OperationRegistryEntry[] {
  return [...V1_OPERATION_CATALOG];
}
