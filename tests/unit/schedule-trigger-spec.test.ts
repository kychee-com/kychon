import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFunctionsMap, ROOT } from '../../scripts/_lib.ts';

// A `// schedule: "<cron>"` header deploys as the minimal schedule trigger; the
// gateway fills the timezone (UTC), both policies and the run block. The id
// stays "schedule" so portals deployed before keep their trigger and run history.
describe('schedule triggers', () => {
  it('emits the minimal trigger with the stable id for each scheduled function', async () => {
    const functions = await collectFunctionsMap(join(ROOT, 'functions'));
    expect(functions['check-expirations'].triggers).toEqual([{ id: 'schedule', type: 'schedule', cron: '0 8 * * *' }]);
    expect(functions['prune-history'].triggers).toEqual([{ id: 'schedule', type: 'schedule', cron: '23 3 * * *' }]);
  });

  it('gives an unscheduled function no triggers', async () => {
    const functions = await collectFunctionsMap(join(ROOT, 'functions'));
    expect(functions['site-search'].triggers).toBeUndefined();
  });
});
