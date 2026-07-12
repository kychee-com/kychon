import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the scheduled-function `db is not defined` bug.
 *
 * `check-expirations.js` and `event-reminders.js` are cron functions — they
 * run with no request and must read across every member regardless of RLS, so
 * every DB read MUST go through `adminDb()` (not the request-scoped `db(req)`
 * and never a bare, undefined `db`). Earlier revisions referenced a bare `db`
 * that was never imported, so every tick threw `ReferenceError: db is not
 * defined`, swallowed by the surrounding try/catch. This test fails if that
 * regresses.
 */
const scheduledFunctions = ['check-expirations.js', 'event-reminders.js'];

// Matches a bare `db.from(` / `db\n.from(` read that is NOT part of `adminDb(`.
// The negative lookbehind excludes the `min` of `adminDb` (and any word char).
const BARE_DB_READ = /(?<![A-Za-z0-9_])db\s*(?:\.|\n)/;

describe.each(scheduledFunctions)('scheduled function source: %s', (file) => {
  const source = readFileSync(join(import.meta.dirname, '../../functions', file), 'utf8');

  it('imports adminDb from @run402/functions', () => {
    expect(source).toContain('@run402/functions');
    expect(source).toMatch(/import\s*\{[^}]*\badminDb\b[^}]*\}\s*from\s*'@run402\/functions'/);
  });

  it('reads only via adminDb() — no bare, undefined `db` reference', () => {
    expect(source).not.toMatch(BARE_DB_READ);
    // Every awaited query-builder read resolves through adminDb().
    expect(source).toContain('adminDb()');
  });
});
