import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const functionsDir = join(import.meta.dirname, '../../functions');
const read = (file: string) => readFileSync(join(functionsDir, file), 'utf8');

// Functions meant to run on a schedule: a `// schedule: "..."` directive (which
// scripts/_lib.ts turns into a Run402 schedule trigger) or a dormant
// `// prototype-schedule: "..."` one.
const SCHEDULE_DIRECTIVE = /\/\/\s*(?:prototype-)?schedule:\s*"[^"]+"/;
const scheduledFunctions = readdirSync(functionsDir)
  .filter((file) => file.endsWith('.js'))
  .filter((file) => SCHEDULE_DIRECTIVE.test(read(file)));

it('finds the scheduled functions', () => {
  expect(scheduledFunctions).toEqual(
    expect.arrayContaining([
      'ai-content.js',
      'check-expirations.js',
      'event-reminders.js',
      'moderate-content.js',
      'prune-history.js',
    ]),
  );
});

/**
 * Regression guard for the scheduled-function `db is not defined` bug.
 *
 * Scheduled functions run with no signed-in user and must read across every
 * member regardless of RLS, so every DB read MUST go through `adminDb()` (not
 * the request-scoped `db(req)` and never a bare, undefined `db`). Earlier
 * revisions of `check-expirations.js` and `event-reminders.js` referenced a
 * bare `db` that was never imported, so every tick threw `ReferenceError: db
 * is not defined`, swallowed by the surrounding try/catch. This test fails if
 * that regresses.
 */
// Matches a bare `db.from(` / `db\n.from(` read that is NOT part of `adminDb(`.
// The negative lookbehind excludes the `min` of `adminDb` (and any word char).
const BARE_DB_READ = /(?<![A-Za-z0-9_])db\s*(?:\.|\n)/;

describe.each(scheduledFunctions)('scheduled function source: %s', (file) => {
  const source = read(file);

  it('imports adminDb from @run402/functions', () => {
    expect(source).toContain('@run402/functions');
    expect(source).toMatch(/import\s*\{[^}]*\badminDb\b[^}]*\}\s*from\s*'@run402\/functions'/);
  });

  it('reads only via adminDb() — no bare, undefined `db` reference', () => {
    expect(source).not.toMatch(BARE_DB_READ);
    // Every awaited query-builder read resolves through adminDb().
    expect(source).toContain('adminDb()');
  });

  // Every functions/*.js file is deployed to every portal, and anyone holding
  // the portal's anon key can call it. A scheduled function must therefore
  // authorize the run first: a platform-started run (x-run402-trigger) or an
  // admin. tests/unit/security-scheduled-functions.test.ts covers the behavior.
  it('authorizes the run before any database, AI, email, or body work', () => {
    expect(source).toContain("req.headers.get('x-run402-trigger')");
    const handler = source.slice(source.indexOf('export default'));
    const gate = handler.indexOf('await authorizeRun(req');
    expect(gate, 'the handler calls authorizeRun(req, ...)').toBeGreaterThan(-1);
    for (const work of [/\.from\(/, /\.sql\(/, /\bemail\.send\(/, /\bai\.\w+\(/, /\bfetch\(/, /\breq\.json\(/]) {
      const at = handler.search(work);
      if (at !== -1) expect(at, `${work} runs after the gate`).toBeGreaterThan(gate);
    }
  });
});
