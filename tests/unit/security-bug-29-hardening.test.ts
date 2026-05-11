import { describe, expect, it } from 'vitest';
import { safeCssUrl } from '../../src/lib/blocks.ts';
import {
  type CapabilityActor,
  type CapabilityMutationDb,
  CapabilityMutationError,
  executeCapabilityMutation,
  type JsonObject,
  sanitizeRichHtmlServer,
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
    const index = rows.findIndex((row) => String(row.id) === String(id));
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

const adminMember = adminActor.member;
if (!adminMember) throw new Error('admin actor must have a member context');

const memberActor: CapabilityActor = {
  ...adminActor,
  state: 'active_member',
  user: { id: 'member-user', email: 'member@example.com' },
  member: {
    ...adminMember,
    id: '2',
    userId: 'member-user',
    email: 'member@example.com',
    role: 'member',
  },
  authority: { projectAdmin: false, activeMemberAdmin: false },
};

describe('bug #29 item 1 — rsvps.setStatus validates eventId before insert', () => {
  it('throws notFound.object when eventId points at a missing event', async () => {
    const db = new MemoryMutationDb({
      events: [{ id: 1, title: 'Real Event' }],
      event_rsvps: [],
      activity_log: [],
    });

    await expect(
      executeCapabilityMutation('rsvps.setStatus', { eventId: 6104, status: 'going' }, { actor: memberActor, db }),
    ).rejects.toMatchObject({ code: 'notFound.object' });
  });

  it('still inserts an rsvp when the eventId is real', async () => {
    const db = new MemoryMutationDb({
      events: [{ id: 1, title: 'Real Event' }],
      event_rsvps: [],
      activity_log: [],
    });

    await executeCapabilityMutation('rsvps.setStatus', { eventId: 1, status: 'going' }, { actor: memberActor, db });
    expect(db.tables.event_rsvps).toHaveLength(1);
    expect(db.tables.event_rsvps[0]).toMatchObject({ event_id: 1, status: 'going' });
  });

  it('rsvps.cancel throws notFound when eventId is unknown and id is omitted', async () => {
    const db = new MemoryMutationDb({
      events: [{ id: 1, title: 'Real Event' }],
      event_rsvps: [],
      activity_log: [],
    });

    await expect(
      executeCapabilityMutation('rsvps.cancel', { eventId: 6104 }, { actor: memberActor, db }),
    ).rejects.toMatchObject({ code: 'notFound.object' });
  });
});

describe('bug #29 item 2 — members.changeRole role-enum + last-admin guard', () => {
  it('rejects arbitrary role strings ("project_admin", "superadmin", typos)', async () => {
    const db = new MemoryMutationDb({
      members: [
        { id: 1, role: 'admin', status: 'active', user_id: 'admin-user' },
        { id: 2, role: 'member', status: 'active' },
      ],
      activity_log: [],
    });

    for (const role of ['project_admin', 'superadmin', 'adimn', 'ADMIN-EDIT']) {
      await expect(
        executeCapabilityMutation('members.changeRole', { id: 2, role }, { actor: adminActor, db }),
      ).rejects.toMatchObject({ code: 'validation.failed' });
    }

    // The target row is unchanged.
    expect(db.tables.members[1]?.role).toBe('member');
  });

  it('accepts the canonical member|moderator|admin enum', async () => {
    const db = new MemoryMutationDb({
      members: [
        { id: 1, role: 'admin', status: 'active', user_id: 'admin-user' },
        { id: 2, role: 'member', status: 'active' },
      ],
      activity_log: [],
    });

    await executeCapabilityMutation('members.changeRole', { id: 2, role: 'moderator' }, { actor: adminActor, db });
    expect(db.tables.members[1]?.role).toBe('moderator');
  });

  it('refuses to demote the only active admin to member', async () => {
    const db = new MemoryMutationDb({
      members: [{ id: 1, role: 'admin', status: 'active', user_id: 'admin-user' }],
      activity_log: [],
    });

    await expect(
      executeCapabilityMutation('members.changeRole', { id: 1, role: 'member' }, { actor: adminActor, db }),
    ).rejects.toMatchObject({ code: 'conflict.state' });

    expect(db.tables.members[0]?.role).toBe('admin');
  });

  it('lets the admin demote themselves when another active admin remains', async () => {
    const db = new MemoryMutationDb({
      members: [
        { id: 1, role: 'admin', status: 'active', user_id: 'admin-user' },
        { id: 9, role: 'admin', status: 'active', user_id: 'backup-admin' },
      ],
      activity_log: [],
    });

    await executeCapabilityMutation('members.changeRole', { id: 1, role: 'member' }, { actor: adminActor, db });
    expect(db.tables.members[0]?.role).toBe('member');
  });
});

describe('bug #29 item 3 — safeCssUrl blocks CSS injection in url() context', () => {
  it('strips ); break-outs in url() value', () => {
    const evil = 'x);background:red url(y';
    expect(safeCssUrl(evil)).toBe('');
  });

  it('blocks javascript: URLs entirely', () => {
    expect(safeCssUrl('javascript:alert(1)')).toBe('');
    expect(safeCssUrl('JAVASCRIPT:alert(1)')).toBe('');
  });

  it('passes a clean http(s) URL through, percent-encoding only CSS-dangerous chars', () => {
    expect(safeCssUrl('https://cdn.example.com/img.png')).toBe('https://cdn.example.com/img.png');
    expect(safeCssUrl("https://cdn.example.com/has'apos.png")).toBe('https://cdn.example.com/has%27apos.png');
  });

  it('allows site-relative paths', () => {
    expect(safeCssUrl('/storage/avatars/me.png')).toBe('/storage/avatars/me.png');
  });

  it('rejects newlines and other control chars', () => {
    expect(safeCssUrl('https://example.com/\nimg.png')).toBe('');
  });
});

describe('bug #29 item 4 — sanitize announcement bodies on write', () => {
  it('strips <script> on publish', async () => {
    const db = new MemoryMutationDb({
      announcements: [],
      activity_log: [],
    });

    await executeCapabilityMutation(
      'announcements.publish',
      { title: 'News', body: '<p>hi</p><script>alert(1)</script>' },
      { actor: adminActor, db },
    );

    const stored = String(db.tables.announcements[0]?.body || '');
    expect(stored).not.toMatch(/<script/i);
    expect(stored).toContain('<p>hi</p>');
  });

  it('strips on*= event handlers on publish', async () => {
    const db = new MemoryMutationDb({ announcements: [], activity_log: [] });

    await executeCapabilityMutation(
      'announcements.publish',
      { title: 'News', body: '<img src="x" onerror="alert(1)">' },
      { actor: adminActor, db },
    );

    const stored = String(db.tables.announcements[0]?.body || '');
    expect(stored.toLowerCase()).not.toMatch(/onerror/);
  });

  it('neutralizes javascript: hrefs on publish', async () => {
    const db = new MemoryMutationDb({ announcements: [], activity_log: [] });

    await executeCapabilityMutation(
      'announcements.publish',
      { title: 'News', body: '<a href="javascript:alert(1)">click</a>' },
      { actor: adminActor, db },
    );

    const stored = String(db.tables.announcements[0]?.body || '').toLowerCase();
    expect(stored).not.toContain('javascript:');
  });

  it('sanitizes body on announcements.update', async () => {
    const db = new MemoryMutationDb({
      announcements: [{ id: 1, title: 'News', body: '<p>safe</p>' }],
      activity_log: [],
    });

    await executeCapabilityMutation(
      'announcements.update',
      { id: 1, body: '<p>updated</p><script>alert(1)</script>' },
      { actor: adminActor, db },
    );

    const stored = String(db.tables.announcements[0]?.body || '');
    expect(stored).not.toMatch(/<script/i);
    expect(stored).toContain('<p>updated</p>');
  });

  it('sanitizeRichHtmlServer leaves safe Tiptap-style HTML intact', () => {
    expect(sanitizeRichHtmlServer('<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>')).toBe(
      '<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>',
    );
  });

  // Even though we no longer throw, ensure the CapabilityMutationError import
  // is exercised here to keep the bundle's behavior typed-checked.
  it('CapabilityMutationError is the error class', () => {
    expect(CapabilityMutationError.name).toBe('CapabilityMutationError');
  });
});
