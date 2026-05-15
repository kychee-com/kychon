import { describe, expect, it } from 'vitest';

import {
  type CapabilityActor,
  handleCapabilityApiRequest,
  type JsonObject,
  KYCHON_API_VERSION,
  runCapabilityQuery,
} from '../../src/lib/capability-api/index.ts';

class MemoryQueryDb {
  constructor(private tables: Record<string, JsonObject[]>) {}

  async select(table: string) {
    return this.tables[table] || [];
  }
}

const anonymousActor: CapabilityActor = {
  state: 'anonymous',
  authenticated: false,
  user: null,
  member: null,
  authority: { projectAdmin: false, activeMemberAdmin: false },
};

const memberActor: CapabilityActor = {
  state: 'active_member',
  authenticated: true,
  user: { id: 'user-1', email: 'member@example.com' },
  member: {
    id: '10',
    ref: { type: 'member', id: '10' },
    userId: 'user-1',
    email: 'member@example.com',
    displayName: 'Member',
    role: 'member',
    status: 'active',
    lookup: 'user_id',
  },
  authority: { projectAdmin: false, activeMemberAdmin: false },
};

function requireMember(actor: CapabilityActor) {
  if (!actor.member) throw new Error(`Expected ${actor.state} actor to have a member`);
  return actor.member;
}

const moderatorActor: CapabilityActor = {
  ...memberActor,
  state: 'moderator',
  member: { ...requireMember(memberActor), role: 'moderator' },
};

const adminActor: CapabilityActor = {
  ...memberActor,
  state: 'admin',
  member: { ...requireMember(memberActor), role: 'admin' },
  authority: { projectAdmin: false, activeMemberAdmin: true },
};

function sampleDb() {
  return new MemoryQueryDb({
    site_config: [{ key: 'site_name', value: 'Kychon Club', category: 'general' }],
    pages: [
      { id: 1, slug: 'public', title: 'Public', published: true, requires_auth: false },
      { id: 2, slug: 'private', title: 'Private', published: true, requires_auth: true },
      { id: 3, slug: 'draft', title: 'Draft', published: false, requires_auth: false },
    ],
    sections: [
      { id: 1, page_slug: 'public', visible: true, section_type: 'hero' },
      { id: 2, page_slug: 'public', visible: false, section_type: 'admin' },
    ],
    members: [
      {
        id: 10,
        display_name: 'Member',
        email: 'member@example.com',
        avatar_url: null,
        bio: 'Hello',
        role: 'member',
        status: 'active',
        custom_fields: { phone: 'secret' },
      },
    ],
    membership_tiers: [{ id: 1, name: 'Member' }],
    member_custom_fields: [
      { id: 1, field_name: 'public', visible_in_directory: true },
      { id: 2, field_name: 'private', visible_in_directory: false },
    ],
    events: [
      { id: 1, title: 'Public Event', is_members_only: false },
      { id: 2, title: 'Member Event', is_members_only: true },
    ],
    event_registration_options: [{ id: 1, event_id: 1, label: 'General' }],
    event_rsvps: [
      { id: 1, event_id: 1, member_id: 10, status: 'going' },
      { id: 2, event_id: 1, member_id: 99, status: 'maybe' },
    ],
    announcements: [{ id: 1, title: 'News' }],
    resources: [
      { id: 1, title: 'Public Resource', is_members_only: false },
      { id: 2, title: 'Member Resource', is_members_only: true },
    ],
    forum_categories: [{ id: 1, name: 'General' }],
    forum_topics: [
      { id: 1, category_id: 1, title: 'Visible', hidden: false },
      { id: 2, category_id: 1, title: 'Hidden', hidden: true },
    ],
    forum_replies: [
      { id: 1, topic_id: 1, body: 'Visible', hidden: false },
      { id: 2, topic_id: 1, body: 'Hidden', hidden: true },
    ],
    polls: [
      { id: 1, question: 'Open', results_visible: 'always', is_open: true },
      { id: 2, question: 'After vote', results_visible: 'after_vote', is_open: true },
      { id: 3, question: 'Attached', attached_to: 'announcement', attached_id: 1, results_visible: 'always' },
    ],
    poll_options: [
      { id: 1, poll_id: 1, label: 'Yes' },
      { id: 2, poll_id: 1, label: 'No' },
    ],
    poll_votes: [
      { id: 1, poll_id: 1, option_id: 1, member_id: 10 },
      { id: 2, poll_id: 1, option_id: 1, member_id: 99 },
      { id: 3, poll_id: 1, option_id: 2, member_id: 50 },
    ],
    committees: [{ id: 1, name: 'Board' }],
    committee_members: [{ id: 1, committee_id: 1, member_id: 10 }],
    reactions: [{ id: 1, content_type: 'announcement', content_id: 1, emoji: 'heart' }],
    moderation_log: [{ id: 1, content_type: 'forum.topic', action: 'queued' }],
    content_translations: [{ id: 1, content_type: 'page', language: 'es' }],
    newsletter_drafts: [{ id: 1, subject: 'Weekly' }],
    member_insights: [{ id: 1, member_id: 10, status: 'pending' }],
    activity_log: [{ id: 1, action: 'member_join' }],
    capability_executions: [{ id: 1, operation: 'jobs.sendEventReminders', status: 'succeeded' }],
    search_documents: [
      {
        id: 1,
        source_type: 'page',
        source_key: 'public',
        title: 'Public Page',
        body: 'Welcome',
        url: '/page.html?slug=public',
        published: true,
        is_members_only: false,
      },
      {
        id: 2,
        source_type: 'resource',
        source_key: '2',
        title: 'Private Handbook',
        body: 'Members only',
        url: '/resources.html#resource-2',
        published: true,
        is_members_only: true,
      },
    ],
  });
}

describe('Capability API query handlers', () => {
  it('implements search.query and search.suggest with visibility-safe results', async () => {
    const anon = await runCapabilityQuery('search.query', { q: 'handbook' }, { actor: anonymousActor, db: sampleDb() });
    expect((anon as JsonObject).total).toBe(0);

    const member = await runCapabilityQuery(
      'search.suggest',
      { q: 'handbook' },
      { actor: memberActor, db: sampleDb() },
    );
    expect((member as JsonObject).total).toBe(1);
    expect(((member as JsonObject).results as JsonObject[])[0].object).toEqual({ type: 'resource', id: '2' });
  });

  it('implements config, page, and section query visibility', async () => {
    await expect(
      runCapabilityQuery('config.get', { key: 'site_name' }, { actor: anonymousActor, db: sampleDb() }),
    ).resolves.toMatchObject({
      key: 'site_name',
      value: 'Kychon Club',
    });

    const anonPages = (await runCapabilityQuery(
      'pages.list',
      {},
      { actor: anonymousActor, db: sampleDb() },
    )) as JsonObject;
    expect((anonPages.rows as JsonObject[]).map((row) => row.slug)).toEqual(['public']);

    const adminPages = (await runCapabilityQuery(
      'pages.list',
      {},
      { actor: adminActor, db: sampleDb() },
    )) as JsonObject;
    expect((adminPages.rows as JsonObject[]).map((row) => row.slug)).toEqual(['public', 'private', 'draft']);
  });

  it('implements member, tier, and member-field reads with permission-appropriate fields', async () => {
    const memberList = (await runCapabilityQuery(
      'members.list',
      {},
      { actor: memberActor, db: sampleDb() },
    )) as JsonObject;
    expect((memberList.rows as JsonObject[])[0].email).toBeUndefined();
    expect((memberList.rows as JsonObject[])[0].custom_fields).toBeUndefined();

    const adminList = (await runCapabilityQuery(
      'members.list',
      {},
      { actor: adminActor, db: sampleDb() },
    )) as JsonObject;
    expect((adminList.rows as JsonObject[])[0].email).toBe('member@example.com');

    const fields = (await runCapabilityQuery(
      'memberFields.list',
      {},
      { actor: memberActor, db: sampleDb() },
    )) as JsonObject;
    expect((fields.rows as JsonObject[]).map((row) => row.field_name)).toEqual(['public']);
  });

  it('implements events, registration options, RSVPs, announcements, and resources', async () => {
    const anonEvents = (await runCapabilityQuery(
      'events.list',
      {},
      { actor: anonymousActor, db: sampleDb() },
    )) as JsonObject;
    expect((anonEvents.rows as JsonObject[]).map((row) => row.title)).toEqual(['Public Event']);

    const memberResources = (await runCapabilityQuery(
      'resources.list',
      {},
      { actor: memberActor, db: sampleDb() },
    )) as JsonObject;
    expect((memberResources.rows as JsonObject[]).map((row) => row.title)).toEqual([
      'Public Resource',
      'Member Resource',
    ]);

    const mine = (await runCapabilityQuery('rsvps.listMine', {}, { actor: memberActor, db: sampleDb() })) as JsonObject;
    expect(mine.rows as JsonObject[]).toHaveLength(1);

    await expect(
      runCapabilityQuery('announcements.get', { id: 1 }, { actor: anonymousActor, db: sampleDb() }),
    ).resolves.toMatchObject({
      id: 1,
      title: 'News',
    });
  });

  it('implements forum, poll, committee, reaction, moderation, AI, activity, and job reads', async () => {
    const memberTopics = (await runCapabilityQuery(
      'forum.topics.list',
      {},
      { actor: memberActor, db: sampleDb() },
    )) as JsonObject;
    expect((memberTopics.rows as JsonObject[]).map((row) => row.title)).toEqual(['Visible']);

    const modTopics = (await runCapabilityQuery(
      'forum.topics.list',
      {},
      { actor: moderatorActor, db: sampleDb() },
    )) as JsonObject;
    expect((modTopics.rows as JsonObject[]).map((row) => row.title)).toEqual(['Visible', 'Hidden']);

    const results = (await runCapabilityQuery(
      'pollResults.get',
      { id: 1 },
      { actor: memberActor, db: sampleDb() },
    )) as JsonObject;
    expect(results.totalVotes).toBe(3);

    await expect(
      runCapabilityQuery('moderation.queue', {}, { actor: moderatorActor, db: sampleDb() }),
    ).resolves.toMatchObject({ count: 1 });
    await expect(
      runCapabilityQuery('newsletters.drafts.list', {}, { actor: adminActor, db: sampleDb() }),
    ).resolves.toMatchObject({
      count: 1,
    });
    await expect(runCapabilityQuery('jobs.status', {}, { actor: adminActor, db: sampleDb() })).resolves.toMatchObject({
      count: 1,
    });
  });

  it('lets the gateway dispatch registered query operations when a query DB adapter is present', async () => {
    const res = await handleCapabilityApiRequest(
      new Request('https://portal.test/functions/v1/kychon-api', {
        method: 'POST',
        body: JSON.stringify({
          apiVersion: KYCHON_API_VERSION,
          operation: 'resources.list',
          phase: 'query',
          input: {},
        }),
      }),
      {
        createCorrelationId: () => 'query-corr',
        getUser: async () => ({ id: 'user-1', email: 'member@example.com' }),
        adminDb: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                limit: () => [
                  { id: 10, user_id: 'user-1', email: 'member@example.com', role: 'member', status: 'active' },
                ],
              }),
            }),
          }),
        }),
        queryDb: sampleDb(),
      },
    );

    const body = await res.json();
    expect(body).toMatchObject({ ok: true, correlationId: 'query-corr' });
    expect(body.data.rows.map((row: JsonObject) => row.title)).toEqual(['Public Resource', 'Member Resource']);
  });
});
