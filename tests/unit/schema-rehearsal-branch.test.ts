/**
 * kychon#223: a second migration must apply on a Run402 rehearsal branch.
 *
 * Run402 rehearses a migration on a branch: the project's snapshot replayed
 * into a different schema slot. Function definitions travel verbatim, so a
 * function created with `SET search_path FROM CURRENT` still names the
 * parent's slot there until schema.sql redefines it. A port seed that
 * truncates site_config makes schema.sql's guarded default inserts write again
 * on every migration, and a write before the redefinition fired a trigger that
 * could not see `revisions`. Renaming the schema reproduces the branch: every
 * pinned name now points at a schema the migration cannot see.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { wrapInitialImport } from '../../scripts/initial-import';
import { rows } from '../helpers/pglite-db';

const SCHEMA = readFileSync(join(process.cwd(), 'schema.sql'), 'utf8');
// Port seeds clear the tables they import into (the ambler-running seed did).
const SEED = `TRUNCATE sections, pages, site_config RESTART IDENTITY CASCADE;
INSERT INTO pages (slug, title) VALUES ('about', 'About');
INSERT INTO site_config (key, value, category) VALUES ('site_name', '"Ambler"', 'branding');`;

async function migrate(db: PGlite, slot: string) {
  await db.exec(`SET search_path TO ${slot};\n${SCHEMA}\n${wrapInitialImport(SEED, { source: 'seed.sql' })}`);
}

describe('second migration on a rehearsal branch (kychon#223)', () => {
  it('re-runs schema.sql in a renamed schema slot and keeps recording history there', async () => {
    const db = new PGlite();
    await db.exec('CREATE SCHEMA p0001');
    await migrate(db, 'p0001'); // first deploy: initial import

    // The rehearsal branch: same objects, different slot name.
    await db.exec('ALTER SCHEMA p0001 RENAME TO p0002');
    await migrate(db, 'p0002'); // second deploy: a new migration id

    await db.exec(`UPDATE p0002.pages SET title = 'About us' WHERE slug = 'about'`);
    const revs = await rows<{ op: string }>(
      db,
      `SELECT op FROM p0002.revisions WHERE table_name = 'pages' ORDER BY id`,
    );
    expect(revs.map((r) => r.op)).toEqual(['insert', 'update']);
  }, 60_000);

  it('writes no content before every pinned function is redefined', () => {
    // Statements at the top level of schema.sql (outside $$ bodies), comments dropped.
    const topLevel = SCHEMA.split(/\$\$[\s\S]*?\$\$/).map((chunk) => chunk.replace(/--.*$/gm, ''));
    const lastPin = topLevel.findLastIndex((chunk) => /SET search_path FROM CURRENT/.test(chunk));
    const firstWrite = topLevel.findIndex((chunk) =>
      /^\s*(INSERT INTO (?!kychon_install\b)|UPDATE |DELETE FROM )/m.test(chunk),
    );
    expect(lastPin).toBeGreaterThan(0);
    expect(firstWrite).toBeGreaterThan(lastPin);
  });
});
