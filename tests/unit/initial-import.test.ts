/**
 * Initial import runs once (openspec content-history, `initial-import`).
 *
 * The seed rides the same content-tracked migration as schema.sql, so any
 * schema edit re-ran it: port seeds TRUNCATEd live content and typed seeds
 * resurrected deleted blocks. readMigrations now wraps the seed in a plpgsql
 * block that only runs while `kychon_install` is empty.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, readMigrations, reimportFromArgv } from '../../scripts/_lib';
import { generateSeedSql } from '../../scripts/generate-seed-sql';
import {
  assertReimportConfirmed,
  InitialImportError,
  prepareImportStatements,
  resolveSeedPath,
  splitSqlStatements,
  wrapInitialImport,
} from '../../scripts/initial-import';
import { seed as eaglesSeed } from '../../src/seeds/eagles';

describe('splitSqlStatements', () => {
  it('splits on top-level semicolons only', () => {
    const sql = [
      "INSERT INTO t VALUES ('a;b', 'it''s; fine');",
      '-- comment; with semicolon',
      '/* block; /* nested; */ still; */ UPDATE t SET x = 1;',
      'INSERT INTO t VALUES ($$dollar; body$$, $tag$x;y$tag$);',
      "INSERT INTO t VALUES (E'back\\'slash;');",
      'UPDATE "we;ird" SET a = 2',
    ].join('\n');
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(5);
    expect(statements[0]).toBe("INSERT INTO t VALUES ('a;b', 'it''s; fine')");
    expect(statements[3]).toBe("INSERT INTO t VALUES (E'back\\'slash;')");
    expect(statements[4]).toBe('UPDATE "we;ird" SET a = 2');
  });

  it('keeps $$ inside quoted strings intact (SDJC prices like "Pay $$ (USD)")', () => {
    const statements = splitSqlStatements(
      "INSERT INTO pages VALUES ('Pay $$ (USD); $50.00');\nINSERT INTO t VALUES (1);",
    );
    expect(statements).toEqual(["INSERT INTO pages VALUES ('Pay $$ (USD); $50.00')", 'INSERT INTO t VALUES (1)']);
  });

  it('drops empty and comment-only statements', () => {
    expect(splitSqlStatements('-- only a comment\n;\n  ;')).toEqual([]);
  });
});

describe('prepareImportStatements', () => {
  it('passes data statements through and turns top-level SELECT into PERFORM', () => {
    expect(
      prepareImportStatements(
        'TRUNCATE sections;\n-- reindex\nSELECT kychon_reindex_search();\nWITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x;',
      ),
    ).toEqual([
      'TRUNCATE sections',
      'PERFORM kychon_reindex_search()',
      'WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x',
    ]);
  });

  it.each([
    ['CREATE TABLE t (id int);', /CREATE/],
    ['ALTER TABLE t ADD COLUMN x int;', /ALTER/],
    ['BEGIN;', /BEGIN/],
    ['DO $$ BEGIN END $$;', /DO/],
    ['SET search_path TO x;', /SET/],
  ])('rejects non-data statement %s', (sql, keyword) => {
    expect(() => prepareImportStatements(sql)).toThrow(InitialImportError);
    expect(() => prepareImportStatements(sql)).toThrow(keyword);
  });

  it('rejects the reserved wrapper tag', () => {
    expect(() => prepareImportStatements('INSERT INTO t VALUES ($kychon_import$x$kychon_import$);')).toThrow(
      /reserved tag/,
    );
  });
});

describe('wrapInitialImport', () => {
  it('guards the import on kychon_install and records the marker', () => {
    const sql = wrapInitialImport("INSERT INTO pages (slug, title) VALUES ('about', 'About');", { source: 'seed.sql' });
    expect(sql).toMatch(
      /DO \$kychon_import\$\nBEGIN\n {2}IF EXISTS \(SELECT 1 FROM kychon_install\) THEN\n {4}RETURN;/,
    );
    expect(sql).toContain("INSERT INTO pages (slug, title) VALUES ('about', 'About');");
    expect(sql).toMatch(
      /INSERT INTO kychon_install \(import_source, import_checksum\) VALUES \('seed\.sql', '[0-9a-f]{64}'\);\nEND\n\$kychon_import\$;$/,
    );
    expect(sql).not.toContain('DELETE FROM kychon_install');
  });

  it('re-import clears the marker before the guard', () => {
    const sql = wrapInitialImport('INSERT INTO t VALUES (1);', { source: 'seed.sql', reimport: true });
    expect(sql.indexOf('DELETE FROM kychon_install;')).toBeLessThan(sql.indexOf('DO $kychon_import$'));
  });

  it('emits nothing for an empty seed', () => {
    expect(wrapInitialImport('-- nothing\n', { source: 'seed.sql' })).toBe('');
  });
});

describe('real seeds are valid initial imports', () => {
  it.each(['fixtures/seeds/sample-port.seed.sql'])('%s', (file) => {
    const seed = readFileSync(join(ROOT, file), 'utf8');
    expect(() => prepareImportStatements(seed)).not.toThrow();
  });

  it('generated eagles seed', () => {
    expect(() => prepareImportStatements(generateSeedSql(eaglesSeed))).not.toThrow();
  });
});

describe('readMigrations', () => {
  it('appends the seed as a guarded import after schema.sql', () => {
    const sql = readMigrations(ROOT, 'fixtures/seeds/sample-port.seed.sql');
    const schema = readFileSync(join(ROOT, 'schema.sql'), 'utf8');
    expect(sql.startsWith(schema)).toBe(true);
    expect(sql).toContain("VALUES ('sample-port.seed.sql', '");
    expect(sql.match(/DO \$kychon_import\$/g)).toHaveLength(1);
  });

  it('re-import option clears the marker', () => {
    expect(readMigrations(ROOT, 'fixtures/seeds/sample-port.seed.sql', { reimport: true })).toContain(
      'DELETE FROM kychon_install;',
    );
  });
});

describe('schema.sql install marker', () => {
  const schema = readFileSync(join(ROOT, 'schema.sql'), 'utf8');

  it('creates kychon_install and adopts live projects before any site_config write', () => {
    const create = schema.indexOf('CREATE TABLE IF NOT EXISTS kychon_install');
    const adopt = schema.indexOf("SELECT 'adopted'");
    const firstConfigWrite = schema.indexOf('INSERT INTO site_config');
    expect(create).toBeGreaterThan(-1);
    expect(adopt).toBeGreaterThan(create);
    expect(adopt).toBeLessThan(firstConfigWrite);
  });

  it('keys adoption on pages/sections, not site_config (schema writes site_config defaults)', () => {
    const adoption = schema.slice(schema.indexOf("SELECT 'adopted'"), schema.indexOf('ON CONFLICT (id) DO NOTHING'));
    expect(adoption).toContain('EXISTS (SELECT 1 FROM sections)');
    expect(adoption).toContain('EXISTS (SELECT 1 FROM pages)');
    expect(adoption).not.toContain('site_config');
  });
});

describe('re-import confirmation', () => {
  it('requires the exact subdomain', () => {
    expect(() => assertReimportConfirmed('sdjagclub', undefined)).toThrow(/Confirm by passing the subdomain/);
    expect(() => assertReimportConfirmed('sdjagclub', 'eagles')).toThrow(InitialImportError);
    expect(() => assertReimportConfirmed('sdjagclub', 'sdjagclub')).not.toThrow();
  });

  it('parses --reimport=<subdomain>; bare --reimport carries no confirmation', () => {
    expect(reimportFromArgv(['node', 'deploy.ts'])).toBeUndefined();
    expect(reimportFromArgv(['node', 'deploy.ts', '--reimport=eagles'])).toEqual({ confirmSubdomain: 'eagles' });
    expect(reimportFromArgv(['node', 'deploy.ts', '--reimport'])).toEqual({ confirmSubdomain: '' });
  });
});

describe('seed file resolution', () => {
  it('honours absolute seed paths (ports keep seeds outside the engine checkout)', () => {
    const abs = join(ROOT, 'fixtures/seeds/sample-port.seed.sql');
    expect(resolveSeedPath(ROOT, abs)).toBe(abs);
    expect(readMigrations(ROOT, abs)).toContain("VALUES ('sample-port.seed.sql', '");
  });

  it('refuses an explicitly named seed that does not exist instead of importing nothing', () => {
    expect(() => resolveSeedPath(ROOT, '/nonexistent/port.seed.sql')).toThrow(/Seed file not found/);
    expect(() => readMigrations(ROOT, 'missing.seed.sql')).toThrow(InitialImportError);
  });

  it('allows the default seed.sql to be absent', () => {
    expect(resolveSeedPath('/nonexistent-root')).toBeNull();
  });
});
