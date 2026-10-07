/**
 * schema.sql gives an existing portal an owner: the earliest active admin, once,
 * and never on a demo (whose admin login is public).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const SCHEMA = readFileSync(join(process.cwd(), 'schema.sql'), 'utf8');

async function portal(extra = '') {
  const db = await freshKychonDb();
  await db.exec(`
    INSERT INTO members (email, display_name, role, status) VALUES
      ('pending@example.org', 'pending', 'admin', 'pending'),
      ('first@example.org', 'first', 'admin', 'active'),
      ('second@example.org', 'second', 'admin', 'active'),
      ('member@example.org', 'member', 'member', 'active');
    ${extra}
  `);
  return db;
}

const owners = async (db: Awaited<ReturnType<typeof portal>>) =>
  (await rows<{ email: string }>(db, `SELECT email FROM members WHERE role = 'owner' ORDER BY id`)).map((r) => r.email);

describe('owner backfill', () => {
  it('promotes the earliest active admin, and only once', async () => {
    const db = await portal();
    await db.exec(SCHEMA);
    expect(await owners(db)).toEqual(['first@example.org']);
    await db.exec(`UPDATE members SET role = 'admin' WHERE email = 'first@example.org'`);
    await db.exec(`UPDATE members SET role = 'owner' WHERE email = 'second@example.org'`);
    await db.exec(SCHEMA);
    expect(await owners(db)).toEqual(['second@example.org']);
  });

  it('leaves demos without an owner', async () => {
    const db = await portal(`INSERT INTO site_config (key, value, category) VALUES ('demo_mode', 'true', 'features');`);
    await db.exec(SCHEMA);
    expect(await owners(db)).toEqual([]);
  });
});
