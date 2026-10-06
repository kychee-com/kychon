/**
 * This repo is public. Copied-site ports carry real clubs' content and contact
 * details, so their seeds, deploy scripts and chrome snapshots live in the
 * private kychee-com/kychon-concierge repo (ports/<slug>/), never here.
 * Test fixtures use fictional organizations and reserved example domains.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const ALLOWED_FIXTURE_EMAIL = /@(example\.(org|com|net|test)|[a-z0-9.-]+\.(invalid|test|example))$/i;

describe('public repo hygiene', () => {
  it('contains no copied-site port files', () => {
    const ports = tracked.filter((file) => /(^|\/)_[^/]*-port(\.seed\.sql|-deploy\.ts)$/.test(file));
    expect(ports).toEqual([]);
  });

  it('keeps chrome snapshot fixtures synthetic', () => {
    const snapshots = tracked.filter((file) => file.startsWith('fixtures/chrome/'));
    expect(
      snapshots.filter((file) => !/^fixtures\/chrome\/sample-[a-z0-9-]+\.chrome-snapshot\.json$/.test(file)),
    ).toEqual([]);
  });

  it('uses only reserved example domains for email addresses in fixtures', () => {
    const offenders: string[] = [];
    for (const file of tracked.filter((f) => f.startsWith('fixtures/'))) {
      const text = readFileSync(file, 'utf8');
      for (const email of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/g) ?? []) {
        if (!ALLOWED_FIXTURE_EMAIL.test(email)) offenders.push(`${file}: ${email}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
