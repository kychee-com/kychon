/**
 * Event tags + events_list tag filtering (kychon#187): the normalizer, the
 * schema trigger, the kychon-api write/list path against the real schema
 * (PGlite), and the build-time bake.
 */
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderBlock, type Section } from '../../src/lib/blocks';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { eventMatchesTags, eventsListTagFilter, formatEventTags, normalizeEventTags } from '../../src/lib/event-tags';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | { id: string; email?: string },
}));

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
    functions: { runs: { create: async () => ({ id: 'run_test' }) } },
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };

describe('normalizeEventTags', () => {
  it('trims, collapses whitespace, lowercases and de-duplicates', () => {
    expect(normalizeEventTags(['  Paddling ', 'Urban   Events', 'paddling', '', 7])).toEqual([
      'paddling',
      'urban events',
      '7',
    ]);
  });

  it('splits a comma-separated string', () => {
    expect(normalizeEventTags('Cycling, paddling,,')).toEqual(['cycling', 'paddling']);
    expect(formatEventTags(['cycling', 'paddling'])).toBe('cycling, paddling');
  });

  it('treats anything else as no tags', () => {
    expect(normalizeEventTags(null)).toEqual([]);
    expect(normalizeEventTags({ tags: 'x' })).toEqual([]);
  });

  it('matches on any shared tag, and everything when there is no filter', () => {
    expect(eventMatchesTags(['paddling', 'trips'], ['cycling', 'paddling'])).toBe(true);
    expect(eventMatchesTags(['cycling'], ['paddling'])).toBe(false);
    expect(eventMatchesTags(null, ['paddling'])).toBe(false);
    expect(eventMatchesTags(null, [])).toBe(true);
    expect(eventsListTagFilter({ tags: 'Paddling' })).toEqual(['paddling']);
  });
});

describe('events.tags in schema.sql', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshKychonDb();
  });

  it('defaults to no tags and stores tags normalized whoever writes them', async () => {
    await db.exec(`
      INSERT INTO events (title, starts_at) VALUES ('Untagged', now());
      INSERT INTO events (title, starts_at, tags) VALUES ('Tagged', now(), ARRAY['  Paddling', 'URBAN   events', 'paddling', '']);
      INSERT INTO events (title, starts_at, tags) VALUES ('Null', now(), NULL);
    `);
    expect(await rows(db, 'SELECT title, tags FROM events ORDER BY id')).toEqual([
      { title: 'Untagged', tags: [] },
      { title: 'Tagged', tags: ['paddling', 'urban events'] },
      { title: 'Null', tags: [] },
    ]);

    await db.exec(`UPDATE events SET tags = ARRAY['Cycling'] WHERE title = 'Untagged'`);
    expect(await rows(db, `SELECT tags FROM events WHERE title = 'Untagged'`)).toEqual([{ tags: ['cycling'] }]);
  });

  it('copies source_metadata.source_activity_tags with the CUSTOMIZING.md backfill', async () => {
    await db.exec(`
      INSERT INTO events (title, starts_at, source_metadata) VALUES
        ('Imported', now(), '{"source_activity_tags": ["Paddling", "Urban Events"]}'),
        ('No source tags', now(), '{}');
      INSERT INTO events (title, starts_at, tags, source_metadata) VALUES
        ('Already tagged', now(), ARRAY['cycling'], '{"source_activity_tags": ["Paddling"]}');
    `);
    const doc = readFileSync('CUSTOMIZING.md', 'utf8');
    const backfill = doc.match(/```sql\n(UPDATE events\nSET tags = [\s\S]*?)```/)?.[1];
    expect(backfill).toBeTruthy();
    await db.exec(String(backfill));
    expect(await rows(db, 'SELECT title, tags FROM events ORDER BY id')).toEqual([
      { title: 'Imported', tags: ['paddling', 'urban events'] },
      { title: 'No source tags', tags: [] },
      { title: 'Already tagged', tags: ['cycling'] },
    ]);
  });

  it('is idempotent across re-applied migrations', async () => {
    await db.exec(`INSERT INTO events (title, starts_at, tags) VALUES ('Kept', now(), ARRAY['paddling'])`);
    await db.exec(readFileSync('schema.sql', 'utf8'));
    expect(await rows(db, 'SELECT tags FROM events')).toEqual([{ tags: ['paddling'] }]);
  });
});

describe('kychon-api events tags', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshKychonDb();
    state.db = pgliteAdminDb(db);
    state.user = null;
    await db.exec(`
      INSERT INTO members (user_id, email, display_name, role, status) VALUES
        ('${ADMIN.id}', '${ADMIN.email}', 'Admin', 'admin', 'active');
    `);
  });

  async function call(operation: string, phase: 'query' | 'execute', input: Record<string, unknown>, key?: string) {
    const res = await kychonApi(
      new Request('https://portal.test/functions/v1/kychon-api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiVersion: KYCHON_API_VERSION,
          operation,
          phase,
          ...(phase === 'execute' ? { confirmed: true, idempotencyKey: key } : {}),
          input,
        }),
      }),
    );
    return { status: res.status, body: await res.json() };
  }

  it('creates and updates tags, then lists events by tag', async () => {
    state.user = ADMIN;
    const created = await call(
      'events.create',
      'execute',
      { title: 'River trip', starts_at: '2030-05-01T09:00:00Z', tags: ['Paddling', 'Trips "Day"'] },
      'k-create',
    );
    expect(created.body.error).toBeUndefined();
    const id = (await rows<{ id: number }>(db, `SELECT id FROM events WHERE title = 'River trip'`))[0]?.id;
    expect(await rows(db, 'SELECT tags FROM events WHERE id = $1', [id])).toEqual([
      { tags: ['paddling', 'trips "day"'] },
    ]);

    await call(
      'events.create',
      'execute',
      { title: 'Ride', starts_at: '2030-05-02T09:00:00Z', tags: ['cycling'] },
      'k-ride',
    );
    await call('events.create', 'execute', { title: 'Social', starts_at: '2030-05-03T09:00:00Z' }, 'k-social');
    const stringTags = await call(
      'events.create',
      'execute',
      { title: 'Bad', starts_at: '2030-05-04T09:00:00Z', tags: 'x' },
      'k-bad',
    );
    expect(stringTags.body.error?.code).toBe('validation.failed');

    const updated = await call('events.update', 'execute', { id, tags: ['Paddling', ' Urban'] }, 'k-update');

    expect(updated.status).toBe(200);
    expect(await rows(db, 'SELECT tags FROM events WHERE id = $1', [id])).toEqual([{ tags: ['paddling', 'urban'] }]);

    state.user = null;
    const titles = async (input: Record<string, unknown>) => {
      const res = await call('events.list', 'query', input);
      expect(res.status).toBe(200);
      return (res.body.data.rows as Array<{ title: string }>).map((row) => row.title).sort();
    };
    expect(await titles({ tags: ['PADDLING'] })).toEqual(['River trip']);
    expect(await titles({ tags: ['paddling', 'cycling'] })).toEqual(['Ride', 'River trip']);
    expect(await titles({ tag: 'cycling' })).toEqual(['Ride']);
    expect(await titles({ tags: ['urban'] })).toEqual(['River trip']);
    expect(await titles({})).toEqual(['Ride', 'River trip', 'Social']);
  });
});

describe('events_list build-time bake', () => {
  const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
  const event = (id: number, title: string, tags: string[]) => ({
    id,
    title,
    description: null,
    location: null,
    starts_at: future(id),
    ends_at: null,
    capacity: null,
    image_url: null,
    is_members_only: false,
    tags,
    created_by: null,
    created_at: future(0),
  });
  const buildEvents = [
    event(1, 'Morning paddle', ['paddling']),
    event(2, 'Gravel ride', ['cycling']),
    event(3, 'Kayak and bike', ['paddling', 'cycling']),
  ];

  function bake(config: Record<string, unknown>): string {
    const section: Section = {
      id: 9,
      page_slug: 'paddling',
      zone: 'main',
      scope: 'page',
      section_type: 'events_list',
      position: 1,
      config: { count: 10, filter: 'upcoming', ...config },
    };
    return renderBlock(section, { admin: false, locale: 'en', buildEvents });
  }

  it('bakes only the events carrying the block tags', () => {
    const html = bake({ tags: ['Paddling'] });
    expect(html).toContain('Morning paddle');
    expect(html).toContain('Kayak and bike');
    expect(html).not.toContain('Gravel ride');
  });

  it('bakes every event without a tag filter', () => {
    const html = bake({ tags: [] });
    for (const title of ['Morning paddle', 'Gravel ride', 'Kayak and bike']) expect(html).toContain(title);
  });

  it('falls back to the client fetch when no event matches', () => {
    const html = bake({ tags: ['climbing'] });
    expect(html).not.toContain('data-events-payload');
    expect(html).not.toContain('Morning paddle');
  });
});
