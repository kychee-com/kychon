import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const functionsDir = join(import.meta.dirname, '../../functions');
const read = (file: string) => readFileSync(join(functionsDir, file), 'utf8');

const allFunctions = readdirSync(functionsDir).filter((file) => file.endsWith('.js'));

// Functions that do background work with no signed-in user: scheduled ones,
// ones that run as one-off Run402 function runs kychon-api queues
// (moderate-content, event-reminders), and ai-content, which an admin runs.
const backgroundFunctions = [
  'ai-content.js',
  'check-expirations.js',
  'event-reminders.js',
  'moderate-content.js',
  'prune-history.js',
];

// The `// schedule: "..."` directive scripts/_lib.ts turns into a Run402 schedule trigger.
const SCHEDULE_DIRECTIVE = /\/\/\s*schedule:\s*"[^"]+"/;

it('covers every function that runs on a schedule', () => {
  const scheduled = allFunctions.filter((file) => SCHEDULE_DIRECTIVE.test(read(file)));
  expect(scheduled).toEqual(expect.arrayContaining(['check-expirations.js', 'prune-history.js']));
  expect(scheduled.filter((file) => !backgroundFunctions.includes(file))).toEqual([]);
});

// Deploys never parsed `// prototype-schedule:`, so functions marked with it
// silently never ran. Background work runs on a real schedule or as a function run.
it.each(allFunctions)('%s carries no prototype-schedule directive', (file) => {
  expect(read(file)).not.toMatch(/prototype-schedule/);
});

/**
 * Regression guard for the scheduled-function `db is not defined` bug.
 *
 * Background functions run with no signed-in user and must read across every
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

describe.each(backgroundFunctions)('background function source: %s', (file) => {
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
  // the portal's anon key can call it. A background function must therefore
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
