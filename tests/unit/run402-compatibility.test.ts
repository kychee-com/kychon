import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

type SelectChain = Promise<Row[]> & {
  eq(column: string, value: unknown): SelectChain;
  gt(column: string, value: unknown): SelectChain;
  gte(column: string, value: unknown): SelectChain;
  order(): SelectChain;
  limit(count: number): Promise<Row[]>;
};

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  inserts: [] as Array<{ table: string; row: Row }>,
  updates: [] as Array<{ table: string; patch: Row; column: string; value: unknown }>,
  sqlQueries: [] as string[],
  adminCalls: 0,
  legacyDbCalls: 0,
}));

function selectChain(rows: Row[]): SelectChain {
  const promise = Promise.resolve(rows) as SelectChain;
  promise.eq = (column: string, value: unknown) =>
    selectChain(rows.filter((row) => String(row[column]) === String(value)));
  promise.gt = (column: string, value: unknown) =>
    selectChain(rows.filter((row) => String(row[column] ?? '') > String(value)));
  promise.gte = (column: string, value: unknown) =>
    selectChain(rows.filter((row) => String(row[column] ?? '') >= String(value)));
  promise.order = () => selectChain(rows);
  promise.limit = (count: number) => Promise.resolve(rows.slice(0, count));
  return promise;
}

function table(name: string) {
  state.tables[name] ||= [];
  return {
    select() {
      return selectChain(state.tables[name]);
    },
    insert(row: Row) {
      const created = { id: state.tables[name].length + 1, ...row };
      state.tables[name] = [...state.tables[name], created];
      state.inserts.push({ table: name, row: created });
      return Promise.resolve([created]);
    },
    update(patch: Row) {
      return {
        eq(column: string, value: unknown) {
          state.updates.push({ table: name, patch, column, value });
          return Promise.resolve([]);
        },
      };
    },
  };
}

function sql(query: string) {
  state.sqlQueries.push(query);
  if (/max\(created_at\)/i.test(query)) {
    return Promise.resolve({ rows: [{ last_at: '1970-01-01T00:00:00Z' }] });
  }
  throw new Error(`Unexpected SQL in Run402 compatibility test: ${query}`);
}

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => ({ id: 'user-1', email: 'user@example.test' })),
    auth: { user: vi.fn(async () => ({ id: 'user-1', email: 'user@example.test' })) },
    adminDb: () => {
      state.adminCalls++;
      return { from: table, sql };
    },
    ai: {
      moderate: vi.fn(async () => ({
        flagged: true,
        category_scores: { harassment: 0.8 },
      })),
      translate: vi.fn(async () => ({ text: 'contenido traducido' })),
    },
    db: {
      from() {
        state.legacyDbCalls++;
        throw new Error('legacy implicit database shim should not be used');
      },
    },
  }),
  { virtual: true },
);

beforeEach(() => {
  state.tables = {
    site_config: [
      { key: 'feature_ai_moderation', value: true },
      { key: 'feature_ai_translation', value: true },
    ],
    forum_topics: [{ id: 1, title: 'Topic', body: 'Body', created_at: '2026-01-01T00:00:00Z', hidden: false }],
    forum_replies: [{ id: 2, body: 'Reply', created_at: '2026-01-01T00:00:00Z', hidden: false }],
    moderation_log: [],
    announcements: [{ id: 7, title: 'Announcement', body: 'Body' }],
    content_translations: [],
  };
  state.inserts = [];
  state.updates = [];
  state.sqlQueries = [];
  state.adminCalls = 0;
  state.legacyDbCalls = 0;
});

describe('Run402 database helper compatibility', () => {
  it('moderate-content uses explicit adminDb table access, not the legacy db shim', async () => {
    const moderateContent = (await import('../../functions/moderate-content.js')).default;

    const response = await moderateContent(new Request('https://portal.test/functions/v1/moderate-content'));

    await expect(response.json()).resolves.toMatchObject({ status: 'ok', moderated: 2 });
    expect(state.adminCalls).toBeGreaterThan(0);
    expect(state.legacyDbCalls).toBe(0);
    expect(state.updates.map((update) => update.table)).toEqual(['forum_topics', 'forum_replies']);
    expect(state.inserts.filter((insert) => insert.table === 'moderation_log')).toHaveLength(2);
  });

  it('translate-content uses explicit adminDb table access for cache reads and writes', async () => {
    const translateContent = (await import('../../functions/translate-content.js')).default;
    const request = new Request('https://portal.test/functions/v1/translate-content', {
      method: 'POST',
      body: JSON.stringify({
        content_type: 'announcement',
        content_id: 7,
        languages: ['es'],
      }),
    });

    const response = await translateContent(request);

    await expect(response.json()).resolves.toMatchObject({ status: 'ok', translated: 2 });
    expect(state.adminCalls).toBeGreaterThan(0);
    expect(state.legacyDbCalls).toBe(0);
    expect(state.inserts).toEqual([
      {
        table: 'content_translations',
        row: expect.objectContaining({
          content_type: 'announcement',
          content_id: 7,
          language: 'es',
          field: 'title',
          translated_text: 'contenido traducido',
        }),
      },
      {
        table: 'content_translations',
        row: expect.objectContaining({
          content_type: 'announcement',
          content_id: 7,
          language: 'es',
          field: 'body',
          translated_text: 'contenido traducido',
        }),
      },
    ]);
  });
});

describe('Run402 deprecated surface scan', () => {
  it('does not import db to call implicit database helpers in deployed function source', () => {
    const violations = listFiles(join(projectRoot, 'functions'))
      .filter((file) => file.endsWith('.js'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        const importsDb = /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]@run402\/functions['"]/s.test(source);
        return importsDb && /\bdb\s*\.\s*(from|sql)\s*\(/.test(source);
      })
      .map((file) => `${relative(projectRoot, file)} imports db and calls db.from/db.sql; use db(req) or adminDb().`);

    expectNoViolations(violations);
  });

  it('keeps current source, docs, and active specs off deprecated Run402 strings', () => {
    const violations: string[] = [];
    for (const file of currentScanFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const surface of deprecatedSurfaces) {
        if (surface.pattern.test(source)) {
          violations.push(`${relative(projectRoot, file)}: ${surface.label}; ${surface.hint}`);
        }
      }
    }

    expectNoViolations(violations);
  });
});

const projectRoot = join(import.meta.dirname, '../..');
const deprecatedPackageName = 'run402' + '-functions';
const removedDeployRoute = 'POST /deploy' + '/v1';
const legacyPolicyName = 'public' + '_read';
const textExtensions = new Set(['.astro', '.css', '.html', '.js', '.json', '.md', '.sql', '.ts']);
const currentRoots = [
  'CUSTOMIZING.md',
  'README.md',
  'STRUCTURE.md',
  'deploy.js',
  'docs',
  'functions',
  'openspec/specs',
  'scripts',
  'src',
];

const deprecatedSurfaces = [
  {
    label: 'deprecated function package name',
    pattern: new RegExp(`\\b${escapeRegExp(deprecatedPackageName)}\\b`),
    hint: 'import helpers from @run402/functions.',
  },
  {
    label: 'removed deploy route',
    pattern: new RegExp(escapeRegExp(removedDeployRoute)),
    hint: 'use the SDK deploy flow or run402 deploy apply.',
  },
  {
    label: 'legacy policy name',
    pattern: new RegExp(`\\b${legacyPolicyName}\\b`),
    hint: 'use current database.expose terminology or current policy names.',
  },
  {
    label: 'legacy bundle rls key',
    pattern: /"rls"\s*:/,
    hint: 'use database.expose in unified deploy artifacts.',
  },
];

function currentScanFiles(): string[] {
  return currentRoots.flatMap((root) => {
    const path = join(projectRoot, root);
    if (!existsSync(path)) return [];
    const stat = statSync(path);
    if (stat.isFile()) return isTextFile(path) ? [path] : [];
    return listFiles(path).filter(isTextFile);
  });
}

function listFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return listFiles(child);
    return entry.isFile() ? [child] : [];
  });
}

function isTextFile(path: string): boolean {
  return textExtensions.has(extname(path));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectNoViolations(violations: string[]) {
  if (violations.length > 0) {
    throw new Error(`Deprecated Run402 surfaces remain:\n${violations.join('\n')}`);
  }
  expect(violations).toEqual([]);
}
