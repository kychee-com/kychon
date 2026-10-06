// A fresh in-process Postgres (PGlite) with Kychon's real schema.sql applied.
// For tests of SQL behavior (triggers, functions) that mocks can't prove.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = readFileSync(join(process.cwd(), 'schema.sql'), 'utf8');

export async function freshKychonDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SCHEMA);
  return db;
}

export async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
