// The AI connector's orientation data: the task list `assistant.guide` shows an
// assistant, and the input schemas `portal.describe` returns and kychon-api
// validates against. functions/kychon-api.js is deployed as a single source
// file, so `scripts/generate-connector-schemas.ts` inlines this module into it
// between generated markers; the contract test fails when the copy drifts.

import type { ActorState, JsonObject } from './types.js';

export interface ConnectorTask {
  task: string;
  operation: string;
}

export interface ConnectorGuideArea {
  area: string;
  minimumActorState: ActorState;
  tasks: ConnectorTask[];
}

export interface ConnectorOperationSchema {
  summary: string;
  input: JsonObject;
  example: JsonObject;
}

// What an assistant can do, grouped the way a person would ask for it. The
// guide shows an area when the caller's actor state reaches its minimum; the
// portal still enforces permissions per operation.
export const CONNECTOR_GUIDE_AREAS: ConnectorGuideArea[] = [
  {
    area: 'About you and this portal',
    minimumActorState: 'anonymous',
    tasks: [
      { task: 'See who you are acting as', operation: 'auth.whoami' },
      { task: 'Search pages, events and resources', operation: 'search.query' },
    ],
  },
  {
    area: 'Events',
    minimumActorState: 'anonymous',
    tasks: [
      { task: 'See upcoming events', operation: 'events.list' },
      { task: 'Read one event', operation: 'events.get' },
    ],
  },
  {
    area: 'Announcements',
    minimumActorState: 'anonymous',
    tasks: [
      { task: 'Read recent announcements', operation: 'announcements.list' },
      { task: 'Read one announcement', operation: 'announcements.get' },
    ],
  },
  {
    area: 'Pages',
    minimumActorState: 'anonymous',
    tasks: [
      { task: 'List the pages', operation: 'pages.list' },
      { task: 'Read one page', operation: 'pages.get' },
      { task: "Read a page's sections (its blocks of content)", operation: 'sections.list' },
    ],
  },
  {
    area: 'Polls',
    minimumActorState: 'anonymous',
    tasks: [
      { task: 'See open polls', operation: 'polls.list' },
      { task: 'See poll results', operation: 'pollResults.get' },
    ],
  },
  {
    area: 'Your membership',
    minimumActorState: 'active_member',
    tasks: [
      { task: 'RSVP to an event', operation: 'rsvps.setStatus' },
      { task: 'Cancel an RSVP', operation: 'rsvps.cancel' },
      { task: 'See your RSVPs', operation: 'rsvps.listMine' },
      { task: 'Update your profile', operation: 'members.updateProfile' },
      { task: 'Vote in a poll', operation: 'pollVotes.cast' },
    ],
  },
  {
    area: 'Members-only content',
    minimumActorState: 'active_member',
    tasks: [
      { task: 'Browse resources and documents', operation: 'resources.list' },
      { task: 'Look someone up in the member directory', operation: 'members.list' },
    ],
  },
  {
    area: 'Forum',
    minimumActorState: 'active_member',
    tasks: [
      { task: 'List forum categories', operation: 'forum.categories.list' },
      { task: 'List topics', operation: 'forum.topics.list' },
      { task: 'Read a topic', operation: 'forum.topics.get' },
      { task: "Read a topic's replies", operation: 'forum.replies.list' },
      { task: 'Start a topic', operation: 'forum.topics.create' },
      { task: 'Reply to a topic', operation: 'forum.replies.create' },
    ],
  },
  {
    area: 'Edit the website',
    minimumActorState: 'admin',
    tasks: [
      { task: "Change a section's text or settings (read it with sections.list first)", operation: 'sections.updateConfig' },
      { task: 'Read the portal settings', operation: 'config.get' },
      { task: 'Change the name, logo or tagline', operation: 'config.branding.update' },
      { task: 'Change colors and fonts', operation: 'config.theme.update' },
      { task: 'Find images already uploaded', operation: 'media.list' },
      { task: 'Add an image from a public web address', operation: 'media.importFromUrl' },
      { task: 'Get a link where the person uploads an image, such as one in the chat', operation: 'media.requestUpload' },
    ],
  },
  {
    area: 'Manage events',
    minimumActorState: 'admin',
    tasks: [
      { task: 'Add an event', operation: 'events.create' },
      { task: 'Change an event', operation: 'events.update' },
      { task: 'Delete an event', operation: 'events.delete' },
    ],
  },
  {
    area: 'Manage announcements',
    minimumActorState: 'admin',
    tasks: [
      { task: 'Publish an announcement', operation: 'announcements.publish' },
      { task: 'Edit an announcement', operation: 'announcements.update' },
    ],
  },
  {
    area: 'Manage members',
    minimumActorState: 'admin',
    tasks: [
      { task: 'List members, including pending applications', operation: 'members.list' },
      { task: 'Approve a pending member', operation: 'members.approve' },
      { task: 'Reject a pending member', operation: 'members.reject' },
    ],
  },
  {
    area: 'History and undo',
    minimumActorState: 'admin',
    tasks: [
      { task: 'See recent changes', operation: 'history.list' },
      { task: 'Undo a change', operation: 'history.revert' },
      { task: 'Take a restore point before a big change', operation: 'restorePoints.create' },
      { task: 'List restore points', operation: 'restorePoints.list' },
    ],
  },
];

// Input schemas for every operation the guide lists. Filled from the handlers'
// actual input handling; unknown fields stay allowed so existing callers that
// send extra keys keep working.
const ID: JsonObject = { type: ['integer', 'string'], description: 'Numeric id.' };
const DATE_TIME: JsonObject = { type: 'string', format: 'date-time' };
const ALL_DAY_DESCRIPTION =
  'Date only, no time (a trip, a holiday). starts_at is local midnight of the first day in source_timezone (else the site event timezone, else UTC); ends_at is any time on the last day.';
const EVENT_TAGS = {
  type: 'array',
  items: { type: 'string' },
  description: 'Event tags, for example ["paddling"]. Stored lowercase; an events list block shows only events with its tags.',
} satisfies JsonObject;
const PAGING_NOTE = 'Returns { rows, count } in database order; there is no paging or date filter, so sort and filter the rows yourself.';

function object(properties: JsonObject, extra: JsonObject = {}): JsonObject {
  return { type: 'object', properties, ...extra };
}

// Either of two spellings (or two alternative keys) must be present.
function oneOf(...keys: string[]): JsonObject {
  return { anyOf: keys.map((key) => ({ required: [key] })) };
}

export const CONNECTOR_SCHEMAS: Record<string, ConnectorOperationSchema> = {
  'auth.whoami': { summary: 'Who this call acts as.', input: object({}), example: {} },
  'search.query': {
    summary: 'Search page, resource and event titles and text the caller can see.',
    input: object({
      q: { type: 'string', maxLength: 300, description: 'Words to look for.' },
      type: { type: 'string', enum: ['all', 'pages', 'resources', 'events'] },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 50 },
    }),
    example: { q: 'picnic', type: 'events' },
  },
  'config.get': {
    summary: 'Read portal settings. Non-admins see branding, theme, features and general settings only.',
    input: object({
      key: { type: 'string', description: 'One setting, for example brand_text.' },
      category: { type: 'string', description: 'All settings in a category, for example branding.' },
    }),
    example: { category: 'branding' },
  },
  'pages.list': {
    summary: `List pages. ${PAGING_NOTE}`,
    input: object({ slug: { type: 'string' }, published: { type: 'boolean' }, show_in_nav: { type: 'boolean' } }),
    example: {},
  },
  'pages.get': {
    summary: 'Read one page by id or slug.',
    input: object({ id: ID, slug: { type: 'string' } }, oneOf('id', 'slug')),
    example: { slug: 'about' },
  },
  'sections.list': {
    summary: `List the blocks of content on a page. Filter by page_slug (the home page is "index"). ${PAGING_NOTE}`,
    input: object({
      page_slug: { type: 'string', description: 'Page slug; use this, not slug.' },
      zone: { type: 'string', enum: ['header', 'main', 'footer'] },
      scope: { type: 'string', enum: ['page', 'global'] },
      section_type: { type: 'string' },
      visible: { type: 'boolean' },
    }),
    example: { page_slug: 'index', zone: 'main' },
  },
  'events.list': {
    summary: `List events the caller can see. ${PAGING_NOTE}`,
    input: object({
      is_members_only: { type: 'boolean' },
      location: { type: 'string' },
      tags: { ...EVENT_TAGS, description: 'Only events carrying any of these tags.' },
    }),
    example: { tags: ['paddling'] },
  },
  'events.get': { summary: 'Read one event.', input: object({ id: ID }, { required: ['id'] }), example: { id: 7 } },
  'rsvps.listMine': {
    summary: "List the caller's own RSVPs.",
    input: object({ eventId: ID, status: { type: 'string', enum: ['going', 'maybe', 'cancelled'] } }),
    example: {},
  },
  'rsvps.setStatus': {
    summary: 'RSVP the caller to an event. status defaults to going; going is limited by the event capacity.',
    input: object(
      { eventId: ID, event_id: ID, id: { ...ID, description: 'An existing RSVP id.' }, status: { type: 'string', enum: ['going', 'maybe', 'cancelled'] } },
      oneOf('eventId', 'event_id', 'id'),
    ),
    example: { eventId: 7, status: 'going' },
  },
  'rsvps.cancel': {
    summary: "Cancel the caller's RSVP to an event.",
    input: object({ eventId: ID, event_id: ID, id: ID }, oneOf('eventId', 'event_id', 'id')),
    example: { eventId: 7 },
  },
  'announcements.list': {
    summary: `List announcements. ${PAGING_NOTE}`,
    input: object({ is_pinned: { type: 'boolean' } }),
    example: {},
  },
  'announcements.get': { summary: 'Read one announcement.', input: object({ id: ID }, { required: ['id'] }), example: { id: 3 } },
  'resources.list': {
    summary: `List resources and documents. ${PAGING_NOTE}`,
    input: object({ category: { type: 'string' }, file_type: { type: 'string' } }),
    example: {},
  },
  'polls.list': {
    summary: `List polls. ${PAGING_NOTE}`,
    input: object({ is_open: { type: 'boolean' } }),
    example: { is_open: true },
  },
  'pollResults.get': {
    summary: 'Read the results of one poll, when the caller may see them.',
    input: object({ id: { ...ID, description: 'The poll id.' }, pollId: ID }, oneOf('id', 'pollId')),
    example: { id: 5 },
  },
  'pollVotes.cast': {
    summary: 'Vote in an open poll. On a multiple-choice poll, voting for an option again removes that vote.',
    input: object(
      { pollId: ID, poll_id: ID, optionId: ID, option_id: ID, optionIds: { type: 'array', items: ID, minItems: 1 } },
      { allOf: [oneOf('pollId', 'poll_id'), oneOf('optionId', 'option_id', 'optionIds')] },
    ),
    example: { pollId: 5, optionId: 18 },
  },
  'members.list': {
    summary: `List members. Admins can filter by status (pending for applications waiting for approval). ${PAGING_NOTE}`,
    input: object({
      status: { type: 'string', enum: ['pending', 'active', 'rejected', 'suspended'] },
      role: { type: 'string', enum: ['member', 'moderator', 'admin'] },
    }),
    example: { status: 'pending' },
  },
  'members.updateProfile': {
    summary: "Update the caller's own profile. Only these fields change; custom_fields replaces the whole set.",
    input: object({
      display_name: { type: 'string', minLength: 1 },
      bio: { type: 'string' },
      avatar_url: { type: 'string', description: 'Image URL or site path.' },
      custom_fields: { type: 'object' },
    }),
    example: { bio: 'Volunteer coordinator since 2019.' },
  },
  'members.approve': { summary: 'Approve a pending member.', input: object({ id: ID }, { required: ['id'] }), example: { id: 42 } },
  'members.reject': { summary: 'Reject a pending member.', input: object({ id: ID }, { required: ['id'] }), example: { id: 42 } },
  'forum.categories.list': { summary: 'List forum categories.', input: object({}), example: {} },
  'forum.topics.list': {
    summary: `List forum topics, optionally in one category. ${PAGING_NOTE}`,
    input: object({ categoryId: ID, category_id: ID }),
    example: { categoryId: 2 },
  },
  'forum.topics.get': { summary: 'Read one forum topic.', input: object({ id: ID }, { required: ['id'] }), example: { id: 15 } },
  'forum.replies.list': {
    summary: 'List the replies to a topic.',
    input: object({ topicId: ID, topic_id: ID }, oneOf('topicId', 'topic_id')),
    example: { topicId: 15 },
  },
  'forum.topics.create': {
    summary: 'Start a forum topic as the caller.',
    input: object(
      { title: { type: 'string', minLength: 1 }, body: { type: 'string' }, categoryId: ID, category_id: ID },
      { required: ['title'] },
    ),
    example: { categoryId: 2, title: 'Carpool to the regatta?', body: 'Anyone driving from downtown?' },
  },
  'forum.replies.create': {
    summary: 'Reply to a forum topic as the caller. Locked topics refuse replies.',
    input: object(
      { topicId: ID, topic_id: ID, body: { type: 'string', minLength: 1 } },
      { required: ['body'], ...oneOf('topicId', 'topic_id') },
    ),
    example: { topicId: 15, body: 'I can take two people.' },
  },
  'sections.updateConfig': {
    summary:
      'Change a section. config REPLACES the whole section config, so read it with sections.list first and send it back with your edits.',
    input: object(
      {
        id: ID,
        config: { type: 'object' },
        visible: { type: 'boolean' },
        position: { type: 'integer' },
        column_span: { type: 'string', enum: ['1', '1/2', '1/3', '2/3'] },
      },
      { required: ['id'] },
    ),
    example: { id: 12, config: { heading: 'Welcome', subheading: 'Join us' } },
  },
  'config.branding.update': {
    summary: 'Change a branding setting such as brand_text (the portal name), brand_icon_url or a tagline.',
    input: object(
      { key: { type: 'string', minLength: 1 }, value: {}, category: { type: 'string' }, entries: { type: 'array', minItems: 1 } },
      oneOf('key', 'entries'),
    ),
    example: { key: 'brand_text', value: 'Riverside Eagles', category: 'branding' },
  },
  'config.theme.update': {
    summary: 'Change the theme (colors and fonts). Read the current theme with config.get first; value replaces it.',
    input: object(
      { key: { type: 'string', minLength: 1 }, value: {}, category: { type: 'string' }, entries: { type: 'array', minItems: 1 } },
      oneOf('key', 'entries'),
    ),
    example: { key: 'theme', value: { primary: '#1d4ed8', font_heading: 'Inter' }, category: 'theme' },
  },
  'media.list': {
    summary: 'List images and files already uploaded. Pass nextCursor back as cursor for the next page.',
    input: object({ cursor: { type: 'string' } }),
    example: {},
  },
  'media.importFromUrl': {
    summary:
      'Add a public image (an https URL to a JPEG, PNG, GIF, WebP or AVIF of up to 10 MB) to the media library. Use the returned url in a section or setting.',
    input: object({ url: { type: 'string', format: 'uri' } }, { required: ['url'] }),
    example: { url: 'https://example.org/team-photo.jpg' },
  },
  'media.requestUpload': {
    summary: 'Get a link where the person uploads an image themselves, for example a photo they have in the chat.',
    input: object({}),
    example: {},
  },
  'events.create': {
    summary: 'Add an event. Times are ISO date-times; ends_at must not be before starts_at.',
    input: object(
      {
        title: { type: 'string', minLength: 1 },
        starts_at: DATE_TIME,
        ends_at: DATE_TIME,
        description: { type: 'string' },
        location: { type: 'string' },
        capacity: { type: 'integer', minimum: 0 },
        image_url: { type: 'string', description: 'Image URL or site path.' },
        is_members_only: { type: 'boolean' },
        source_timezone: { type: 'string', description: 'IANA time zone, for example America/New_York.' },
        all_day: { type: 'boolean', description: ALL_DAY_DESCRIPTION },
        tags: EVENT_TAGS,
      },
      { required: ['title', 'starts_at'] },
    ),
    example: { title: 'Spring Picnic', starts_at: '2026-11-14T17:00:00Z', location: 'Riverside Park' },
  },
  'events.update': {
    summary: 'Change an event. Send only the fields that change.',
    input: object(
      {
        id: ID,
        title: { type: 'string', minLength: 1 },
        starts_at: DATE_TIME,
        ends_at: DATE_TIME,
        description: { type: 'string' },
        location: { type: 'string' },
        capacity: { type: 'integer', minimum: 0 },
        image_url: { type: 'string', description: 'Image URL or site path.' },
        is_members_only: { type: 'boolean' },
        all_day: { type: 'boolean', description: ALL_DAY_DESCRIPTION },
        tags: { ...EVENT_TAGS, description: `${EVENT_TAGS.description} Replaces the event's tags.` },
      },
      { required: ['id'] },
    ),
    example: { id: 7, location: 'Main Hall' },
  },
  'events.delete': { summary: 'Delete an event.', input: object({ id: ID }, { required: ['id'] }), example: { id: 7 } },
  'announcements.publish': {
    summary: 'Publish an announcement. body is HTML.',
    input: object({ title: { type: 'string', minLength: 1 }, body: { type: 'string' }, pin: { type: 'boolean' } }, { required: ['title'] }),
    example: { title: 'Clubhouse closed Monday', body: '<p>Closed for repairs.</p>' },
  },
  'announcements.update': {
    summary: 'Edit an announcement. body is HTML.',
    input: object({ id: ID, title: { type: 'string', minLength: 1 }, body: { type: 'string' } }, { required: ['id'] }),
    example: { id: 3, title: 'Clubhouse closed Monday and Tuesday' },
  },
  'history.list': {
    summary: 'List recent content changes, newest first, with who made them. Use nextBeforeId as before_id for older ones.',
    input: object({
      limit: { type: 'integer', minimum: 1, maximum: 200 },
      before_id: ID,
      actor_type: { type: 'string', enum: ['admin', 'agent', 'jwt', 'system', 'unattributed'] },
      channel: { type: 'string', enum: ['ai_connector'], description: 'Only changes made through an AI assistant.' },
    }),
    example: { limit: 20 },
  },
  'history.revert': {
    summary: 'Undo one change by its changeset id. If the content changed again since, it fails unless force is true.',
    input: object({ changeset_id: ID, changesetId: ID, force: { type: 'boolean' } }, oneOf('changeset_id', 'changesetId')),
    example: { changeset_id: 128 },
  },
  'restorePoints.list': {
    summary:
      'List restore points (snapshots of the whole site), newest first. Restoring one is done by the site owner in the portal, not here.',
    input: object({ after: { type: 'string', description: 'nextCursor from the previous page.' } }),
    example: {},
  },
  'restorePoints.create': {
    summary: 'Take a restore point of the whole site before a big change, with a short label.',
    input: object({ label: { type: 'string', minLength: 1, maxLength: 120 } }, { required: ['label'] }),
    example: { label: 'Before spring redesign' },
  },
};

export function connectorGuideOperations(): string[] {
  return [...new Set(CONNECTOR_GUIDE_AREAS.flatMap((area) => area.tasks.map((task) => task.operation)))].sort();
}
