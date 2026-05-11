import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { materializeCustomPageStaticFiles } from '../../scripts/_lib.ts';
import type { ProjectSeed } from '../../src/seeds/types.ts';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kychon-static-aliases-'));
  dirs.push(dir);
  return dir;
}

function seedWithPages(pages: ProjectSeed['pages']): ProjectSeed {
  return {
    site_config: { brand_text: { value: 'Test', category: 'branding' } },
    sections: [],
    pages,
  };
}

describe('static page aliases', () => {
  it('copies page.html to safe published custom page files', () => {
    const dist = tempDist();
    writeFileSync(join(dist, 'page.html'), '<html>page shell</html>');
    writeFileSync(join(dist, 'events.html'), '<html>events</html>');

    const materialized = materializeCustomPageStaticFiles(
      dist,
      seedWithPages([
        { slug: 'about', title: 'About' },
        { slug: 'volunteer', title: 'Volunteer' },
        { slug: 'events', title: 'Reserved collision' },
        { slug: 'draft', title: 'Draft', published: false },
      ]),
    );

    expect(materialized).toEqual([
      { slug: 'about', file: 'about.html' },
      { slug: 'volunteer', file: 'volunteer.html' },
    ]);
    expect(readFileSync(join(dist, 'about.html'), 'utf-8')).toBe('<html>page shell</html>');
    expect(readFileSync(join(dist, 'volunteer.html'), 'utf-8')).toBe('<html>page shell</html>');
    expect(readFileSync(join(dist, 'page.html'), 'utf-8')).toBe('<html>page shell</html>');
    expect(readFileSync(join(dist, 'events.html'), 'utf-8')).toBe('<html>events</html>');
  });
});
