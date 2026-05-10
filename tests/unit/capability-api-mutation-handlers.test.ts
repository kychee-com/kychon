import { describe, expect, it, vi } from 'vitest';

import {
  CapabilityMutationError,
  executeCapabilityMutation,
  validateCapabilityMutation,
  type CapabilityActor,
  type CapabilityMutationDb,
  type JsonObject,
} from '../../src/lib/capability-api/index.ts';

class MemoryMutationDb implements CapabilityMutationDb {
  counters: Record<string, number> = {};

  constructor(public tables: Record<string, JsonObject[]>) {}

  async select(table: string) {
    return this.tables[table] || [];
  }

  async insert(table: string, row: JsonObject) {
    const nextId = (this.counters[table] || this.maxId(table)) + 1;
    this.counters[table] = nextId;
    const created = { id: nextId, ...row };
    this.tables[table] = [...(this.tables[table] || []), created];
    return created;
  }

  async update(table: string, id: string | number, patch: JsonObject) {
    const rows = this.tables[table] || [];
    const index = rows.findIndex((row) => String(row.id) === String(id) || String(row.key) === String(id));
    if (index < 0) return null;
    rows[index] = { ...rows[index], ...patch };
    return rows[index];
  }

  async delete(table: string, id: string | number) {
    const rows = this.tables[table] || [];
    const index = rows.findIndex((row) => String(row.id) === String(id));
    if (index < 0) return null;
    const [deleted] = rows.splice(index, 1);
    return deleted || null;
  }

  private maxId(table: string) {
    return Math.max(0, ...(this.tables[table] || []).map((row) => Number(row.id || 0)));
  }
}

const adminActor: CapabilityActor = {
  state: 'admin',
  authenticated: true,
  user: { id: 'admin-user', email: 'admin@example.com' },
  member: {
    id: '1',
    ref: { type: 'member', id: '1' },
    userId: 'admin-user',
    email: 'admin@example.com',
    displayName: 'Admin',
    role: 'admin',
    status: 'active',
    lookup: 'user_id',
  },
  authority: { projectAdmin: false, activeMemberAdmin: true },
};

const memberActor: CapabilityActor = {
  ...adminActor,
  state: 'active_member',
  member: { ...adminActor.member!, role: 'member' },
  authority: { projectAdmin: false, activeMemberAdmin: false },
};

const anonymousActor: CapabilityActor = {
  state: 'anonymous',
  authenticated: false,
  user: null,
  member: null,
  authority: { projectAdmin: false, activeMemberAdmin: false },
};

function makeDb() {
  return new MemoryMutationDb({
    site_config: [{ id: 1, key: 'site_name', value: 'Old', category: 'general' }],
    pages: [{ id: 1, title: 'Old', slug: 'old' }],
    sections: [{ id: 1, section_type: 'hero', config: {}, position: 1 }],
    members: [{ id: 2, display_name: 'Pending', status: 'pending', role: 'member' }],
    membership_tiers: [{ id: 1, name: 'Member', position: 1 }],
    member_custom_fields: [{ id: 1, field_name: 'phone', position: 1 }],
    events: [{ id: 1, title: 'Old Event', starts_at: '2026-06-01T10:00:00Z' }],
    event_registration_options: [{ id: 1, event_id: 1, label: 'General' }],
    event_rsvps: [{ id: 1, event_id: 1, member_id: 1, status: 'going' }],
    announcements: [],
    resources: [],
    forum_categories: [{ id: 1, name: 'General', position: 1 }],
    forum_topics: [
      { id: 1, title: 'Open', locked: false, reply_count: 0 },
      { id: 2, title: 'Locked', locked: true, reply_count: 0 },
    ],
    forum_replies: [],
    polls: [
      { id: 1, question: 'Single', poll_type: 'single', is_open: true },
      { id: 2, question: 'Multiple', poll_type: 'multiple', is_open: true },
    ],
    poll_options: [
      { id: 1, poll_id: 1, label: 'Yes', position: 0 },
      { id: 2, poll_id: 1, label: 'No', position: 1 },
    ],
    poll_votes: [{ id: 1, poll_id: 1, option_id: 1, member_id: 1 }],
    committees: [{ id: 1, name: 'Board' }],
    committee_members: [],
    reactions: [],
    moderation_log: [{ id: 1, content_type: 'forum.topic', action: 'queued' }],
    content_translations: [],
    newsletter_drafts: [],
    member_insights: [{ id: 1, status: 'pending' }],
    capability_executions: [],
    activity_log: [],
  });
}

describe('Capability API mutation handlers', () => {
  it('validates mutation permissions, confirmation, side effects, and cost metadata', async () => {
    const denied = await validateCapabilityMutation('events.create', { title: 'Meetup' }, { actor: anonymousActor, db: makeDb() });
    expect(denied.accepted).toBe(false);
    expect(denied.permission.requiredState).toBe('admin');

    const exportPlan = await validateCapabilityMutation('exports.membersCsv', {}, { actor: adminActor, db: makeDb() });
    expect(exportPlan.requiresConfirmation).toBe(true);
    expect(exportPlan.cost?.class).toBe('privateData');
  });

  it('executes config, page, section, membership, tier, and field mutations', async () => {
    const db = makeDb();
    const ctx = { actor: adminActor, db };

    await executeCapabilityMutation('config.set', { key: 'site_name', value: 'New' }, ctx);
    await executeCapabilityMutation('pages.create', { title: 'About', slug: 'about' }, ctx);
    await executeCapabilityMutation('sections.updateConfig', { id: 1, config: { heading: 'Hi' } }, ctx);
    await executeCapabilityMutation('members.approve', { id: 2 }, ctx);
    await executeCapabilityMutation('tiers.create', { name: 'Premium', position: 2 }, ctx);
    await executeCapabilityMutation('memberFields.reorder', { id: 1, position: 2 }, ctx);

    expect(db.tables.site_config[0]).toMatchObject({ value: 'New' });
    expect(db.tables.pages.some((row) => row.slug === 'about')).toBe(true);
    expect(db.tables.sections[0].config).toEqual({ heading: 'Hi' });
    expect(db.tables.members[0].status).toBe('active');
    expect(db.tables.membership_tiers.some((row) => row.name === 'Premium')).toBe(true);
    expect(db.tables.member_custom_fields[0].position).toBe(2);
  });

  it('scopes members.updateProfile to the active member and strips admin-only fields', async () => {
    const db = makeDb();
    db.tables.members = [
      {
        id: 1,
        display_name: 'Self',
        avatar_url: null,
        bio: null,
        custom_fields: {},
        role: 'member',
        status: 'active',
        tier_id: 1,
        user_id: 'member-user',
        expires_at: null,
      },
      {
        id: 2,
        display_name: 'Other',
        role: 'member',
        status: 'active',
        tier_id: 1,
        user_id: 'other-user',
      },
    ];

    await expect(
      executeCapabilityMutation('members.updateProfile', { id: 2, display_name: 'Hijacked' }, { actor: memberActor, db }),
    ).rejects.toMatchObject({ code: 'permission.denied' });

    await executeCapabilityMutation(
      'members.updateProfile',
      {
        display_name: 'Updated Self',
        avatar_url: '/avatars/self.png',
        bio: 'Hello',
        custom_fields: { phone: '555-0100' },
        role: 'admin',
        status: 'suspended',
        tier_id: 99,
        user_id: 'attacker-user',
        expires_at: '2099-01-01T00:00:00Z',
      },
      { actor: memberActor, db },
    );

    expect(db.tables.members[0]).toMatchObject({
      display_name: 'Updated Self',
      avatar_url: '/avatars/self.png',
      bio: 'Hello',
      custom_fields: { phone: '555-0100' },
      role: 'member',
      status: 'active',
      tier_id: 1,
      user_id: 'member-user',
      expires_at: null,
    });
    expect(db.tables.members[1].display_name).toBe('Other');
  });

  it('executes event, registration option, RSVP, announcement, resource, asset, and export mutations', async () => {
    const db = makeDb();
    const storage = { upload: vi.fn(async (_kind: string, file: JsonObject) => ({ url: `/storage/${file.name || 'file'}` })) };
    const ctx = { actor: adminActor, db, storage };

    await executeCapabilityMutation('events.create', { title: 'New Event', starts_at: '2026-07-01T10:00:00Z' }, ctx);
    await executeCapabilityMutation('registrationOptions.disable', { id: 1 }, ctx);
    await executeCapabilityMutation('rsvps.setStatus', { id: 1, status: 'maybe' }, { actor: memberActor, db });
    const announcement = await executeCapabilityMutation(
      'announcements.publish',
      { title: 'News', body: 'Hello', poll: { question: 'Attend?', options: ['Yes', 'No'] }, pin: true },
      ctx,
    );
    await executeCapabilityMutation('resources.upload', { file: { name: 'guide.pdf' }, metadata: { title: 'Guide' } }, ctx);
    await executeCapabilityMutation('assets.upload', { file: { name: 'logo.png' }, path: 'logo.png' }, ctx);
    await executeCapabilityMutation('exports.membersCsv', { format: 'csv' }, ctx);

    expect(db.tables.events.some((row) => row.title === 'New Event')).toBe(true);
    expect(db.tables.event_registration_options[0].is_disabled).toBe(true);
    expect(db.tables.event_rsvps[0].status).toBe('maybe');
    expect(announcement.changed.map((ref) => ref.type)).toContain('poll');
    expect(db.tables.resources[0].file_url).toBe('/storage/guide.pdf');
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(db.tables.capability_executions).toHaveLength(1);
  });

  it('executes forum, poll, committee, reaction, and moderation mutations with domain semantics', async () => {
    const db = makeDb();
    const adminCtx = { actor: adminActor, db, now: new Date('2026-05-08T10:00:00Z') };

    const topic = await executeCapabilityMutation(
      'forum.topics.create',
      { categoryId: 1, title: 'Topic', body: 'Body', poll: { question: 'Vote?', options: ['A'] } },
      { actor: memberActor, db },
    );
    expect(topic.changed.map((ref) => ref.type)).toContain('poll');

    await expect(
      executeCapabilityMutation('forum.replies.create', { topicId: 2, body: 'Nope' }, { actor: memberActor, db }),
    ).rejects.toBeInstanceOf(CapabilityMutationError);

    await executeCapabilityMutation('forum.replies.create', { topicId: 1, body: 'Reply' }, { actor: memberActor, db, now: adminCtx.now });
    expect(db.tables.forum_topics.find((row) => row.id === 1)?.reply_count).toBe(1);

    await executeCapabilityMutation('pollVotes.cast', { pollId: 1, optionId: 2 }, { actor: memberActor, db });
    expect(db.tables.poll_votes.filter((row) => row.poll_id === 1 && row.member_id === '1')).toHaveLength(1);
    expect(db.tables.poll_votes.find((row) => row.poll_id === 1 && row.member_id === '1')?.option_id).toBe(2);

    await executeCapabilityMutation('committees.create', { name: 'Events' }, adminCtx);
    await executeCapabilityMutation('committeeMembers.add', { committee_id: 1, member_id: 2, role: 'chair' }, adminCtx);
    await executeCapabilityMutation('reactions.toggle', { contentType: 'announcement', contentId: 1, emoji: 'heart' }, { actor: memberActor, db });
    await executeCapabilityMutation('moderation.approve', { id: 1 }, { actor: { ...memberActor, state: 'moderator' }, db });

    expect(db.tables.committees.some((row) => row.name === 'Events')).toBe(true);
    expect(db.tables.committee_members).toHaveLength(1);
    expect(db.tables.reactions).toHaveLength(1);
    expect(db.tables.moderation_log[0].action).toBe('approved');
  });

  it('executes translation, newsletter, insight, activity, and job mutations', async () => {
    const db = makeDb();
    const ai = {
      translateText: vi.fn(async () => ({ id: 1, translatedText: 'Hola' })),
      translateContent: vi.fn(async () => ({ translated_text: 'Hola contenido' })),
      generateNewsletter: vi.fn(async () => ({ subject: 'Weekly', body: 'Body' })),
    };
    const jobs = { run: vi.fn(async (name: string) => ({ id: name, status: 'done' })) };
    const ctx = { actor: adminActor, db, ai, jobs };

    await executeCapabilityMutation('translations.translateText', { text: 'Hello', language: 'es' }, ctx);
    await executeCapabilityMutation('translations.translateContent', { contentType: 'page', contentId: 1, language: 'es' }, ctx);
    await executeCapabilityMutation('newsletters.drafts.generate', { periodStart: '2026-05-01' }, ctx);
    await executeCapabilityMutation('insights.dismiss', { id: 1 }, ctx);
    await executeCapabilityMutation('jobs.sendEventReminders', {}, ctx);

    expect(ai.translateText).toHaveBeenCalledOnce();
    expect(db.tables.content_translations[0].translated_text).toBe('Hola contenido');
    expect(db.tables.newsletter_drafts[0].subject).toBe('Weekly');
    expect(db.tables.member_insights[0].status).toBe('dismissed');
    expect(jobs.run).toHaveBeenCalledWith('sendEventReminders', {});
  });
});
