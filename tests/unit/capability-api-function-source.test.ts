import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { collectFunctionsMap } from '../../scripts/_lib.ts';

describe('kychon-api deploy function source', () => {
  it('is included in the deploy function collection', async () => {
    const functionsMap = await collectFunctionsMap(join(import.meta.dirname, '../../functions'));

    expect(functionsMap['kychon-api']).toBeDefined();
    expect(functionsMap['kychon-api'].runtime).toBe('node22');
    expect(functionsMap['kychon-api'].source).toContain('canonical Kychon Capability API gateway');
    expect(functionsMap['kychon-api'].source).toContain('POST /functions/v1/kychon-api');
    expect(functionsMap['kychon-api'].source).toContain(`const ENGINE_VERSION = '${packageVersion()}';`);
    expect(functionsMap['kychon-api'].source).not.toContain('__KYCHON_ENGINE_VERSION__');
  });
});

function packageVersion(): string {
  return JSON.parse(readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8')).version;
}
