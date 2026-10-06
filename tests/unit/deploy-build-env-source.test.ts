import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const lib = readFileSync(join(root, 'scripts/_lib.ts'), 'utf8');

function functionBody(name: string): string {
  const start = lib.indexOf(`export async function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const next = lib.indexOf('\nexport ', start + 1);
  return lib.slice(start, next === -1 ? undefined : next);
}

// `astro.config.mjs` bakes KYCHON_ANON_KEY into the SSR bundle at build time;
// a deploy that builds without it ships SSR routes (/event, /calendar,
// /search, path aliases) whose every API call fails, so they render empty.
// CI's patchDeploy did exactly that until it shared the helper below.
describe('deploy builds carry the project env', () => {
  it('only buildAstroForProject calls buildAstro directly', () => {
    const calls = [...lib.matchAll(/^\s+buildAstro\(/gm)];
    expect(calls).toHaveLength(1);
    const helper = lib.slice(lib.indexOf('export function buildAstroForProject('));
    expect(helper.indexOf('buildAstro(buildOptions)')).toBeGreaterThan(-1);
    expect(helper).toContain('process.env.KYCHON_ANON_KEY = opts.anonKey');
    expect(helper).toContain('process.env.KYCHON_PROJECT_ID = opts.projectId');
  });

  it('both the full deploy and the CI patch deploy build through it', () => {
    expect(lib).toMatch(/async function assembleDeployRelease\([\s\S]*?buildAstroForProject\(buildOptions, opts\)/);
    expect(functionBody('patchDeploy')).toContain('buildAstroForProject(buildOptions, opts)');
  });
});
